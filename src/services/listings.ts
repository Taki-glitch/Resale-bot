import { db } from './db.ts';
import { fingerprint, parseListingUrl } from '../core/listing.ts';
import type { Listing, ListingDetail, ComparableRow, AnalysisRow, ProductRow, Platform } from '../types.ts';

export class DuplicateListingError extends Error {
  existingId: string;
  constructor(existingId: string) {
    super('Cette annonce est déjà importée.');
    this.existingId = existingId;
  }
}

export interface NewListingInput {
  platform: Platform;
  url: string;
  title: string;
  description: string;
  priceCents: number | null;
  condition: string;
  location: string;
  brand: string;
  model: string;
  category: string;
}

const orNull = (s: string): string | null => (s.trim() === '' ? null : s.trim());

/** Crée une annonce (saisie manuelle) et sa fiche produit. Refuse les doublons. */
export async function createListing(input: NewListingInput): Promise<string> {
  const client = db();
  const url = orNull(input.url);
  const parsed = url ? parseListingUrl(url) : null;
  const hash = fingerprint({ url, title: input.title, priceCents: input.priceCents });

  const { data: dup, error: dupErr } = await client.from('listings').select('id').eq('content_hash', hash).limit(1);
  if (dupErr) throw new Error(dupErr.message);
  if (dup && dup.length > 0) throw new DuplicateListingError(dup[0].id as string);

  const { data: product, error: pErr } = await client
    .from('products')
    .insert({
      name: input.title.trim(),
      brand: orNull(input.brand),
      model: orNull(input.model),
      category: orNull(input.category),
    })
    .select('id')
    .single();
  if (pErr) throw new Error(pErr.message);

  const { data: listing, error: lErr } = await client
    .from('listings')
    .insert({
      product_id: product.id,
      platform: input.platform,
      external_id: parsed?.externalId ?? null,
      url,
      title: input.title.trim(),
      description: orNull(input.description),
      price_cents: input.priceCents,
      condition: orNull(input.condition),
      location: orNull(input.location),
      content_hash: hash,
    })
    .select('id')
    .single();
  if (lErr) {
    await client.from('products').delete().eq('id', product.id);
    if (lErr.code === '23505') throw new Error('Cette annonce est déjà importée (identifiant identique).');
    throw new Error(lErr.message);
  }
  return listing.id as string;
}

export async function fetchListings(): Promise<Listing[]> {
  const { data, error } = await db()
    .from('listings')
    .select('*')
    .order('detected_at', { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []) as Listing[];
}

export async function fetchListingDetail(id: string): Promise<ListingDetail> {
  const client = db();
  const { data: listing, error } = await client.from('listings').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!listing) throw new Error('Annonce introuvable.');

  let product: ProductRow | null = null;
  let comparables: ComparableRow[] = [];
  if (listing.product_id) {
    const p = await client.from('products').select('*').eq('id', listing.product_id).maybeSingle();
    if (p.error) throw new Error(p.error.message);
    product = (p.data ?? null) as ProductRow | null;
    const c = await client
      .from('comparables')
      .select('*')
      .eq('product_id', listing.product_id)
      .order('observed_at', { ascending: false });
    if (c.error) throw new Error(c.error.message);
    comparables = (c.data ?? []) as ComparableRow[];
  }
  const a = await client
    .from('analyses')
    .select('*')
    .eq('listing_id', id)
    .order('created_at', { ascending: false })
    .limit(1);
  if (a.error) throw new Error(a.error.message);

  return {
    listing: listing as Listing,
    product,
    comparables,
    analysis: ((a.data ?? [])[0] ?? null) as AnalysisRow | null,
  };
}

export async function deleteListing(id: string, productId: string | null): Promise<void> {
  const client = db();
  const { error } = await client.from('listings').delete().eq('id', id);
  if (error) throw new Error(error.message);
  if (productId) await client.from('products').delete().eq('id', productId);
}
