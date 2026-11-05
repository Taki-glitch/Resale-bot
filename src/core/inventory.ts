/** Inventaire, bénéfice réalisé et synthèse des ventes. Logique pure, testée. Rien n'est estimé : un coût inconnu reste inconnu. */
import { computeFees } from './profitability.ts';
import type { FeeModel } from './profitability.ts';

export type InventoryStatus =
  | 'to_buy' | 'bought' | 'shipping' | 'received' | 'in_stock' | 'preparing' | 'listed' | 'reserved' | 'sold' | 'returned' | 'cancelled';

export const INVENTORY_STATUS_LABEL: Record<InventoryStatus, string> = {
  to_buy: 'À acheter',
  bought: 'Acheté',
  shipping: 'En livraison',
  received: 'Reçu',
  in_stock: 'En stock',
  preparing: 'En préparation',
  listed: 'Publié',
  reserved: 'Réservé',
  sold: 'Vendu',
  returned: 'Retourné',
  cancelled: 'Annulé',
};
export const INVENTORY_STATUS_ORDER: InventoryStatus[] = [
  'bought', 'shipping', 'received', 'in_stock', 'preparing', 'listed', 'reserved', 'sold', 'returned', 'cancelled', 'to_buy',
];
/** Articles possédés et non vendus : leur coût compose la valeur du stock. */
export const OWNED_UNSOLD: InventoryStatus[] = ['bought', 'shipping', 'received', 'in_stock', 'preparing', 'listed', 'reserved', 'returned'];
export const RESALE_STATUSES: InventoryStatus[] = ['received', 'in_stock', 'preparing', 'listed', 'reserved'];
export const AGING_DAYS = 60;

export interface InventoryItemView {
  id: string;
  name: string;
  status: InventoryStatus;
  category: string | null;
  purchasePriceCents: number | null; // null : achat inconnu
  purchaseFeesCents: number;
  expensesCents: number;
  plannedPriceCents: number | null;
  purchasedAt: string | null;
  inStockSince: string | null;
  platform: string | null;
}

export const isOwnedUnsold = (s: InventoryStatus): boolean => OWNED_UNSOLD.includes(s);

/** Coût total d'un article : achat + frais d'achat + dépenses. Null si le prix d'achat est inconnu. */
export function itemCostCents(i: Pick<InventoryItemView, 'purchasePriceCents' | 'purchaseFeesCents' | 'expensesCents'>): number | null {
  return i.purchasePriceCents === null ? null : i.purchasePriceCents + i.purchaseFeesCents + i.expensesCents;
}

export function stockSummary(items: InventoryItemView[]) {
  const owned = items.filter((i) => isOwnedUnsold(i.status));
  let costCents = 0;
  let unknownCost = 0;
  let plannedCents = 0;
  let unplanned = 0;
  for (const i of owned) {
    const c = itemCostCents(i);
    if (c === null) unknownCost += 1;
    else costCents += c;
    if (i.plannedPriceCents === null) unplanned += 1;
    else plannedCents += i.plannedPriceCents;
  }
  return { count: owned.length, costCents, unknownCostCount: unknownCost, plannedValueCents: plannedCents, unplannedCount: unplanned };
}

/** Articles possédés depuis plus de `days` jours sans être vendus (capital immobilisé). */
export function agedItems(items: InventoryItemView[], now: Date = new Date(), days: number = AGING_DAYS): InventoryItemView[] {
  return items.filter((i) => {
    if (!isOwnedUnsold(i.status)) return false;
    const start = i.inStockSince ?? i.purchasedAt;
    if (!start) return false;
    const t = new Date(start).getTime();
    return Number.isFinite(t) && (now.getTime() - t) / 86_400_000 > days;
  });
}

export function filterInventory(items: InventoryItemView[], f: { query: string; status: '' | InventoryStatus }): InventoryItemView[] {
  const q = f.query.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  return items.filter((i) => {
    if (f.status && i.status !== f.status) return false;
    if (q === '') return true;
    return `${i.name} ${i.category ?? ''} ${i.platform ?? ''}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(q);
  });
}

/** Bénéfice réalisé = vente - commission - livraison - autres coûts - coût d'acquisition. Null si le coût d'acquisition est inconnu. */
export function realizedProfitCents(s: {
  priceCents: number;
  feesCents: number;
  shippingCents: number;
  extraCostsCents: number;
  acquisitionCostCents: number | null;
}): number | null {
  return s.acquisitionCostCents === null ? null : s.priceCents - s.feesCents - s.shippingCents - s.extraCostsCents - s.acquisitionCostCents;
}

/** Commission proposée à partir du modèle de frais de la plateforme (modifiable par l'utilisateur). */
export const suggestedPlatformFee = (priceCents: number, fee: FeeModel): number => computeFees(priceCents, fee);

export interface SaleView {
  id: string;
  inventoryId: string | null;
  name: string;
  soldAt: string;
  priceCents: number;
  platform: string | null;
  category: string | null;
  feesCents: number;
  shippingCents: number;
  extraCostsCents: number;
  acquisitionCostCents: number | null;
  plannedPriceCents: number | null;
  daysToSell: number | null;
}

export interface GroupPerformance {
  key: string;
  count: number;
  revenueCents: number;
  netProfitCents: number;
  marginPct: number | null;
}

const pct = (n: number, d: number): number | null => (d > 0 ? Math.round((n / d) * 1000) / 10 : null);

function group(sales: (SaleView & { net: number | null })[], keyOf: (s: SaleView) => string): GroupPerformance[] {
  const map = new Map<string, { count: number; revenue: number; net: number; revenueKnown: number }>();
  for (const s of sales) {
    const k = keyOf(s);
    const g = map.get(k) ?? { count: 0, revenue: 0, net: 0, revenueKnown: 0 };
    g.count += 1;
    g.revenue += s.priceCents;
    if (s.net !== null) {
      g.net += s.net;
      g.revenueKnown += s.priceCents;
    }
    map.set(k, g);
  }
  return Array.from(map, ([key, g]) => ({ key, count: g.count, revenueCents: g.revenue, netProfitCents: g.net, marginPct: pct(g.net, g.revenueKnown) })).sort(
    (a, b) => b.netProfitCents - a.netProfitCents,
  );
}

export function summarizeSales(sales: SaleView[]) {
  const enriched = sales.map((s) => ({ ...s, net: realizedProfitCents(s) }));
  const known = enriched.filter((s) => s.net !== null);
  const revenue = sales.reduce((a, s) => a + s.priceCents, 0);
  const net = known.reduce((a, s) => a + (s.net as number), 0);
  const revenueKnown = known.reduce((a, s) => a + s.priceCents, 0);
  const totalCost = known.reduce((a, s) => a + (s.acquisitionCostCents as number), 0);
  const withPlan = sales.filter((s) => s.plannedPriceCents !== null);
  const days = sales.map((s) => s.daysToSell).filter((d): d is number => d !== null);
  return {
    count: sales.length,
    revenueCents: revenue,
    acquisitionCostCents: totalCost,
    netProfitCents: net,
    averageMarginPct: pct(net, revenueKnown),
    unknownCostCount: sales.length - known.length, // ventes dont le coût d'achat est inconnu : exclues du bénéfice
    averageDaysToSell: days.length > 0 ? Math.round(days.reduce((a, d) => a + d, 0) / days.length) : null,
    plannedVsRealized: {
      count: withPlan.length,
      plannedCents: withPlan.reduce((a, s) => a + (s.plannedPriceCents as number), 0),
      realizedCents: withPlan.reduce((a, s) => a + s.priceCents, 0),
    },
    byPlatform: group(enriched, (s) => s.platform ?? 'Non précisée'),
    byCategory: group(enriched, (s) => s.category ?? 'Sans catégorie'),
  };
}

/** Ventes d'un mois civil donné (AAAA-MM, heure locale du navigateur non utilisée : on compare l'ISO UTC). */
export function salesOfMonth(sales: SaleView[], yyyyMm: string): SaleView[] {
  return sales.filter((s) => s.soldAt.slice(0, 7) === yyyyMm);
}
