
import { estimateResale } from '../core/estimate.ts';
import { scoreOpportunity } from '../core/opportunity-score.ts';
import { computeFees, maxPurchasePrice } from '../core/profitability.ts';
import type { FeeModel } from '../core/profitability.ts';
import { db } from './db.ts';

export interface OpportunityRecord {
  id: string;
  listing_id: string;
  score: number | null;
  score_detail: { reasons?: string[]; missing?: string[]; roiPct?: number | null; comparableCount?: number };
  risk_level: 'low' | 'medium' | 'high' | null;
  status: string;
  est_profit_cents: number | null;
  max_buy_cents: number | null;
  listing?: {
    id: string; title: string; platform: string; price_cents: number | null;
    condition: string | null; location: string | null; url: string | null;
    detected_at: string; product_id: string | null;
  };
}

export async function refreshOpportunities(options: {
  fees: Record<string, FeeModel>;
  minProfitCents: number;
  minRoiPct: number;
  maxPerItemCents: number;
}): Promise<number> {
  const client = db();
  const { data: listings, error: listingError } = await client
    .from('listings').select('id,title,platform,price_cents,condition,location,url,detected_at,product_id')
    .eq('status', 'active').order('detected_at', { ascending: false }).limit(100);
  if (listingError) throw new Error(listingError.message);
  if (!listings?.length) return 0;

  const productIds = [...new Set(listings.map((l) => l.product_id).filter(Boolean))] as string[];
  const listingIds = listings.map((l) => l.id);
  const [{ data: comps, error: compError }, { data: analyses, error: analysisError }] = await Promise.all([
    productIds.length ? client.from('comparables').select('product_id,price_cents,price_kind').in('product_id', productIds) : Promise.resolve({ data: [], error: null } as any),
    client.from('analyses').select('listing_id,confidence,sufficient_data,created_at').in('listing_id', listingIds),
  ]);
  if (compError) throw new Error(compError.message);
  if (analysisError) throw new Error(analysisError.message);

  const analysisByListing = new Map<string, any>();
  for (const a of analyses ?? []) {
    const prev = analysisByListing.get(a.listing_id);
    if (!prev || (a.created_at ?? '') > (prev.created_at ?? '')) analysisByListing.set(a.listing_id, a);
  }

  let saved = 0;
  for (const listing of listings) {
    const related = (comps ?? []).filter((c: any) => c.product_id === listing.product_id);
    const estimate = estimateResale(related.map((c: any) => ({ priceCents: c.price_cents, kind: c.price_kind })));
    const analysis = analysisByListing.get(listing.id);
    const fee = options.fees[`${listing.platform}:sale`] ?? { percent: 0, fixedCents: 0 };
    const estimatedSale = estimate.status === 'ok' ? estimate.medianCents : null;
    const grossProfit = listing.price_cents != null && estimatedSale != null ? estimatedSale - listing.price_cents : null;
    const estimatedFees = estimatedSale == null ? 0 : computeFees(estimatedSale, fee);
    const netBeforeOtherCosts = grossProfit == null ? null : grossProfit - estimatedFees;
    const score = scoreOpportunity({
      purchaseCents: listing.price_cents,
      resaleCents: estimatedSale == null ? null : estimatedSale - estimatedFees,
      soldComparables: estimate.soldCount,
      askingComparables: estimate.askingCount,
      confidence: analysis?.confidence ?? null,
      sufficientData: analysis?.sufficient_data === true,
      condition: listing.condition,
      location: listing.location,
      maxPurchaseCents: options.maxPerItemCents,
      minProfitCents: options.minProfitCents,
      minRoiPct: options.minRoiPct,
    });
    const maxBuy = estimatedSale == null ? null : maxPurchasePrice({
      salePriceCents: estimatedSale, fee, minProfitCents: options.minProfitCents,
    });
    const { error } = await client.from('opportunities').upsert({
      listing_id: listing.id,
      score: score.score,
      score_detail: {
        reasons: score.reasons, missing: score.missing, roiPct: score.roiPct,
        comparableCount: estimate.count, soldCount: estimate.soldCount,
        askingCount: estimate.askingCount, estimatedFeesCents: estimatedFees,
      },
      risk_level: score.risk,
      est_profit_cents: netBeforeOtherCosts,
      max_buy_cents: maxBuy,
    }, { onConflict: 'user_id,listing_id' });
    if (error) throw new Error(error.message);
    if (score.eligible && score.score >= 75) {
      const { error: noticeError } = await client.from('notifications').insert({
        type: 'opportunity',
        title: 'Opportunité à examiner',
        body: `${listing.title} obtient un score de ${score.score}/100. Vérifie les comparables, les frais et l’état avant toute décision.`,
        channel: 'in_app',
        dedup_key: `opportunity:${listing.id}:v03`,
      });
      // L'index unique sur dedup_key empêche les notifications répétées.
      if (noticeError && noticeError.code !== '23505') throw new Error(noticeError.message);
    }
    saved += 1;
  }
  return saved;
}

export async function fetchOpportunities(): Promise<OpportunityRecord[]> {
  const client = db();
  const { data, error } = await client.from('opportunities')
    .select('id,listing_id,score,score_detail,risk_level,status,est_profit_cents,max_buy_cents,listing:listings(id,title,platform,price_cents,condition,location,url,detected_at,product_id)')
    .order('score', { ascending: false, nullsFirst: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as OpportunityRecord[];
}

export async function updateOpportunityStatus(id: string, status: string): Promise<void> {
  const { error } = await db().from('opportunities').update({ status }).eq('id', id);
  if (error) throw new Error(error.message);
}
