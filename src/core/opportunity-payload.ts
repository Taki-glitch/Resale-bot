/** Construit la ligne `opportunities` à partir d'une évaluation (partagé par l'application et la tâche planifiée). */
import type { Evaluation } from './evaluation.ts';

export function buildOpportunityPayload(ev: Evaluation, analysisId: string | null) {
  return {
    analysis_id: analysisId,
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
}
