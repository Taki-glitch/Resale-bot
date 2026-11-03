/**
 * Calculs de rentabilité. Logique pure, sans dépendance : testable seule.
 * Tous les montants sont des ENTIERS en centimes (aucune erreur d'arrondi flottant).
 * Un résultat est une ESTIMATION, jamais un bénéfice garanti.
 *
 * Modèle de coûts (aucun frais n'est compté deux fois) :
 *   coût d'acquisition = prix d'achat + livraison à l'achat + remise en état + autres coûts
 *   à la vente         = frais de plateforme (sur le prix de vente) + livraison supportée par le vendeur
 *   bénéfice net       = prix de vente - frais de plateforme - livraison vente - coût d'acquisition
 * Si l'acheteur paie la livraison, la livraison vente vaut 0.
 */

/** Frais d'une plateforme : pourcentage du prix de vente + montant fixe. */
export interface FeeModel {
  percent: number; // ex. 5 pour 5 %
  fixedCents: number;
}

export const NO_FEES: FeeModel = { percent: 0, fixedCents: 0 };

export interface CostBreakdown {
  purchaseShippingCents?: number; // livraison payée à l'achat
  saleShippingCents?: number; // livraison supportée par le vendeur à la revente
  cleaningCents?: number; // nettoyage, réparation, remise en état
  otherCostsCents?: number; // emballage, autres
}

export function computeFees(salePriceCents: number, fee: FeeModel): number {
  if (salePriceCents <= 0) return 0;
  return Math.round((salePriceCents * fee.percent) / 100) + fee.fixedCents;
}

const n = (x?: number): number => (Number.isFinite(x) && (x as number) > 0 ? (x as number) : 0);

/** Coût total d'acquisition (capital engagé avant la revente). */
export function acquisitionCost(i: { purchasePriceCents: number } & CostBreakdown): number {
  return i.purchasePriceCents + n(i.purchaseShippingCents) + n(i.cleaningCents) + n(i.otherCostsCents);
}

export interface ProfitInput extends CostBreakdown {
  salePriceCents: number;
  purchasePriceCents: number;
  fee: FeeModel;
}

export interface ProfitResult {
  grossProfitCents: number; // vente - prix d'achat
  feesCents: number; // frais de plateforme à la vente
  saleShippingCents: number;
  acquisitionCostCents: number;
  totalCostCents: number; // acquisition + frais de plateforme + livraison vente
  netProfitCents: number;
  marginPct: number | null; // bénéfice net / prix de vente
  roiPct: number | null; // bénéfice net / coût d'acquisition
}

const pct = (num: number, den: number): number | null =>
  den > 0 ? Math.round((num / den) * 1000) / 10 : null;

export function computeProfit(input: ProfitInput): ProfitResult {
  const feesCents = computeFees(input.salePriceCents, input.fee);
  const saleShippingCents = n(input.saleShippingCents);
  const acquisitionCostCents = acquisitionCost(input);
  const netProfitCents = input.salePriceCents - feesCents - saleShippingCents - acquisitionCostCents;
  return {
    grossProfitCents: input.salePriceCents - input.purchasePriceCents,
    feesCents,
    saleShippingCents,
    acquisitionCostCents,
    totalCostCents: acquisitionCostCents + feesCents + saleShippingCents,
    netProfitCents,
    marginPct: pct(netProfitCents, input.salePriceCents),
    roiPct: pct(netProfitCents, acquisitionCostCents),
  };
}

/** Prix d'achat maximal = vente - frais - livraison vente - autres coûts d'acquisition - bénéfice minimum (jamais négatif). */
export function maxPurchasePrice(args: { salePriceCents: number; fee: FeeModel; minProfitCents: number } & CostBreakdown): number {
  const fees = computeFees(args.salePriceCents, args.fee);
  const otherCosts = n(args.purchaseShippingCents) + n(args.cleaningCents) + n(args.otherCostsCents) + n(args.saleShippingCents);
  return Math.max(0, args.salePriceCents - fees - otherCosts - args.minProfitCents);
}

/**
 * Prix de revente minimum pour atteindre `minProfitCents` à prix d'achat donné
 * (0 = seuil d'équilibre). Null si les frais en pourcentage atteignent 100 %.
 */
export function minResalePrice(args: { purchasePriceCents: number; fee: FeeModel; minProfitCents: number } & CostBreakdown): number | null {
  const rate = args.fee.percent / 100;
  if (rate >= 1) return null;
  const acquisition = acquisitionCost(args);
  const shipping = n(args.saleShippingCents);
  const profitAt = (p: number) => p - computeFees(p, args.fee) - shipping - acquisition;
  let price = Math.ceil((acquisition + shipping + args.minProfitCents + args.fee.fixedCents) / (1 - rate));
  // Les frais sont arrondis au centime : on ajuste pour obtenir le plus petit prix qui convient.
  while (profitAt(price) < args.minProfitCents) price += 1;
  while (price > 0 && profitAt(price - 1) >= args.minProfitCents) price -= 1;
  return price;
}

export type ScenarioName = 'optimistic' | 'realistic' | 'cautious';

/** Coefficients de simulation MANUELLE (calculateur libre). L'évaluation d'annonce utilise les données observées. */
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

export interface ScenarioSet {
  prudent: ProfitResult & { salePriceCents: number };
  central: ProfitResult & { salePriceCents: number };
  /** null tant que les données ne justifient pas un prix de revente supérieur à l'estimation centrale. */
  optimistic: (ProfitResult & { salePriceCents: number }) | null;
}

/** Trois scénarios à partir de prix de revente explicites (issus des données observées). */
export function computeScenarioSet(
  base: Omit<ProfitInput, 'salePriceCents'>,
  prices: { prudentCents: number; centralCents: number; optimisticCents: number | null },
): ScenarioSet {
  const run = (salePriceCents: number) => ({ salePriceCents, ...computeProfit({ ...base, salePriceCents }) });
  return {
    prudent: run(prices.prudentCents),
    central: run(prices.centralCents),
    optimistic: prices.optimisticCents === null ? null : run(prices.optimisticCents),
  };
}
