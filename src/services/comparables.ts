import { db } from './db.ts';
import type { PriceKind } from '../types.ts';

export interface NewComparable {
  productId: string;
  source: string;
  url: string;
  priceCents: number;
  kind: PriceKind;
  condition: string;
  brand: string;
  model: string;
  size: string;
  relevance: number; // 0.1 à 1
  observedAt: string; // AAAA-MM-JJ
}

const orNull = (s: string): string | null => (s.trim() === '' ? null : s.trim());

export async function addComparable(c: NewComparable): Promise<void> {
  const { error } = await db()
    .from('comparables')
    .insert({
      product_id: c.productId,
      source: c.source.trim(),
      url: orNull(c.url),
      price_cents: c.priceCents,
      price_kind: c.kind,
      condition: orNull(c.condition),
      brand: orNull(c.brand),
      model: orNull(c.model),
      size: orNull(c.size),
      relevance: Math.min(1, Math.max(0.1, c.relevance)),
      observed_at: c.observedAt ? new Date(c.observedAt).toISOString() : new Date().toISOString(),
    });
  if (error) throw new Error(error.message);
}

export async function deleteComparable(id: string): Promise<void> {
  const { error } = await db().from('comparables').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
