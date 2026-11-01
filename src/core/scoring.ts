/**
 * Score explicable sur 100.
 * Règle de prudence : un critère NON MESURÉ rapporte 0 point (jamais de note flatteuse sans données).
 * Le score maximal atteignable dépend donc des données réellement disponibles.
 */
import { formatEuros } from './format.ts';

export type CriterionKey = 'margin' | 'demand' | 'resale' | 'reliability' | 'condition' | 'logistics';
export type ScoringWeights = Record<CriterionKey, number>;

export const CRITERIA_KEYS: CriterionKey[] = ['margin', 'demand', 'resale', 'reliability', 'condition', 'logistics'];

export const DEFAULT_WEIGHTS: ScoringWeights = {
  margin: 30,
  demand: 25,
  resale: 15,
  reliability: 15,
  condition: 10,
  logistics: 5,
};

export const CRITERIA_LABEL: Record<CriterionKey, string> = {
  margin: 'Marge potentielle',
  demand: 'Demande du produit',
  resale: 'Facilité de revente',
  reliability: "Fiabilité de l'annonce",
  condition: 'État du produit',
  logistics: 'Logistique',
};

/** Ramène des poids saisis à un total de 100 (valeurs invalides ou négatives = 0 ; tout à 0 = défauts). */
export function normalizeWeights(w?: Partial<ScoringWeights>): ScoringWeights {
  const merged = { ...DEFAULT_WEIGHTS, ...(w ?? {}) };
  const clean = {} as ScoringWeights;
  let sum = 0;
  for (const k of CRITERIA_KEYS) {
    const v = Number(merged[k]);
    clean[k] = Number.isFinite(v) && v > 0 ? v : 0;
    sum += clean[k];
  }
  if (sum <= 0) return { ...DEFAULT_WEIGHTS };
  for (const k of CRITERIA_KEYS) clean[k] = (clean[k] * 100) / sum;
  return clean;
}

export interface CriterionResult {
  key: CriterionKey;
  label: string;
  max: number;
  earned: number;
  measured: boolean;
  detail: string;
}

export interface ScoreInput {
  netProfitCents: number;
  roiPct: number | null;
  minProfitCents: number;
  minRoiPct: number;
  soldCount: number;
  recentSoldCount: number; // ventes réalisées observées sur les 90 derniers jours
  dispersion: number | null; // (Q3 - Q1) / médiane des comparables
  listing: { hasUrl: boolean; descriptionLength: number; hasLocation: boolean };
  analysis: { present: boolean; sufficientData: boolean; confidence: number | null; riskFlagCount: number; visibleDefectCount: number };
  declaredCondition: string | null;
}

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));
const ratio = (value: number, threshold: number): number => (threshold > 0 ? value / threshold : value > 0 ? 2 : 0);

const CONDITION_FRACTION: Record<string, number> = {
  'neuf avec étiquette': 1,
  'neuf sans étiquette': 0.9,
  'très bon état': 0.8,
  'bon état': 0.6,
  satisfaisant: 0.3,
};

export function conditionFraction(declared: string | null): number | null {
  if (!declared) return null;
  return CONDITION_FRACTION[declared.trim().toLowerCase()] ?? null;
}

export const DEMAND_FULL_AT = 5; // ventes réalisées récentes pour une demande jugée forte
export const DEMAND_WINDOW_DAYS = 90;
export const DISPERSION_BEST = 0.15;
export const DISPERSION_WORST = 0.6;

export function computeScore(input: ScoreInput, weights?: Partial<ScoringWeights>): { score: number; criteria: CriterionResult[] } {
  const w = normalizeWeights(weights);
  const criteria: CriterionResult[] = [];
  const add = (key: CriterionKey, fraction: number | null, detail: string) => {
    const measured = fraction !== null;
    criteria.push({
      key,
      label: CRITERIA_LABEL[key],
      max: w[key],
      earned: measured ? w[key] * clamp01(fraction) : 0,
      measured,
      detail,
    });
  };

  // Marge : 50 % des points quand les seuils sont exactement atteints, 100 % à deux fois les seuils.
  const r = Math.min(ratio(input.netProfitCents, input.minProfitCents), input.roiPct === null ? 0 : ratio(input.roiPct, input.minRoiPct));
  add(
    'margin',
    input.netProfitCents <= 0 ? 0 : r / 2,
    `Bénéfice net ${formatEuros(input.netProfitCents)} (seuil ${formatEuros(input.minProfitCents)}), rendement ${
      input.roiPct === null ? '—' : `${input.roiPct} %`
    } (seuil ${input.minRoiPct} %)`,
  );

  // Demande : seulement mesurable avec au moins 3 ventes réalisées saisies.
  if (input.soldCount >= 3) {
    add('demand', input.recentSoldCount / DEMAND_FULL_AT, `${input.recentSoldCount} vente(s) réalisée(s) sur ${DEMAND_WINDOW_DAYS} jours (${DEMAND_FULL_AT} = demande forte)`);
  } else {
    add('demand', null, 'Non mesurée : moins de 3 ventes réalisées saisies parmi les comparables');
  }

  // Facilité de revente : stabilité des prix observés (le délai de vente réel n'est pas mesuré).
  if (input.dispersion !== null) {
    add(
      'resale',
      (DISPERSION_WORST - input.dispersion) / (DISPERSION_WORST - DISPERSION_BEST),
      `Dispersion des prix observés : ${Math.round(input.dispersion * 100)} % (plus c'est bas, plus le prix est prévisible)`,
    );
  } else {
    add('resale', null, 'Non mesurée : pas assez de comparables');
  }

  // Fiabilité de l'annonce : complétude + analyse IA, moins 2 points par signal de risque.
  const a = input.analysis;
  let pts = 0;
  if (input.listing.hasUrl) pts += 2;
  if (input.listing.descriptionLength >= 80) pts += 3;
  if (input.listing.hasLocation) pts += 1;
  if (a.present) pts += 3;
  if (a.present && a.sufficientData) pts += 3;
  if (a.present && (a.confidence ?? 0) >= 0.7) pts += 3;
  pts = Math.max(0, pts - 2 * a.riskFlagCount);
  add('reliability', pts / 15, `Lien, description, localisation et analyse IA : ${pts}/15 (${a.riskFlagCount} signal(aux) de risque)`);

  // État : état déclaré, moins 10 % par défaut visible.
  const base = conditionFraction(input.declaredCondition);
  add(
    'condition',
    base === null ? null : Math.max(0, base - 0.1 * a.visibleDefectCount),
    base === null ? 'Non mesuré : état non précisé' : `État déclaré « ${input.declaredCondition} », ${a.visibleDefectCount} défaut(s) visible(s)`,
  );

  // Logistique : taille, poids et fragilité ne sont pas encore saisis.
  add('logistics', null, 'Non mesurée : taille, poids et fragilité non renseignés (prévu dans une version ultérieure)');

  const score = Math.round(criteria.reduce((sum, c) => sum + c.earned, 0));
  return { score, criteria };
}
