/**
 * Moteur d'évaluation d'une annonce : estimation, rentabilité, score, risque, confiance et recommandation.
 * Fonction pure : mêmes entrées, même résultat. Aucune donnée n'est inventée ; sans comparables suffisants
 * l'annonce est « non évaluable ». Tout résultat est une ESTIMATION, jamais un gain garanti.
 */
import { computeProfit, computeScenarios, maxPurchasePrice, minResalePrice } from './profitability.ts';
import type { FeeModel } from './profitability.ts';
import { estimateResale, INSUFFICIENT_LABEL, MIN_COMPARABLES } from './estimate.ts';
import type { PriceKind, ResaleEstimate } from './estimate.ts';
import { computeScore, DEMAND_WINDOW_DAYS } from './scoring.ts';
import type { CriterionResult, ScoringWeights } from './scoring.ts';
import { formatEuros, formatPct } from './format.ts';

export type Recommendation = 'excellent' | 'good' | 'conditional' | 'poor' | 'avoid' | 'insufficient';
export type RiskLevel = 'low' | 'medium' | 'high';
export type ConfidenceLevel = 'low' | 'medium' | 'high';

export const RECOMMENDATION_LABEL: Record<Recommendation, string> = {
  excellent: 'Excellente affaire',
  good: 'Bonne affaire',
  conditional: 'Affaire intéressante sous conditions',
  poor: 'Peu intéressante',
  avoid: 'À éviter',
  insufficient: 'Non évaluable',
};
export const RISK_LABEL: Record<RiskLevel, string> = { low: 'Faible', medium: 'Moyen', high: 'Élevé' };
export const CONFIDENCE_LABEL: Record<ConfidenceLevel, string> = { low: 'Faible', medium: 'Moyenne', high: 'Élevée' };

// Seuils (documentés dans docs/ARCHITECTURE.md ; à recalibrer avec l'expérience).
export const SCORE_EXCELLENT = 80;
export const SCORE_GOOD = 65;
export const SCORE_CONDITIONAL = 50;
export const SCORE_AVOID = 35;
export const UNDERPRICED_PCT = -25; // prix demandé ≥ 25 % sous l'estimation : annonce potentiellement sous-évaluée
export const OVERPRICED_PCT = 15; // prix demandé ≥ 15 % au-dessus de l'estimation : prix anormalement élevé
export const SUSPICIOUS_LOW_PCT = -50; // ≥ 50 % sous l'estimation : vérifier authenticité et état

export interface EvaluationInput {
  listing: {
    priceCents: number | null;
    condition: string | null;
    description: string | null;
    url: string | null;
    location: string | null;
  };
  comparables: { priceCents: number; kind: PriceKind; observedAt?: string | null }[];
  analysis: { confidence: number | null; sufficientData: boolean; visibleDefects: string[]; riskFlags: string[] } | null;
  settings: {
    minProfitCents: number;
    minRoiPct: number;
    maxPerItemCents: number;
    fee: FeeModel;
    otherCostsCents: number;
    weights?: Partial<ScoringWeights>;
  };
  now?: Date;
}

export interface Evaluation {
  recommendation: Recommendation;
  recommendationLabel: string;
  score: number | null;
  criteria: CriterionResult[];
  estimate: ResaleEstimate;
  purchaseCents: number | null;
  resaleEstimateCents: number | null;
  feesCents: number | null;
  netProfitCents: number | null;
  cautiousNetProfitCents: number | null;
  netMarginPct: number | null;
  roiPct: number | null;
  maxBuyCents: number | null;
  minResaleCents: number | null;
  confidence: number;
  confidenceLevel: ConfidenceLevel;
  risk: RiskLevel | null;
  risks: string[];
  priceVsMarketPct: number | null;
  priceFlag: 'underpriced' | 'overpriced' | null;
  conditions: string[];
  justification: string[];
  resaleDelayDays: null; // non mesuré : aucune durée de vente n'est saisie
  signature: string;
}

const confidenceLevel = (c: number): ConfidenceLevel => (c < 0.4 ? 'low' : c < 0.7 ? 'medium' : 'high');

/** Confiance de l'estimation (0 à 1) : nombre et nature des comparables, dispersion des prix. */
function estimateConfidence(est: ResaleEstimate, dispersion: number | null): number {
  if (est.status !== 'ok') return 0;
  let c =
    est.basis === 'sold'
      ? Math.min(0.9, 0.5 + 0.08 * (Math.min(est.soldCount, 10) - MIN_COMPARABLES))
      : Math.min(0.5, 0.3 + 0.04 * (Math.min(est.count, 10) - MIN_COMPARABLES));
  if (dispersion !== null) c *= 1 - Math.min(0.4, dispersion * 0.5);
  return Math.round(c * 100) / 100;
}

function insufficient(input: EvaluationInput, estimate: ResaleEstimate, reason: string): Evaluation {
  const missing = Math.max(0, MIN_COMPARABLES - estimate.count);
  return {
    recommendation: 'insufficient',
    recommendationLabel: RECOMMENDATION_LABEL.insufficient,
    score: null,
    criteria: [],
    estimate,
    purchaseCents: input.listing.priceCents,
    resaleEstimateCents: null,
    feesCents: null,
    netProfitCents: null,
    cautiousNetProfitCents: null,
    netMarginPct: null,
    roiPct: null,
    maxBuyCents: null,
    minResaleCents: null,
    confidence: 0,
    confidenceLevel: 'low',
    risk: null,
    risks: [],
    priceVsMarketPct: null,
    priceFlag: null,
    conditions: [
      missing > 0
        ? `Ajouter au moins ${missing} comparable(s) (idéalement des ventes réalisées) pour estimer la revente`
        : 'Renseigner le prix demandé',
    ],
    justification: [reason, 'Aucun score n\'est attribué sans données essentielles : rien n\'est inventé.'],
    resaleDelayDays: null,
    signature: `insufficient|${input.listing.priceCents ?? ''}|${estimate.count}`,
  };
}

export function evaluateListing(input: EvaluationInput): Evaluation {
  const now = input.now ?? new Date();
  const s = input.settings;
  const price = input.listing.priceCents;
  const estimate = estimateResale(input.comparables.map((c) => ({ priceCents: c.priceCents, kind: c.kind })));

  if (price === null || price < 0) return insufficient(input, estimate, 'Prix demandé inconnu : évaluation impossible.');
  if (estimate.status !== 'ok' || estimate.medianCents === null || estimate.medianCents <= 0) {
    return insufficient(input, estimate, estimate.warnings[0] ?? INSUFFICIENT_LABEL);
  }

  const median = estimate.medianCents;
  const profitInput = { salePriceCents: median, purchasePriceCents: price, fee: s.fee, otherCostsCents: s.otherCostsCents };
  const realistic = computeProfit(profitInput);
  const cautious = computeScenarios(profitInput).cautious;
  const maxBuy = maxPurchasePrice({ salePriceCents: median, fee: s.fee, otherCostsCents: s.otherCostsCents, minProfitCents: s.minProfitCents });
  const minResale = minResalePrice({ purchasePriceCents: price, fee: s.fee, otherCostsCents: s.otherCostsCents, minProfitCents: s.minProfitCents });

  const priceVsMarketPct = Math.round(((price - median) / median) * 1000) / 10;
  const priceFlag = priceVsMarketPct <= UNDERPRICED_PCT ? 'underpriced' : priceVsMarketPct >= OVERPRICED_PCT ? 'overpriced' : null;
  const dispersion =
    estimate.lowCents !== null && estimate.highCents !== null ? (estimate.highCents - estimate.lowCents) / median : null;
  const confidence = estimateConfidence(estimate, dispersion);

  // Ventes réalisées récentes (demande)
  const windowStart = now.getTime() - DEMAND_WINDOW_DAYS * 86_400_000;
  const recentSoldCount = input.comparables.filter((c) => {
    if (c.kind !== 'sold' || !c.observedAt) return false;
    const t = new Date(c.observedAt).getTime();
    return Number.isFinite(t) && t >= windowStart && t <= now.getTime() + 86_400_000;
  }).length;

  const a = input.analysis;
  const { score, criteria } = computeScore(
    {
      netProfitCents: realistic.netProfitCents,
      roiPct: realistic.roiPct,
      minProfitCents: s.minProfitCents,
      minRoiPct: s.minRoiPct,
      soldCount: estimate.soldCount,
      recentSoldCount,
      dispersion,
      listing: {
        hasUrl: Boolean(input.listing.url),
        descriptionLength: (input.listing.description ?? '').trim().length,
        hasLocation: Boolean(input.listing.location),
      },
      analysis: {
        present: a !== null,
        sufficientData: a?.sufficientData ?? false,
        confidence: a?.confidence ?? null,
        riskFlagCount: a?.riskFlags.length ?? 0,
        visibleDefectCount: a?.visibleDefects.length ?? 0,
      },
      declaredCondition: input.listing.condition,
    },
    s.weights,
  );

  // --- Risques ---
  let riskPoints = 0;
  const risks: string[] = [];
  const addRisk = (points: number, text: string) => {
    riskPoints += points;
    risks.push(text);
  };
  if (estimate.basis === 'asking') addRisk(1, 'Estimation fondée sur des prix affichés, pas sur des ventes réalisées');
  if (estimate.count < 5) addRisk(1, `Peu de comparables (${estimate.count})`);
  if (!a) addRisk(1, "Annonce non analysée par l'IA");
  else {
    if (!a.sufficientData) addRisk(2, "Analyse IA : données insuffisantes sur le produit ou son état");
    if (a.riskFlags.length >= 3) riskPoints += 2;
    else if (a.riskFlags.length >= 1) riskPoints += 1;
    risks.push(...a.riskFlags);
    if (a.visibleDefects.length >= 2) addRisk(1, `${a.visibleDefects.length} défauts visibles signalés`);
  }
  if (!input.listing.condition || input.listing.condition.trim().toLowerCase() === 'inconnu') addRisk(1, 'État du produit non précisé');
  if ((input.listing.description ?? '').trim().length < 40) addRisk(1, "Description absente ou très courte");
  if (priceVsMarketPct <= SUSPICIOUS_LOW_PCT) addRisk(2, "Prix très inférieur au marché : vérifier authenticité, état et fiabilité du vendeur");
  if (cautious.netProfitCents < 0) addRisk(2, 'Perte possible en scénario prudent');
  else if (cautious.netProfitCents < s.minProfitCents) addRisk(1, 'Bénéfice sous le seuil en scénario prudent');
  if (dispersion !== null && dispersion > 0.4) addRisk(1, 'Prix observés très dispersés');
  const risk: RiskLevel = riskPoints <= 2 ? 'low' : riskPoints <= 5 ? 'medium' : 'high';

  // --- Recommandation ---
  const roiOk = realistic.roiPct === null ? realistic.netProfitCents > 0 : realistic.roiPct >= s.minRoiPct;
  const meets = realistic.netProfitCents >= s.minProfitCents && roiOk;
  const budgetExceeded = s.maxPerItemCents > 0 && price > s.maxPerItemCents;

  let recommendation: Recommendation;
  if (realistic.netProfitCents <= 0 || score < SCORE_AVOID) recommendation = 'avoid';
  else if (score >= SCORE_EXCELLENT && meets && cautious.netProfitCents >= s.minProfitCents && confidence >= 0.6 && risk !== 'high' && !budgetExceeded)
    recommendation = 'excellent';
  else if (score >= SCORE_GOOD && meets && risk !== 'high' && !budgetExceeded) recommendation = 'good';
  else if (score >= SCORE_CONDITIONAL) recommendation = 'conditional';
  else recommendation = 'poor';

  // --- Conditions pour que l'achat devienne raisonnable ---
  const conditions: string[] = [];
  if (price > maxBuy) {
    conditions.push(
      maxBuy > 0
        ? `Négocier à ${formatEuros(maxBuy)} maximum (prix demandé : ${formatEuros(price)})`
        : "Aucun prix d'achat n'atteint le bénéfice minimum avec cette estimation de revente",
    );
  }
  if (budgetExceeded) conditions.push(`Prix supérieur au budget maximal par article (${formatEuros(s.maxPerItemCents)})`);
  if (confidence < 0.5) conditions.push("Ajouter des ventes réalisées pour fiabiliser l'estimation");
  if (!a || !a.sufficientData) conditions.push("Lancer ou compléter l'analyse du produit (photos, description)");
  if (risk === 'high') conditions.push("Vérifier l'état et l'authenticité avant tout achat");

  // --- Justification ---
  const justification: string[] = [
    `Prix demandé ${formatEuros(price)} ; revente estimée ${formatEuros(median)} (${
      estimate.basis === 'sold' ? 'ventes réalisées' : 'prix affichés'
    }, ${estimate.count} comparable(s)), soit ${priceVsMarketPct > 0 ? '+' : ''}${priceVsMarketPct} % par rapport à l'estimation.`,
    `Bénéfice net estimé ${formatEuros(realistic.netProfitCents)} (prudent : ${formatEuros(cautious.netProfitCents)}), marge ${formatPct(
      realistic.marginPct,
    )}, rendement ${formatPct(realistic.roiPct)}.`,
    `Prix d'achat maximal conseillé : ${formatEuros(maxBuy)}.`,
    `Score ${score}/100 : ${criteria.filter((c) => c.measured).length} critère(s) mesuré(s) sur ${criteria.length}.`,
    `Confiance de l'estimation : ${CONFIDENCE_LABEL[confidenceLevel(confidence)].toLowerCase()} (${Math.round(confidence * 100)} %) ; risque : ${RISK_LABEL[risk].toLowerCase()}.`,
  ];
  if (priceFlag === 'underpriced') justification.push(`Annonce potentiellement sous-évaluée (${Math.abs(priceVsMarketPct)} % sous l'estimation de revente).`);
  if (priceFlag === 'overpriced') justification.push(`Prix anormalement élevé : ${priceVsMarketPct} % au-dessus de l'estimation de revente.`);
  const unmeasured = criteria.filter((c) => !c.measured).map((c) => c.label.toLowerCase());
  if (unmeasured.length > 0) justification.push(`Critères non mesurés (0 point) : ${unmeasured.join(', ')}.`);
  justification.push('Délai de revente : non mesuré (aucune durée de vente saisie).');

  return {
    recommendation,
    recommendationLabel: RECOMMENDATION_LABEL[recommendation],
    score,
    criteria,
    estimate,
    purchaseCents: price,
    resaleEstimateCents: median,
    feesCents: realistic.feesCents,
    netProfitCents: realistic.netProfitCents,
    cautiousNetProfitCents: cautious.netProfitCents,
    netMarginPct: realistic.marginPct,
    roiPct: realistic.roiPct,
    maxBuyCents: maxBuy,
    minResaleCents: minResale,
    confidence,
    confidenceLevel: confidenceLevel(confidence),
    risk,
    risks,
    priceVsMarketPct,
    priceFlag,
    conditions,
    justification,
    resaleDelayDays: null,
    signature: [score, recommendation, realistic.netProfitCents, maxBuy, confidence, price, estimate.count, estimate.medianCents, risk].join('|'),
  };
}
