/**
 * Estimation du prix de revente à partir des comparables saisis par l'utilisateur.
 * Règles :
 *  - un prix de vente RÉALISÉ ("sold") vaut mieux qu'un prix AFFICHÉ ("asking") ;
 *  - chaque comparable est pondéré par sa pertinence, sa récence, la nature du prix et la proximité d'état ;
 *  - sous le minimum de comparables : « Estimation indisponible », rien n'est inventé.
 * Résultat = estimation, jamais un prix garanti. Médiane et quartiles sont PONDÉRÉS (pas d'interpolation :
 * on retient une valeur réellement observée, la plus basse en cas d'égalité, donc prudente).
 */

export type PriceKind = 'asking' | 'sold';

export interface ComparableInput {
  priceCents: number;
  kind: PriceKind;
  relevance?: number | null; // 0 à 1 : proximité du modèle (1 = identique)
  observedAt?: string | null; // date de collecte (ISO)
  condition?: string | null;
}

export interface EstimateOptions {
  now?: Date;
  targetCondition?: string | null;
  min?: number;
}

export const MIN_COMPARABLES = 3;
export const INSUFFICIENT_LABEL = 'Estimation indisponible';
export const ASKING_WEIGHT = 0.6; // un prix affiché pèse 60 % d'une vente réalisée
export const RECENCY_HALF_LIFE_DAYS = 90;
export const RECENCY_FLOOR = 0.25;
export const STALE_DAYS = 90;

export interface ResaleEstimate {
  status: 'ok' | 'insufficient';
  medianCents: number | null;
  lowCents: number | null; // 1er quartile pondéré
  highCents: number | null; // 3e quartile pondéré
  basis: 'sold' | 'asking' | null;
  count: number;
  soldCount: number;
  askingCount: number;
  evidenceWeight: number; // somme des poids des comparables retenus
  newestAgeDays: number | null; // ancienneté du comparable le plus récent
  warnings: string[];
}

const DAY = 86_400_000;
const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));

function ageDays(c: ComparableInput, now: Date): number | null {
  if (!c.observedAt) return null;
  const t = new Date(c.observedAt).getTime();
  return Number.isFinite(t) ? Math.max(0, (now.getTime() - t) / DAY) : null;
}

function weightOf(c: ComparableInput, now: Date, targetCondition?: string | null): number {
  const kind = c.kind === 'sold' ? 1 : ASKING_WEIGHT;
  const relevance = clamp(Number.isFinite(c.relevance as number) ? (c.relevance as number) : 1, 0.1, 1);
  const age = ageDays(c, now);
  const recency = age === null ? 0.7 : Math.max(RECENCY_FLOOR, Math.pow(0.5, age / RECENCY_HALF_LIFE_DAYS));
  let condition = 0.9; // état inconnu : léger doute
  if (targetCondition && c.condition) {
    condition = targetCondition.trim().toLowerCase() === c.condition.trim().toLowerCase() ? 1 : 0.8;
  }
  return kind * relevance * recency * condition;
}

/** Percentile pondéré : première valeur dont le poids cumulé atteint p × poids total. */
export function weightedPercentile(items: { value: number; weight: number }[], p: number): number {
  const sorted = [...items].sort((a, b) => a.value - b.value);
  const total = sorted.reduce((s, x) => s + x.weight, 0);
  let cum = 0;
  for (const x of sorted) {
    cum += x.weight;
    if (cum >= p * total - 1e-9) return x.value;
  }
  return sorted[sorted.length - 1].value;
}

export function estimateResale(comparables: ComparableInput[], opts: EstimateOptions = {}): ResaleEstimate {
  const now = opts.now ?? new Date();
  const min = opts.min ?? MIN_COMPARABLES;
  const valid = comparables.filter((c) => Number.isFinite(c.priceCents) && c.priceCents > 0);
  const sold = valid.filter((c) => c.kind === 'sold');
  const counts = { count: valid.length, soldCount: sold.length, askingCount: valid.length - sold.length };

  let basis: 'sold' | 'asking';
  let used: ComparableInput[];
  const warnings: string[] = [];

  if (sold.length >= min) {
    basis = 'sold';
    used = sold;
  } else if (valid.length >= min) {
    basis = 'asking';
    used = valid;
    warnings.push(
      'Fondée sur des prix affichés (pas des ventes réalisées) : peut être trop optimiste. Ajoute des ventes réalisées si possible.',
    );
  } else {
    return {
      status: 'insufficient',
      medianCents: null,
      lowCents: null,
      highCents: null,
      basis: null,
      ...counts,
      evidenceWeight: 0,
      newestAgeDays: null,
      warnings: [`${INSUFFICIENT_LABEL} : ${valid.length} comparable(s) valide(s) sur ${min} minimum.`],
    };
  }

  const items = used.map((c) => ({ value: c.priceCents, weight: weightOf(c, now, opts.targetCondition) }));
  const ages = used.map((c) => ageDays(c, now)).filter((a): a is number => a !== null);
  return {
    status: 'ok',
    medianCents: weightedPercentile(items, 0.5),
    lowCents: weightedPercentile(items, 0.25),
    highCents: weightedPercentile(items, 0.75),
    basis,
    ...counts,
    evidenceWeight: Math.round(items.reduce((s, x) => s + x.weight, 0) * 100) / 100,
    newestAgeDays: ages.length > 0 ? Math.round(Math.min(...ages)) : null,
    warnings,
  };
}
