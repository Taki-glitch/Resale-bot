import { db } from './db.ts';
import type { PriceKind } from '../types.ts';

export interface NewComparable {
  productId: string;
  source: string;
  url: string;
  priceCents: number;
  kind: PriceKind;
  condition: string;
  observedAt: string; // AAAA-MM-JJ
}

export async function addComparable(c: NewComparable): Promise<void> {
  const { error } = await db()
    .from('comparables')
    .insert({
      product_id: c.productId,
      source: c.source.trim(),
      url: c.url.trim() === '' ? null : c.url.trim(),
      price_cents: c.priceCents,
      price_kind: c.kind,
      condition: c.condition.trim() === '' ? null : c.condition.trim(),
      observed_at: c.observedAt ? new Date(c.observedAt).toISOString() : new Date().toISOString(),
    });
  if (error) throw new Error(error.message);
}

export async function deleteComparable(id: string): Promise<void> {
  const { error } = await db().from('comparables').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
