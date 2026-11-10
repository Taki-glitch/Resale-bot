import { db } from './db.ts';
import type { OpportunityStatus, OpportunityView } from '../core/opportunities.ts';
import type { Recommendation } from '../core/evaluation.ts';
import type { Settings } from '../core/settings.ts';
import { persistEvaluation, refreshEvaluationsWith } from '../lib/store.ts';
import type { OpportunityRow } from '../types.ts';

/** Enregistre l'évaluation d'une annonce (voir lib/store.ts). */
export const saveEvaluation = (args: Parameters<typeof persistEvaluation>[1]): Promise<OpportunityRow> => persistEvaluation(db(), args);

/** Recalcule les évaluations de l'utilisateur connecté (toutes, ou une annonce). */
export const refreshEvaluations = (settings: Settings, listingId?: string): Promise<{ evaluated: number; updated: number }> =>
  refreshEvaluationsWith(db(), settings, undefined, listingId);

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
