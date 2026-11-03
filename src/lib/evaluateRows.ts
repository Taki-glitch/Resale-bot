import { evaluateListing } from '../core/evaluation.ts';
import type { Evaluation } from '../core/evaluation.ts';
import { NO_FEES } from '../core/profitability.ts';
import type { Settings } from '../core/settings.ts';
import type { AnalysisRow, ComparableRow, Listing } from '../types.ts';

/** Évalue une annonce à partir des lignes de base de données. Point d'entrée unique (fiche annonce, recalcul global). */
export function evaluateRows(a: {
  listing: Listing;
  comparables: ComparableRow[];
  analysis: AnalysisRow | null;
  settings: Settings;
  now?: Date;
}): Evaluation {
  const { listing, comparables, analysis, settings } = a;
  return evaluateListing({
    listing: {
      priceCents: listing.price_cents,
      condition: listing.condition,
      description: listing.description,
      url: listing.url,
      location: listing.location,
    },
    comparables: comparables.map((c) => ({
      priceCents: c.price_cents,
      kind: c.price_kind,
      observedAt: c.observed_at,
      relevance: c.relevance === null || c.relevance === undefined ? 1 : Number(c.relevance),
      condition: c.condition,
    })),
    analysis: analysis
      ? {
          confidence: analysis.confidence,
          sufficientData: analysis.sufficient_data,
          visibleDefects: analysis.details?.condition?.visible_defects ?? [],
          riskFlags: analysis.details?.risk_flags ?? [],
        }
      : null,
    settings: {
      minProfitCents: settings.minProfitCents,
      minRoiPct: settings.minRoiPct,
      maxPerItemCents: settings.maxPerItemCents,
      fee: settings.fees[`${settings.resalePlatform}:sale`] ?? NO_FEES,
      purchaseShippingCents: settings.defaultPurchaseShippingCents,
      saleShippingCents: settings.defaultSaleShippingCents,
      cleaningCents: settings.defaultCleaningCents,
      otherCostsCents: settings.defaultOtherCostsCents,
      weights: settings.scoringWeights,
    },
    now: a.now,
  });
}
