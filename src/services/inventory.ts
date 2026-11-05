import { db } from './db.ts';
import type { InventoryItemView, InventoryStatus } from '../core/inventory.ts';
import type { ComparableRow } from '../types.ts';

/** Enregistre un achat : achat + article d'inventaire + statut de l'opportunité, en une seule transaction côté base. */
export async function recordPurchase(a: {
  listingId: string;
  priceCents: number;
  feesCents: number;
  purchasedAt: string; // AAAA-MM-JJ
  platform: string;
  sellerRef: string;
  notes: string;
  accessories: string;
}): Promise<string> {
  const { data, error } = await db().rpc('record_purchase', {
    p_listing_id: a.listingId,
    p_price_cents: a.priceCents,
    p_fees_cents: a.feesCents,
    p_purchased_at: a.purchasedAt ? new Date(a.purchasedAt).toISOString() : null,
    p_platform: a.platform,
    p_seller_ref: a.sellerRef,
    p_notes: a.notes,
    p_accessories: a.accessories,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

const sumBy = (rows: { inventory_id: string; amount_cents: number }[]): Map<string, number> => {
  const m = new Map<string, number>();
  for (const r of rows) m.set(r.inventory_id, (m.get(r.inventory_id) ?? 0) + r.amount_cents);
  return m;
};

function toView(r: any, expenses: Map<string, number>): InventoryItemView {
  const p = r.purchase ?? null;
  return {
    id: r.id as string,
    name: r.name as string,
    status: r.status as InventoryStatus,
    category: (r.product?.category ?? null) as string | null,
    purchasePriceCents: p ? (p.price_cents as number) : null,
    purchaseFeesCents: p ? (p.fees_cents as number) : 0,
    expensesCents: expenses.get(r.id as string) ?? 0,
    plannedPriceCents: (r.planned_price_cents ?? null) as number | null,
    purchasedAt: (p?.purchased_at ?? null) as string | null,
    inStockSince: (r.in_stock_since ?? null) as string | null,
    platform: (p?.platform ?? null) as string | null,
  };
}

const SELECT = '*, purchase:purchases(id, price_cents, fees_cents, purchased_at, platform, seller_ref, condition_notes, accessories, url), product:products(brand, model, category)';

export async function fetchInventory(): Promise<{ views: InventoryItemView[]; photos: Map<string, string[]> }> {
  const client = db();
  const inv = await client.from('inventory').select(SELECT).order('created_at', { ascending: false }).limit(500);
  if (inv.error) throw new Error(inv.error.message);
  const exp = await client.from('expenses').select('inventory_id, amount_cents').not('inventory_id', 'is', null).limit(5000);
  if (exp.error) throw new Error(exp.error.message);
  const sums = sumBy((exp.data ?? []) as { inventory_id: string; amount_cents: number }[]);
  const rows = (inv.data ?? []) as any[];
  return {
    views: rows.map((r) => toView(r, sums)),
    photos: new Map(rows.map((r) => [r.id as string, (Array.isArray(r.photos) ? r.photos : []) as string[]])),
  };
}

export interface InventoryDetail {
  row: any;
  view: InventoryItemView;
  photos: string[];
  purchase: any | null;
  product: { brand: string | null; model: string | null; category: string | null } | null;
  productId: string | null;
  expenses: ExpenseRow[];
  resale: ResaleRow | null;
  comparables: ComparableRow[];
}

export interface ExpenseRow {
  id: string;
  label: string;
  category: string | null;
  amount_cents: number;
  incurred_at: string;
}

export interface ResaleRow {
  id: string;
  title: string | null;
  description: string | null;
  keywords: string[];
  suggested_price_cents: number | null;
  min_price_cents: number | null;
  platform: string | null;
  status: 'draft' | 'published' | 'closed';
}

export async function fetchInventoryDetail(id: string): Promise<InventoryDetail> {
  const client = db();
  const inv = await client.from('inventory').select(SELECT).eq('id', id).maybeSingle();
  if (inv.error) throw new Error(inv.error.message);
  if (!inv.data) throw new Error('Article introuvable.');
  const exp = await client.from('expenses').select('id, label, category, amount_cents, incurred_at').eq('inventory_id', id).order('incurred_at', { ascending: false });
  if (exp.error) throw new Error(exp.error.message);
  const expenses = (exp.data ?? []) as ExpenseRow[];
  const res = await client.from('resales').select('*').eq('inventory_id', id).maybeSingle();
  if (res.error) throw new Error(res.error.message);
  let comparables: ComparableRow[] = [];
  if (inv.data.product_id) {
    const c = await client.from('comparables').select('*').eq('product_id', inv.data.product_id);
    if (c.error) throw new Error(c.error.message);
    comparables = (c.data ?? []) as ComparableRow[];
  }
  const sums = new Map<string, number>([[id, expenses.reduce((a, e) => a + e.amount_cents, 0)]]);
  return {
    row: inv.data,
    view: toView(inv.data, sums),
    photos: (Array.isArray(inv.data.photos) ? inv.data.photos : []) as string[],
    purchase: inv.data.purchase ?? null,
    product: inv.data.product ?? null,
    productId: (inv.data.product_id ?? null) as string | null,
    expenses,
    resale: (res.data ?? null) as ResaleRow | null,
    comparables,
  };
}

export async function updateInventory(
  id: string,
  patch: { name?: string; status?: InventoryStatus; notes?: string | null; planned_price_cents?: number | null; photos?: string[]; in_stock_since?: string | null },
): Promise<void> {
  const { error } = await db().from('inventory').update(patch).eq('id', id);
  if (error) throw new Error(error.message);
}

/** Un article vendu ne se supprime pas (historique comptable). Les photos et l'annonce d'origine ne sont pas touchées. */
export async function deleteInventory(id: string, status: InventoryStatus, purchaseId: string | null): Promise<void> {
  if (status === 'sold') throw new Error('Un article vendu ne peut pas être supprimé : il fait partie de votre historique de ventes.');
  const client = db();
  const { error } = await client.from('inventory').delete().eq('id', id);
  if (error) throw new Error(error.message);
  if (purchaseId) await client.from('purchases').delete().eq('id', purchaseId);
}

export async function addExpense(e: { inventoryId: string; label: string; category: string; amountCents: number; date: string }): Promise<void> {
  const { error } = await db()
    .from('expenses')
    .insert({
      inventory_id: e.inventoryId,
      label: e.label.trim(),
      category: e.category.trim() === '' ? null : e.category.trim(),
      amount_cents: e.amountCents,
      incurred_at: e.date ? new Date(e.date).toISOString() : new Date().toISOString(),
    });
  if (error) throw new Error(error.message);
}

export async function deleteExpense(id: string): Promise<void> {
  const { error } = await db().from('expenses').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function saveResale(
  inventoryId: string,
  existingId: string | null,
  r: { title: string; description: string; keywords: string[]; suggestedPriceCents: number | null; minPriceCents: number | null; platform: string; status: 'draft' | 'published' },
): Promise<void> {
  const row = {
    title: r.title.trim() || null,
    description: r.description.trim() || null,
    keywords: r.keywords,
    suggested_price_cents: r.suggestedPriceCents,
    min_price_cents: r.minPriceCents,
    platform: r.platform || null,
    status: r.status,
  };
  const res = existingId
    ? await db().from('resales').update(row).eq('id', existingId)
    : await db().from('resales').insert({ inventory_id: inventoryId, ...row });
  if (res.error) throw new Error(res.error.message);
}
