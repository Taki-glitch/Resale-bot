/**
 * Estimation du prix de revente à partir des comparables saisis par l'utilisateur.
 * Règles :
 *  - un prix de vente RÉALISÉ ("sold") vaut mieux qu'un prix AFFICHÉ ("asking") ;
 *  - sous le minimum de comparables, on n'invente rien : "Estimation insuffisamment documentée".
 * Résultat = estimation, jamais un prix garanti.
 */

export type PriceKind = 'asking' | 'sold';

export interface ComparableInput {
  priceCents: number;
  kind: PriceKind;
}

export const MIN_COMPARABLES = 3;
export const INSUFFICIENT_LABEL = 'Estimation insuffisamment documentée';

export interface ResaleEstimate {
  status: 'ok' | 'insufficient';
  medianCents: number | null;
  lowCents: number | null; // 1er quartile
  highCents: number | null; // 3e quartile
  basis: 'sold' | 'asking' | null;
  count: number;
  soldCount: number;
  askingCount: number;
  warnings: string[];
}

/** Percentile par interpolation linéaire (tableau trié, p entre 0 et 1). */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 1) return sorted[0];
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return Math.round(sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo));
}

export function estimateResale(comparables: ComparableInput[], min: number = MIN_COMPARABLES): ResaleEstimate {
  const valid = comparables.filter((c) => Number.isFinite(c.priceCents) && c.priceCents > 0);
  const sold = valid.filter((c) => c.kind === 'sold');
  const asking = valid.filter((c) => c.kind === 'asking');
  const counts = { count: valid.length, soldCount: sold.length, askingCount: asking.length };

  let basis: 'sold' | 'asking';
  let prices: number[];
  const warnings: string[] = [];

  if (sold.length >= min) {
    basis = 'sold';
    prices = sold.map((c) => c.priceCents);
  } else if (valid.length >= min) {
    basis = 'asking';
    prices = valid.map((c) => c.priceCents);
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
      warnings: [`${INSUFFICIENT_LABEL} : ${valid.length} comparable(s) valide(s) sur ${min} minimum.`],
    };
  }

  const sorted = [...prices].sort((a, b) => a - b);
  return {
    status: 'ok',
    medianCents: percentile(sorted, 0.5),
    lowCents: percentile(sorted, 0.25),
    highCents: percentile(sorted, 0.75),
    basis,
    ...counts,
    warnings,
  };
}
