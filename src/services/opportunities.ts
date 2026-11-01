import { db } from './db.ts';
import { createNotification } from './notifications.ts';
import { shouldNotifyOpportunity } from '../core/opportunities.ts';
import type { OpportunityStatus, OpportunityView } from '../core/opportunities.ts';
import type { Evaluation, Recommendation } from '../core/evaluation.ts';
import { formatEuros } from '../core/format.ts';
import type { OpportunityRow } from '../types.ts';

/**
 * Enregistre (crée ou met à jour) l'évaluation d'une annonce.
 * Le statut choisi par l'utilisateur et sa sélection ne sont jamais écrasés.
 * Une notification n'est créée qu'au passage vers « bonne » ou « excellente » affaire.
 */
export async function saveEvaluation(args: {
  listingId: string;
  listingTitle: string;
  analysisId: string | null;
  evaluation: Evaluation;
  minProfitCents: number;
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
      resaleEstimateCents: ev.resaleEstimateCents,
      feesCents: ev.feesCents,
      cautiousNetProfitCents: ev.cautiousNetProfitCents,
      minResaleCents: ev.minResaleCents,
      priceVsMarketPct: ev.priceVsMarketPct,
      priceFlag: ev.priceFlag,
      confidenceLevel: ev.confidenceLevel,
      basis: ev.estimate.basis,
      comparableCount: ev.estimate.count,
    },
    risk_level: ev.risk,
    recommendation: ev.recommendation,
    confidence: ev.confidence,
    est_profit_cents: ev.netProfitCents,
    max_buy_cents: ev.maxBuyCents,
    net_margin_pct: ev.netMarginPct,
  };

  const found = await client
    .from('opportunities')
    .select('id, recommendation')
    .eq('listing_id', args.listingId)
    .maybeSingle();
  if (found.error) throw new Error(found.error.message);
  const previous = (found.data?.recommendation ?? null) as Recommendation | null;

  const res = found.data
    ? await client.from('opportunities').update(payload).eq('id', found.data.id).select('*').single()
    : await client.from('opportunities').insert({ listing_id: args.listingId, ...payload }).select('*').single();
  if (res.error) throw new Error(res.error.message);

  if (shouldNotifyOpportunity(previous, ev.recommendation, ev.netProfitCents, args.minProfitCents)) {
    try {
      await createNotification({
        type: 'opportunity',
        title: `${ev.recommendationLabel} : ${args.listingTitle}`,
        body: `Bénéfice net estimé ${formatEuros(ev.netProfitCents ?? 0)} (estimation, non garantie). Prix d'achat maximal conseillé : ${formatEuros(ev.maxBuyCents ?? 0)}.`,
        listingId: args.listingId,
        dedupKey: `opp:${args.listingId}:${ev.recommendation}`,
      });
    } catch {
      /* une notification manquée ne doit jamais bloquer l'évaluation */
    }
  }
  return res.data as OpportunityRow;
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
    .select('*, listing:listings(id, title, platform, price_cents, detected_at, product:products(category))')
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
      category: (r.listing.product?.category ?? null) as string | null,
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
