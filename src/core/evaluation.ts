/**
 * Moteur d'évaluation d'une annonce : estimation, rentabilité, score, risque, confiance et recommandation.
 * Fonction pure : mêmes entrées, même résultat. Aucune donnée n'est inventée ; sans comparables suffisants
 * l'annonce est « non évaluable ». Tout résultat est une ESTIMATION, jamais un gain garanti.
 * Le score et la confiance sont deux notions distinctes : le score juge l'opportunité, la confiance juge la fiabilité des données.
 */
import { computeScenarioSet, maxPurchasePrice, minResalePrice } from './profitability.ts';
import type { CostBreakdown, FeeModel, ScenarioSet } from './profitability.ts';
import { estimateResale, INSUFFICIENT_LABEL, MIN_COMPARABLES, STALE_DAYS } from './estimate.ts';
import type { ComparableInput, ResaleEstimate } from './estimate.ts';
import { computeScore, DEMAND_WINDOW_DAYS } from './scoring.ts';
import type { CriterionResult, ScoringWeights } from './scoring.ts';
import { formatEuros, formatPct } from './format.ts';

export type Recommendation = 'excellent' | 'good' | 'conditional' | 'poor' | 'avoid' | 'insufficient';
export type RiskLevel = 'low' | 'medium' | 'high';
export type ConfidenceLevel = 'low' | 'medium' | 'high';
export type Action = 'buy' | 'watch' | 'negotiate' | 'avoid' | 'insufficient';
export type ScoreBand = 'excellent' | 'interesting' | 'study' | 'low' | 'unevaluable';

export const RECOMMENDATION_LABEL: Record<Recommendation, string> = {
  excellent: 'Excellente affaire',
  good: 'Bonne affaire',
  conditional: 'Affaire intéressante sous conditions',
  poor: 'Peu intéressante',
  avoid: 'À éviter',
  insufficient: 'Non évaluable',
};
export const ACTION_LABEL: Record<Action, string> = {
  buy: 'Acheter',
  watch: 'À surveiller',
  negotiate: 'À négocier',
  avoid: 'Ne pas acheter',
  insufficient: 'Non évaluable',
};
export const BAND_LABEL: Record<ScoreBand, string> = {
  excellent: 'Excellente opportunité',
  interesting: 'Opportunité intéressante',
  study: 'À étudier',
  low: 'Peu intéressante',
  unevaluable: 'Non évaluable',
};
export const BAND_RANK: Record<ScoreBand, number> = { unevaluable: 0, low: 1, study: 2, interesting: 3, excellent: 4 };
export const RISK_LABEL: Record<RiskLevel, string> = { low: 'Faible', medium: 'Moyen', high: 'Élevé' };
export const CONFIDENCE_LABEL: Record<ConfidenceLevel, string> = { low: 'Faible', medium: 'Moyenne', high: 'Élevée' };

// Seuils (documentés dans docs/ARCHITECTURE.md ; à recalibrer avec l'expérience).
export const SCORE_EXCELLENT = 80;
export const SCORE_GOOD = 65;
export const SCORE_CONDITIONAL = 50;
export const SCORE_AVOID = 35;
export const EVIDENCE_CAP = 49; // sans analyse IA suffisante, le score ne dépasse jamais « peu intéressante »
export const LOSS_CAP = 20; // bénéfice net estimé ≤ 0
export const UNDERPRICED_PCT = -25; // prix demandé ≥ 25 % sous l'estimation : annonce potentiellement sous-évaluée
export const OVERPRICED_PCT = 15; // prix demandé ≥ 15 % au-dessus de l'estimation : prix anormalement élevé
export const SUSPICIOUS_LOW_PCT = -50; // ≥ 50 % sous l'estimation : vérifier authenticité et état
export const PRUDENT_DISCOUNT = 0.85; // décote minimale du scénario prudent

export function scoreBand(score: number | null): ScoreBand {
  if (score === null) return 'unevaluable';
  return score >= SCORE_EXCELLENT ? 'excellent' : score >= SCORE_GOOD ? 'interesting' : score >= SCORE_CONDITIONAL ? 'study' : 'low';
}

export const confidenceLevelOf = (c: number): ConfidenceLevel => (c < 0.4 ? 'low' : c < 0.7 ? 'medium' : 'high');

/** Action suggérée affichée à l'utilisateur, dérivée de la recommandation et du prix d'achat maximal. */
export function deriveAction(rec: Recommendation, priceCents: number | null, maxBuyCents: number | null): Action {
  switch (rec) {
    case 'excellent':
    case 'good':
      return 'buy';
    case 'conditional':
      return priceCents !== null && maxBuyCents !== null && priceCents > maxBuyCents ? 'negotiate' : 'watch';
    case 'poor':
      return 'watch';
    case 'avoid':
      return 'avoid';
    default:
      return 'insufficient';
  }
}

export interface EvaluationInput {
  listing: {
    priceCents: number | null;
    condition: string | null;
    description: string | null;
    url: string | null;
    location: string | null;
  };
  comparables: ComparableInput[];
  analysis: { confidence: number | null; sufficientData: boolean; visibleDefects: string[]; riskFlags: string[] } | null;
  settings: CostBreakdown & {
    minProfitCents: number;
    minRoiPct: number;
    maxPerItemCents: number;
    fee: FeeModel;
    weights?: Partial<ScoringWeights>;
  };
  now?: Date;
}

export interface CostSummary {
  purchaseCents: number;
  purchaseShippingCents: number;
  cleaningCents: number;
  otherCents: number;
  acquisitionCostCents: number;
  platformFeesCents: number;
  saleShippingCents: number;
  totalCostCents: number;
}

export interface Evaluation {
  recommendation: Recommendation;
  recommendationLabel: string;
  action: Action;
  actionLabel: string;
  band: ScoreBand;
  bandLabel: string;
  summary: string;
  score: number | null;
  rawScore: number | null; // avant plafonds
  scoreCap: { value: number; reasons: string[] } | null;
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
  minResaleCents: number | null; // pour atteindre le bénéfice minimum
  breakEvenCents: number | null; // seuil d'équilibre (bénéfice nul)
  costs: CostSummary | null;
  scenarios: ScenarioSet | null;
  scenarioNotes: string[];
  confidence: number;
  confidenceLevel: ConfidenceLevel;
  risk: RiskLevel | null;
  risks: string[];
  evidenceGaps: string[];
  staleComparables: boolean;
  priceVsMarketPct: number | null;
  priceFlag: 'underpriced' | 'overpriced' | null;
  conditions: string[];
  justification: string[];
  resaleDelayDays: null; // non mesuré : aucune durée de vente n'est saisie
  signature: string;
}

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
    action: 'insufficient',
    actionLabel: ACTION_LABEL.insufficient,
    band: 'unevaluable',
    bandLabel: BAND_LABEL.unevaluable,
    summary: reason,
    score: null,
    rawScore: null,
    scoreCap: null,
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
    breakEvenCents: null,
    costs: null,
    scenarios: null,
    scenarioNotes: [],
    confidence: 0,
    confidenceLevel: 'low',
    risk: null,
    risks: [],
    evidenceGaps: [],
    staleComparables: false,
    priceVsMarketPct: null,
    priceFlag: null,
    conditions: [
      missing > 0
        ? `Ajouter au moins ${missing} comparable(s) (idéalement des ventes réalisées) pour estimer la revente`
        : 'Renseigner le prix demandé',
    ],
    justification: [reason, "Aucun score n'est attribué sans données essentielles : rien n'est inventé."],
    resaleDelayDays: null,
    signature: `insufficient|${input.listing.priceCents ?? ''}|${estimate.count}`,
  };
}

export function evaluateListing(input: EvaluationInput): Evaluation {
  const now = input.now ?? new Date();
  const s = input.settings;
  const price = input.listing.priceCents;
  const estimate = estimateResale(input.comparables, { now, targetCondition: input.listing.condition });

  if (price === null || price < 0) return insufficient(input, estimate, 'Prix demandé inconnu : évaluation impossible.');
  if (estimate.status !== 'ok' || estimate.medianCents === null || estimate.medianCents <= 0) {
    return insufficient(input, estimate, estimate.warnings[0] ?? INSUFFICIENT_LABEL);
  }

  const median = estimate.medianCents;
  const costs: CostBreakdown = {
    purchaseShippingCents: s.purchaseShippingCents,
    saleShippingCents: s.saleShippingCents,
    cleaningCents: s.cleaningCents,
    otherCostsCents: s.otherCostsCents,
  };
  const base = { purchasePriceCents: price, fee: s.fee, ...costs };

  const priceVsMarketPct = Math.round(((price - median) / median) * 1000) / 10;
  const priceFlag = priceVsMarketPct <= UNDERPRICED_PCT ? 'underpriced' : priceVsMarketPct >= OVERPRICED_PCT ? 'overpriced' : null;
  const dispersion =
    estimate.lowCents !== null && estimate.highCents !== null ? (estimate.highCents - estimate.lowCents) / median : null;
  const confidence = estimateConfidence(estimate, dispersion);

  // --- Scénarios fondés sur les données observées ---
  const prudentCents = Math.min(estimate.lowCents ?? median, Math.round(median * PRUDENT_DISCOUNT));
  const optimisticJustified =
    estimate.basis === 'sold' && estimate.soldCount >= 5 && confidence >= 0.6 && (estimate.highCents ?? 0) > median;
  const scenarios = computeScenarioSet(base, {
    prudentCents,
    centralCents: median,
    optimisticCents: optimisticJustified ? (estimate.highCents as number) : null,
  });
  const realistic = scenarios.central;
  const cautious = scenarios.prudent;
  const scenarioNotes = [
    `Prudent : revente à ${formatEuros(prudentCents)} (le plus bas entre le 1er quartile observé et −${Math.round((1 - PRUDENT_DISCOUNT) * 100)} % de l'estimation centrale).`,
    `Central : revente à ${formatEuros(median)} (médiane pondérée des comparables).`,
    optimisticJustified
      ? `Optimiste : revente à ${formatEuros(estimate.highCents ?? median)} (3e quartile des ventes réalisées, ${estimate.soldCount} ventes).`
      : "Optimiste : non affiché, les données (au moins 5 ventes réalisées et une confiance d'au moins 60 %) ne justifient pas un prix supérieur.",
  ];

  const maxBuy = maxPurchasePrice({ salePriceCents: median, fee: s.fee, minProfitCents: s.minProfitCents, ...costs });
  const minResale = minResalePrice({ purchasePriceCents: price, fee: s.fee, minProfitCents: s.minProfitCents, ...costs });
  const breakEven = minResalePrice({ purchasePriceCents: price, fee: s.fee, minProfitCents: 0, ...costs });

  // Ventes réalisées récentes (demande)
  const windowStart = now.getTime() - DEMAND_WINDOW_DAYS * 86_400_000;
  const recentSoldCount = input.comparables.filter((c) => {
    if (c.kind !== 'sold' || !c.observedAt) return false;
    const t = new Date(c.observedAt).getTime();
    return Number.isFinite(t) && t >= windowStart && t <= now.getTime() + 86_400_000;
  }).length;

  const a = input.analysis;
  const { score: rawScore, criteria } = computeScore(
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

  // --- Plafonds de prudence ---
  const evidenceGaps: string[] = [];
  if (!a) evidenceGaps.push('Analyse IA absente');
  else {
    if (!a.sufficientData) evidenceGaps.push('Analyse IA jugée insuffisante');
    if (a.confidence === null) evidenceGaps.push('Confiance IA inconnue');
  }
  let score = rawScore;
  const capReasons: string[] = [];
  let capValue: number | null = null;
  if (evidenceGaps.length > 0 && score > EVIDENCE_CAP) {
    score = EVIDENCE_CAP;
    capValue = EVIDENCE_CAP;
    capReasons.push(...evidenceGaps);
  }
  if (realistic.netProfitCents <= 0 && score > LOSS_CAP) {
    score = LOSS_CAP;
    capValue = LOSS_CAP;
    capReasons.push('Bénéfice net estimé nul ou négatif');
  }

  // --- Risques ---
  const staleComparables = estimate.newestAgeDays !== null && estimate.newestAgeDays > STALE_DAYS;
  let riskPoints = 0;
  const risks: string[] = [];
  const addRisk = (points: number, text: string) => {
    riskPoints += points;
    risks.push(text);
  };
  if (estimate.basis === 'asking') addRisk(1, 'Estimation fondée sur des prix affichés, pas sur des ventes réalisées');
  if (estimate.count < 5) addRisk(1, `Peu de comparables (${estimate.count})`);
  if (staleComparables) addRisk(1, `Comparables anciens (plus de ${STALE_DAYS} jours)`);
  if (!a) addRisk(1, "Annonce non analysée par l'IA");
  else {
    if (!a.sufficientData) addRisk(2, 'Analyse IA : données insuffisantes sur le produit ou son état');
    if (a.riskFlags.length >= 3) riskPoints += 2;
    else if (a.riskFlags.length >= 1) riskPoints += 1;
    risks.push(...a.riskFlags);
    if (a.visibleDefects.length >= 2) addRisk(1, `${a.visibleDefects.length} défauts visibles signalés`);
  }
  if (!input.listing.condition || input.listing.condition.trim().toLowerCase() === 'inconnu') addRisk(1, 'État du produit non précisé');
  if ((input.listing.description ?? '').trim().length < 40) addRisk(1, 'Description absente ou très courte');
  if (priceVsMarketPct <= SUSPICIOUS_LOW_PCT) addRisk(2, 'Prix très inférieur au marché : vérifier authenticité, état et fiabilité du vendeur');
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
  const action = deriveAction(recommendation, price, maxBuy);

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
  if (staleComparables) conditions.push('Actualiser les comparables (les plus récents ont plus de 90 jours)');
  if (risk === 'high') conditions.push("Vérifier l'état et l'authenticité avant tout achat");

  // --- Justification ---
  const c = realistic;
  const costLine = `Coût total d'acquisition ${formatEuros(c.acquisitionCostCents)} (achat ${formatEuros(price)}, livraison achat ${formatEuros(s.purchaseShippingCents ?? 0)}, remise en état ${formatEuros(
    s.cleaningCents ?? 0,
  )}, autres ${formatEuros(s.otherCostsCents ?? 0)}) ; frais de plateforme ${formatEuros(c.feesCents)} ; livraison vente ${formatEuros(c.saleShippingCents)}.`;
  const justification: string[] = [
    `Prix demandé ${formatEuros(price)} ; revente estimée ${formatEuros(median)} (${
      estimate.basis === 'sold' ? 'ventes réalisées' : 'prix affichés'
    }, ${estimate.count} comparable(s)), soit ${priceVsMarketPct > 0 ? '+' : ''}${priceVsMarketPct} % par rapport à l'estimation.`,
    costLine,
    `Bénéfice net estimé ${formatEuros(c.netProfitCents)} (prudent : ${formatEuros(cautious.netProfitCents)}), marge ${formatPct(c.marginPct)}, rendement ${formatPct(c.roiPct)}.`,
    `Prix d'achat maximal conseillé : ${formatEuros(maxBuy)} ; seuil d'équilibre de revente : ${breakEven === null ? '—' : formatEuros(breakEven)}.`,
    `Score ${score}/100${capValue !== null ? ` (plafonné à ${capValue} : ${capReasons.join(' ; ').toLowerCase()})` : ''} : ${criteria.filter((x) => x.measured).length} critère(s) mesuré(s) sur ${criteria.length}.`,
    `Confiance de l'estimation (distincte du score) : ${CONFIDENCE_LABEL[confidenceLevelOf(confidence)].toLowerCase()} (${Math.round(confidence * 100)} %) ; risque : ${RISK_LABEL[risk].toLowerCase()}.`,
  ];
  if (priceFlag === 'underpriced') justification.push(`Annonce potentiellement sous-évaluée (${Math.abs(priceVsMarketPct)} % sous l'estimation de revente).`);
  if (priceFlag === 'overpriced') justification.push(`Prix anormalement élevé : ${priceVsMarketPct} % au-dessus de l'estimation de revente.`);
  const unmeasured = criteria.filter((x) => !x.measured).map((x) => x.label.toLowerCase());
  if (unmeasured.length > 0) justification.push(`Critères non mesurés (0 point) : ${unmeasured.join(', ')}.`);
  justification.push('Délai de revente : non mesuré (aucune durée de vente saisie).');

  const summary =
    recommendation === 'avoid'
      ? realistic.netProfitCents <= 0
        ? "Bénéfice net estimé nul ou négatif : l'achat ne couvre pas ses coûts."
        : 'Score trop faible pour recommander cet achat.'
      : `${ACTION_LABEL[action]} : bénéfice net estimé ${formatEuros(c.netProfitCents)}, marge ${formatPct(c.marginPct)}, confiance ${CONFIDENCE_LABEL[confidenceLevelOf(confidence)].toLowerCase()}.${
          conditions.length > 0 ? ` ${conditions[0]}.` : ''
        }`;

  return {
    recommendation,
    recommendationLabel: RECOMMENDATION_LABEL[recommendation],
    action,
    actionLabel: ACTION_LABEL[action],
    band: scoreBand(score),
    bandLabel: BAND_LABEL[scoreBand(score)],
    summary,
    score,
    rawScore,
    scoreCap: capValue === null ? null : { value: capValue, reasons: capReasons },
    criteria,
    estimate,
    purchaseCents: price,
    resaleEstimateCents: median,
    feesCents: c.feesCents,
    netProfitCents: c.netProfitCents,
    cautiousNetProfitCents: cautious.netProfitCents,
    netMarginPct: c.marginPct,
    roiPct: c.roiPct,
    maxBuyCents: maxBuy,
    minResaleCents: minResale,
    breakEvenCents: breakEven,
    costs: {
      purchaseCents: price,
      purchaseShippingCents: s.purchaseShippingCents ?? 0,
      cleaningCents: s.cleaningCents ?? 0,
      otherCents: s.otherCostsCents ?? 0,
      acquisitionCostCents: c.acquisitionCostCents,
      platformFeesCents: c.feesCents,
      saleShippingCents: c.saleShippingCents,
      totalCostCents: c.totalCostCents,
    },
    scenarios,
    scenarioNotes,
    confidence,
    confidenceLevel: confidenceLevelOf(confidence),
    risk,
    risks,
    evidenceGaps,
    staleComparables,
    priceVsMarketPct,
    priceFlag,
    conditions,
    justification,
    resaleDelayDays: null,
    signature: [score, recommendation, c.netProfitCents, maxBuy, confidence, price, estimate.count, median, risk, evidenceGaps.length, scenarios.optimistic ? 1 : 0].join('|'),
  };
}
