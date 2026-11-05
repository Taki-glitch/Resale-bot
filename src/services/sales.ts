import { db } from './db.ts';
import { createNotification } from './notifications.ts';
import type { SaleView } from '../core/inventory.ts';

/** Enregistre une vente : vente + statut « vendu » + fiche de revente clôturée, en une seule transaction côté base. */
export async function recordSale(a: {
  inventoryId: string;
  itemName: string;
  priceCents: number;
  soldAt: string; // AAAA-MM-JJ
  platform: string;
  feesCents: number;
  shippingCents: number;
  extraCostsCents: number;
}): Promise<string> {
  const { data, error } = await db().rpc('record_sale', {
    p_inventory_id: a.inventoryId,
    p_price_cents: a.priceCents,
    p_sold_at: a.soldAt ? new Date(a.soldAt).toISOString() : null,
    p_platform: a.platform,
    p_fees_cents: a.feesCents,
    p_shipping_cents: a.shippingCents,
    p_extra_costs_cents: a.extraCostsCents,
  });
  if (error) throw new Error(error.message);
  const saleId = data as string;
  try {
    await createNotification({
      type: 'sale_recorded',
      title: `Vente enregistrée : ${a.itemName}`,
      body: `Prix encaissé ${(a.priceCents / 100).toFixed(2)} €. Consultez Ventes pour le bénéfice réalisé.`,
      listingId: null,
      dedupKey: `sale:${saleId}`,
    });
  } catch {
    /* la vente est enregistrée même si la notification échoue */
  }
  return saleId;
}

const DAY = 86_400_000;

/** Historique des ventes avec coût d'acquisition réel (vue sales_with_profit), catégorie et prix prévu. */
export async function fetchSales(): Promise<SaleView[]> {
  const client = db();
  const s = await client.from('sales_with_profit').select('*').order('sold_at', { ascending: false }).limit(1000);
  if (s.error) throw new Error(s.error.message);
  const sales = (s.data ?? []) as any[];
  const invIds = Array.from(new Set(sales.map((x) => x.inventory_id).filter(Boolean))) as string[];
  const inv = new Map<string, any>();
  for (let i = 0; i < invIds.length; i += 40) {
    const r = await client
      .from('inventory')
      .select('id, name, planned_price_cents, product:products(category), purchase:purchases(purchased_at)')
      .in('id', invIds.slice(i, i + 40));
    if (r.error) throw new Error(r.error.message);
    for (const row of (r.data ?? []) as any[]) inv.set(row.id as string, row);
  }
  return sales.map((x) => {
    const it = x.inventory_id ? inv.get(x.inventory_id as string) : undefined;
    const bought = it?.purchase?.purchased_at ? new Date(it.purchase.purchased_at as string).getTime() : null;
    const sold = new Date(x.sold_at as string).getTime();
    return {
      id: x.id as string,
      inventoryId: (x.inventory_id ?? null) as string | null,
      name: (it?.name ?? 'Article supprimé') as string,
      soldAt: x.sold_at as string,
      priceCents: x.price_cents as number,
      platform: (x.platform ?? null) as string | null,
      category: (it?.product?.category ?? null) as string | null,
      feesCents: x.fees_cents as number,
      shippingCents: (x.shipping_cents ?? 0) as number,
      extraCostsCents: x.extra_costs_cents as number,
      acquisitionCostCents: (x.acquisition_cost_cents ?? null) as number | null,
      plannedPriceCents: (it?.planned_price_cents ?? null) as number | null,
      daysToSell: bought === null ? null : Math.max(0, Math.round((sold - bought) / DAY)),
    };
  });
}
