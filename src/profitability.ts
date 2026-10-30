/**
 * Calculs de rentabilité. Logique pure, sans dépendance : testable seule.
 * Tous les montants sont des ENTIERS en centimes (aucune erreur d'arrondi flottant).
 * Un résultat est une ESTIMATION, jamais un bénéfice garanti.
 */

/** Frais d'une plateforme : pourcentage du prix de vente + montant fixe. */
export interface FeeModel {
  percent: number; // ex. 5 pour 5 %
  fixedCents: number;
}

export const NO_FEES: FeeModel = { percent: 0, fixedCents: 0 };

export function computeFees(salePriceCents: number, fee: FeeModel): number {
  if (salePriceCents <= 0) return 0;
  return Math.round((salePriceCents * fee.percent) / 100) + fee.fixedCents;
}

export interface ProfitInput {
  salePriceCents: number;
  purchasePriceCents: number;
  fee: FeeModel;
  otherCostsCents?: number; // transport, emballage, nettoyage...
}

export interface ProfitResult {
  grossProfitCents: number; // vente - achat
  feesCents: number;
  netProfitCents: number; // vente - achat - frais - autres coûts
  marginPct: number | null; // bénéfice net / prix de vente
  roiPct: number | null; // bénéfice net / capital engagé (achat + autres coûts)
}

const pct = (num: number, den: number): number | null =>
  den > 0 ? Math.round((num / den) * 1000) / 10 : null;

export function computeProfit(input: ProfitInput): ProfitResult {
  const other = input.otherCostsCents ?? 0;
  const feesCents = computeFees(input.salePriceCents, input.fee);
  const grossProfitCents = input.salePriceCents - input.purchasePriceCents;
  const netProfitCents = grossProfitCents - feesCents - other;
  const capital = input.purchasePriceCents + other;
  return {
    grossProfitCents,
    feesCents,
    netProfitCents,
    marginPct: pct(netProfitCents, input.salePriceCents),
    roiPct: pct(netProfitCents, capital),
  };
}

/**
 * Prix d'achat maximal = prix de vente estimé - frais - autres coûts - bénéfice minimum.
 * Jamais négatif.
 */
export function maxPurchasePrice(args: {
  salePriceCents: number;
  fee: FeeModel;
  otherCostsCents?: number;
  minProfitCents: number;
}): number {
  const other = args.otherCostsCents ?? 0;
  const fees = computeFees(args.salePriceCents, args.fee);
  return Math.max(0, args.salePriceCents - fees - other - args.minProfitCents);
}

/**
 * Prix de revente minimum pour atteindre le bénéfice minimum, à prix d'achat donné.
 * Résout : vente - (vente * p/100 + fixe) - achat - autres = minProfit.
 * Renvoie null si les frais en pourcentage atteignent 100 % (équation sans solution).
 */
export function minResalePrice(args: {
  purchasePriceCents: number;
  fee: FeeModel;
  otherCostsCents?: number;
  minProfitCents: number;
}): number | null {
  const rate = args.fee.percent / 100;
  if (rate >= 1) return null;
  const other = args.otherCostsCents ?? 0;
  const needed = args.purchasePriceCents + other + args.minProfitCents + args.fee.fixedCents;
  const profitAt = (p: number) => p - computeFees(p, args.fee) - args.purchasePriceCents - other;
  let price = Math.ceil(needed / (1 - rate));
  // Les frais sont arrondis au centime : on ajuste pour obtenir le plus petit prix qui convient.
  while (profitAt(price) < args.minProfitCents) price += 1;
  while (price > 0 && profitAt(price - 1) >= args.minProfitCents) price -= 1;
  return price;
}

export type ScenarioName = 'optimistic' | 'realistic' | 'cautious';

/** Coefficients appliqués au prix de revente estimé. Modifiables dans les paramètres. */
export const DEFAULT_SCENARIO_FACTORS: Record<ScenarioName, number> = {
  optimistic: 1.1,
  realistic: 1,
  cautious: 0.85,
};

export function computeScenarios(
  base: ProfitInput,
  factors: Record<ScenarioName, number> = DEFAULT_SCENARIO_FACTORS,
): Record<ScenarioName, ProfitResult & { salePriceCents: number }> {
  const run = (name: ScenarioName) => {
    const salePriceCents = Math.round(base.salePriceCents * factors[name]);
    return { salePriceCents, ...computeProfit({ ...base, salePriceCents }) };
  };
  return { optimistic: run('optimistic'), realistic: run('realistic'), cautious: run('cautious') };
}
