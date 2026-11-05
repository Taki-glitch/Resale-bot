import { db } from './db.ts';
import { createNotification } from './notifications.ts';
import { detectEvents } from '../core/notifications.ts';
import type { OpportunityStatus, OpportunityView } from '../core/opportunities.ts';
import type { Evaluation, Recommendation } from '../core/evaluation.ts';
import type { Settings } from '../core/settings.ts';
import { evaluateRows } from '../lib/evaluateRows.ts';
import type { AnalysisRow, ComparableRow, Listing, OpportunityRow } from '../types.ts';

interface KnownOpportunity {
  id: string;
  recommendation: Recommendation | null;
  score: number | null;
  risks: string[];
}

const chunk = <T,>(items: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

/**
 * Enregistre (crée ou met à jour) l'évaluation d'une annonce.
 * Le statut choisi par l'utilisateur et sa sélection ne sont jamais écrasés.
 * Les notifications ne sont créées que pour un changement important (voir core/notifications.ts).
 * `known` : état précédent déjà connu (null = aucune ligne) ; sinon il est lu en base.
 */
export async function saveEvaluation(args: {
  listingId: string;
  listingTitle: string;
  analysisId: string | null;
  evaluation: Evaluation;
  minProfitCents: number;
  known?: KnownOpportunity | null;
}): Promise<OpportunityRow> {
  const client = db();
  const ev = args.evaluation;
  const payload = {
    analysis_id: args.analysisId,
    score: ev.score,
    score_detail: {
      signature: ev.signature,
      criteria: ev.criteria,
      justification: ev.justification,
      conditions: ev.conditions,
      risks: ev.risks,
      summary: ev.summary,
      resaleEstimateCents: ev.resaleEstimateCents,
      feesCents: ev.feesCents,
      cautiousNetProfitCents: ev.cautiousNetProfitCents,
      minResaleCents: ev.minResaleCents,
      breakEvenCents: ev.breakEvenCents,
      priceVsMarketPct: ev.priceVsMarketPct,
      priceFlag: ev.priceFlag,
      confidenceLevel: ev.confidenceLevel,
      basis: ev.estimate.basis,
      comparableCount: ev.estimate.count,
      staleComparables: ev.staleComparables,
      evidenceGaps: ev.evidenceGaps,
    },
    risk_level: ev.risk,
    recommendation: ev.recommendation,
    confidence: ev.confidence,
    est_profit_cents: ev.netProfitCents,
    max_buy_cents: ev.maxBuyCents,
    net_margin_pct: ev.netMarginPct,
  };

  let known = args.known;
  if (known === undefined) {
    const found = await client
      .from('opportunities')
      .select('id, recommendation, score, score_detail')
      .eq('listing_id', args.listingId)
      .maybeSingle();
    if (found.error) throw new Error(found.error.message);
    known = found.data
      ? {
          id: found.data.id as string,
          recommendation: (found.data.recommendation ?? null) as Recommendation | null,
          score: (found.data.score ?? null) as number | null,
          risks: (found.data.score_detail?.risks ?? []) as string[],
        }
      : null;
  }

  const res = known
    ? await client.from('opportunities').update(payload).eq('id', known.id).select('*').single()
    : await client.from('opportunities').insert({ listing_id: args.listingId, ...payload }).select('*').single();
  if (res.error) throw new Error(res.error.message);

  const events = detectEvents({
    listingId: args.listingId,
    listingTitle: args.listingTitle,
    previous: known ? { recommendation: known.recommendation, score: known.score, risks: known.risks } : null,
    next: {
      recommendation: ev.recommendation,
      score: ev.score,
      risks: ev.risks,
      netProfitCents: ev.netProfitCents,
      priceCents: ev.purchaseCents,
      maxBuyCents: ev.maxBuyCents,
      staleComparables: ev.staleComparables,
    },
    minProfitCents: args.minProfitCents,
  });
  for (const e of events) {
    try {
      await createNotification({ type: e.type, title: e.title, body: e.body, listingId: args.listingId, dedupKey: e.dedupKey });
    } catch {
      /* une notification manquée ne doit jamais bloquer l'évaluation */
    }
  }
  return res.data as OpportunityRow;
}

/**
 * Recalcule les évaluations (toutes les annonces actives, ou une seule).
 * N'écrit que si la signature de l'évaluation a changé : un recalcul sans changement ne crée ni écriture ni notification.
 */
export async function refreshEvaluations(settings: Settings, listingId?: string): Promise<{ evaluated: number; updated: number }> {
  const client = db();
  let lq = client.from('listings').select('*').eq('status', 'active').order('detected_at', { ascending: false }).limit(200);
  if (listingId) lq = client.from('listings').select('*').eq('id', listingId);
  const lres = await lq;
  if (lres.error) throw new Error(lres.error.message);
  const listings = (lres.data ?? []) as Listing[];
  if (listings.length === 0) return { evaluated: 0, updated: 0 };

  const ids = listings.map((l) => l.id);
  const productIds = Array.from(new Set(listings.map((l) => l.product_id).filter((p): p is string => Boolean(p))));
  const comps: ComparableRow[] = [];
  for (const part of chunk(productIds, 40)) {
    const r = await client.from('comparables').select('*').in('product_id', part);
    if (r.error) throw new Error(r.error.message);
    comps.push(...((r.data ?? []) as ComparableRow[]));
  }
  const latestAnalysis = new Map<string, AnalysisRow>();
  const knownByListing = new Map<string, KnownOpportunity & { signature: string | null }>();
  for (const part of chunk(ids, 40)) {
    const a = await client.from('analyses').select('*').in('listing_id', part).order('created_at', { ascending: false });
    if (a.error) throw new Error(a.error.message);
    for (const row of (a.data ?? []) as AnalysisRow[]) if (!latestAnalysis.has(row.listing_id)) latestAnalysis.set(row.listing_id, row);
    const o = await client.from('opportunities').select('id, listing_id, recommendation, score, score_detail').in('listing_id', part);
    if (o.error) throw new Error(o.error.message);
    for (const row of (o.data ?? []) as any[]) {
      knownByListing.set(row.listing_id as string, {
        id: row.id as string,
        recommendation: (row.recommendation ?? null) as Recommendation | null,
        score: (row.score ?? null) as number | null,
        risks: (row.score_detail?.risks ?? []) as string[],
        signature: (row.score_detail?.signature ?? null) as string | null,
      });
    }
  }

  let updated = 0;
  for (const l of listings) {
    const analysis = latestAnalysis.get(l.id) ?? null;
    const evaluation = evaluateRows({
      listing: l,
      comparables: comps.filter((c) => c.product_id === l.product_id),
      analysis,
      settings,
    });
    const known = knownByListing.get(l.id) ?? null;
    if (known && known.signature === evaluation.signature) continue;
    await saveEvaluation({
      listingId: l.id,
      listingTitle: l.title,
      analysisId: analysis?.id ?? null,
      evaluation,
      minProfitCents: settings.minProfitCents,
      known: known ? { id: known.id, recommendation: known.recommendation, score: known.score, risks: known.risks } : null,
    });
    updated += 1;
  }
  return { evaluated: listings.length, updated };
}

export async function updateOpportunity(
  id: string,
  patch: { status?: OpportunityStatus; is_selected?: boolean },
): Promise<void> {
  const { error } = await db().from('opportunities').update(patch).eq('id', id);
  if (error) throw new Error(error.message);
}

/** Opportunités avec les informations d'annonce nécessaires au classement. */
export async function fetchOpportunityViews(): Promise<OpportunityView[]> {
  const { data, error } = await db()
    .from('opportunities')
    .select('*, listing:listings(id, title, platform, price_cents, detected_at, photos, product:products(brand, category))')
    .order('detected_at', { ascending: false })
    .limit(300);
  if (error) throw new Error(error.message);
  return ((data ?? []) as any[])
    .filter((r) => r.listing)
    .map((r) => ({
      id: r.id as string,
      listingId: r.listing_id as string,
      title: r.listing.title as string,
      platform: r.listing.platform as string,
      brand: (r.listing.product?.brand ?? null) as string | null,
      category: (r.listing.product?.category ?? null) as string | null,
      summary: (r.score_detail?.summary ?? null) as string | null,
      photos: (Array.isArray(r.listing.photos) ? r.listing.photos : []) as string[],
      priceCents: (r.listing.price_cents ?? null) as number | null,
      resaleEstimateCents: (r.score_detail?.resaleEstimateCents ?? null) as number | null,
      netProfitCents: (r.est_profit_cents ?? null) as number | null,
      netMarginPct: r.net_margin_pct === null || r.net_margin_pct === undefined ? null : Number(r.net_margin_pct),
      maxBuyCents: (r.max_buy_cents ?? null) as number | null,
      score: (r.score ?? null) as number | null,
      recommendation: (r.recommendation ?? 'insufficient') as Recommendation,
      riskLevel: (r.risk_level ?? null) as OpportunityView['riskLevel'],
      confidence: r.confidence === null || r.confidence === undefined ? null : Number(r.confidence),
      status: r.status as OpportunityStatus,
      isSelected: Boolean(r.is_selected),
      detectedAt: (r.listing.detected_at ?? r.detected_at) as string,
    }));
}
