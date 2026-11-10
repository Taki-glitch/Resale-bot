/** Statistiques de pilotage. Fonctions pures sur des données réelles : aucune valeur n'est estimée ni inventée. */
import { realizedProfitCents, isOwnedUnsold } from './inventory.ts';
import type { InventoryItemView, SaleView } from './inventory.ts';

export interface MonthPoint {
  month: string; // AAAA-MM
  revenueCents: number;
  netProfitCents: number;
  salesCount: number;
  cumulativeProfitCents: number;
}

export function addMonths(yyyyMm: string, delta: number): string {
  const [y, m] = yyyyMm.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Série mensuelle des `months` derniers mois jusqu'à `endMonth` inclus (mois sans vente = 0). Le bénéfice exclut les ventes au coût inconnu. */
export function monthlySeries(sales: SaleView[], endMonth: string, months = 12): MonthPoint[] {
  const keys = Array.from({ length: months }, (_, i) => addMonths(endMonth, i - (months - 1)));
  const byMonth = new Map(keys.map((k) => [k, { revenue: 0, net: 0, count: 0 }]));
  for (const s of sales) {
    const g = byMonth.get(s.soldAt.slice(0, 7));
    if (!g) continue;
    g.revenue += s.priceCents;
    g.count += 1;
    const net = realizedProfitCents(s);
    if (net !== null) g.net += net;
  }
  let cumulative = 0;
  return keys.map((month) => {
    const g = byMonth.get(month) as { revenue: number; net: number; count: number };
    cumulative += g.net;
    return { month, revenueCents: g.revenue, netProfitCents: g.net, salesCount: g.count, cumulativeProfitCents: cumulative };
  });
}

export interface FunnelCounts {
  listings: number; // annonces saisies
  evaluated: number; // évaluables
  recommended: number; // action « Acheter »
  bought: number;
  sold: number;
}

const pct = (n: number, d: number): number | null => (d > 0 ? Math.round((n / d) * 1000) / 10 : null);

export function funnelRates(f: FunnelCounts) {
  return {
    evaluatedPct: pct(f.evaluated, f.listings),
    recommendedPct: pct(f.recommended, f.evaluated),
    boughtPct: pct(f.bought, f.listings),
    soldPct: pct(f.sold, f.bought),
  };
}

export interface AgingBucket {
  label: string;
  count: number;
  costCents: number;
}

/** Répartition du stock non vendu par ancienneté (depuis la mise en stock ou l'achat). */
export function agingBuckets(items: InventoryItemView[], now: Date = new Date()): AgingBucket[] {
  const buckets: AgingBucket[] = [
    { label: '0 à 30 jours', count: 0, costCents: 0 },
    { label: '31 à 60 jours', count: 0, costCents: 0 },
    { label: '61 à 90 jours', count: 0, costCents: 0 },
    { label: 'Plus de 90 jours', count: 0, costCents: 0 },
    { label: 'Date inconnue', count: 0, costCents: 0 },
  ];
  for (const i of items) {
    if (!isOwnedUnsold(i.status)) continue;
    const start = i.inStockSince ?? i.purchasedAt;
    const t = start ? new Date(start).getTime() : NaN;
    const idx = !Number.isFinite(t) ? 4 : (() => {
      const days = (now.getTime() - t) / 86_400_000;
      return days <= 30 ? 0 : days <= 60 ? 1 : days <= 90 ? 2 : 3;
    })();
    buckets[idx].count += 1;
    if (i.purchasePriceCents !== null) buckets[idx].costCents += i.purchasePriceCents + i.purchaseFeesCents + i.expensesCents;
  }
  return buckets;
}

export function objectiveProgress(profitCents: number, targetCents: number) {
  return {
    pct: targetCents > 0 ? Math.max(0, Math.round((profitCents / targetCents) * 100)) : null,
    remainingCents: Math.max(0, targetCents - profitCents),
  };
}

/** Capital engagé = coût du stock non vendu. Budget disponible estimé = budget total − capital engagé (les gains réinvestis ne sont pas comptés). */
export function capitalUsage(totalBudgetCents: number, stockCostCents: number) {
  return {
    engagedCents: stockCostCents,
    availableCents: totalBudgetCents - stockCostCents,
    usedPct: totalBudgetCents > 0 ? Math.round((stockCostCents / totalBudgetCents) * 100) : null,
  };
}

/** Total des frais réels supportés sur les ventes : commissions, livraisons, autres coûts. */
export function sellingCostsCents(sales: SaleView[]): number {
  return sales.reduce((a, s) => a + s.feesCents + s.shippingCents + s.extraCostsCents, 0);
}
