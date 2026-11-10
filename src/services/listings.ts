import { db } from './db.ts';
import { fingerprint, parseListingUrl } from '../core/listing.ts';
import { shouldDeleteProduct } from '../core/deletion.ts';
import { priceChange } from '../core/price.ts';
import { logActivity } from './audit.ts';
import { createNotification } from './notifications.ts';
import { confidenceLevelOf } from '../core/evaluation.ts';
import type { SearchableListing } from '../core/search.ts';
import type { Listing, ListingDetail, ListingWithMeta, ComparableRow, AnalysisRow, OpportunityRow, ProductRow, Platform } from '../types.ts';

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
      source_kind: 'manual',
    })
    .select('id')
    .single();
  if (lErr) {
    await client.from('products').delete().eq('id', product.id);
    if (lErr.code === '23505') throw new Error('Cette annonce est déjà importée (identifiant identique).');
    throw new Error(lErr.message);
  }
  if (input.priceCents !== null) {
    await client.from('price_history').insert({ listing_id: listing.id, price_cents: input.priceCents }); // prix initial (complément : sans blocage)
  }
  return listing.id as string;
}

export async function fetchListings(limit = 100): Promise<Listing[]> {
  const { data, error } = await db()
    .from('listings')
    .select('*')
    .order('detected_at', { ascending: false })
    .limit(limit);
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

  const o = await client.from('opportunities').select('*').eq('listing_id', id).maybeSingle();
  if (o.error) throw new Error(o.error.message);

  return {
    listing: listing as Listing,
    product,
    comparables,
    analysis: ((a.data ?? [])[0] ?? null) as AnalysisRow | null,
    opportunity: (o.data ?? null) as OpportunityRow | null,
  };
}

/**
 * Supprime l'annonce (et, par cascade, son évaluation et ses notifications). Le produit associé n'est supprimé
 * (avec ses comparables) que s'il n'est plus utilisé par aucune autre annonce ni aucun article d'inventaire.
 * En cas de doute (erreur de comptage), le produit est conservé.
 */
export async function deleteListing(id: string, productId: string | null): Promise<void> {
  const client = db();
  const { error } = await client.from('listings').delete().eq('id', id);
  if (error) throw new Error(error.message);
  await logActivity('listing_deleted', 'listing', id, { productId });
  if (!productId) return;
  const l = await client.from('listings').select('id', { count: 'exact', head: true }).eq('product_id', productId);
  const i = await client.from('inventory').select('id', { count: 'exact', head: true }).eq('product_id', productId);
  if (l.error || i.error) return;
  if (shouldDeleteProduct({ listings: l.count ?? 0, inventoryItems: i.count ?? 0 })) {
    await client.from('products').delete().eq('id', productId);
  }
}

/** Annonces avec leur produit et leur évaluation (une seule requête) pour la recherche et les filtres. */
export async function fetchListingsWithMeta(limit = 300): Promise<ListingWithMeta[]> {
  const { data, error } = await db()
    .from('listings')
    .select(
      '*, product:products(brand, model, category), opportunity:opportunities(score, recommendation, confidence, status, est_profit_cents, net_margin_pct, max_buy_cents, risk_level)',
    )
    .order('detected_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return ((data ?? []) as any[]).map((r) => ({
    ...(r as Listing),
    product: r.product ?? null,
    opportunity: Array.isArray(r.opportunity) ? (r.opportunity[0] ?? null) : (r.opportunity ?? null),
  })) as ListingWithMeta[];
}

export function toSearchable(l: ListingWithMeta): SearchableListing {
  const o = l.opportunity;
  const confidence = o?.confidence === null || o?.confidence === undefined ? null : Number(o.confidence);
  return {
    id: l.id,
    title: l.title,
    platform: l.platform,
    location: l.location,
    priceCents: l.price_cents,
    brand: l.product?.brand ?? null,
    model: l.product?.model ?? null,
    category: l.product?.category ?? null,
    detectedAt: l.detected_at,
    score: o?.score ?? null,
    netProfitCents: o?.est_profit_cents ?? null,
    netMarginPct: o?.net_margin_pct === null || o?.net_margin_pct === undefined ? null : Number(o.net_margin_pct),
    confidenceLevel: confidence === null ? null : confidenceLevelOf(confidence),
    status: o?.status ?? null,
    recommendation: o?.recommendation ?? null,
  };
}

/** Modifie une annonce et sa fiche produit. Refuse un doublon d'une AUTRE annonce. */
export async function updateListing(id: string, productId: string | null, input: NewListingInput): Promise<void> {
  const client = db();
  const url = orNull(input.url);
  const parsed = url ? parseListingUrl(url) : null;
  const hash = fingerprint({ url, title: input.title, priceCents: input.priceCents });
  const before = await client.from('listings').select('price_cents').eq('id', id).maybeSingle();
  const oldPrice = (before.data?.price_cents ?? null) as number | null;

  const { data: dup, error: dupErr } = await client
    .from('listings')
    .select('id')
    .eq('content_hash', hash)
    .neq('id', id)
    .limit(1);
  if (dupErr) throw new Error(dupErr.message);
  if (dup && dup.length > 0) throw new DuplicateListingError(dup[0].id as string);

  const { error } = await client
    .from('listings')
    .update({
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
    .eq('id', id);
  if (error) {
    if (error.code === '23505') throw new Error('Une autre annonce possède déjà cet identifiant.');
    throw new Error(error.message);
  }
  const change = priceChange(oldPrice, input.priceCents);
  if (change.changed && input.priceCents !== null) {
    await client.from('price_history').insert({ listing_id: id, price_cents: input.priceCents });
    await logActivity('price_changed', 'listing', id, { from: oldPrice, to: input.priceCents });
    if (change.dropped) {
      try {
        await createNotification({
          type: 'price_drop',
          title: `Baisse de prix : ${input.title.trim()}`,
          body: `Nouveau prix ${(input.priceCents / 100).toFixed(2)} € (${change.pct === null ? '' : `${change.pct} %`}). L'évaluation a été recalculée.`,
          listingId: id,
          dedupKey: `price:${id}:${input.priceCents}`,
        });
      } catch {
        /* notification facultative */
      }
    }
  }
  if (productId) {
    const p = await client
      .from('products')
      .update({
        name: input.title.trim(),
        brand: orNull(input.brand),
        model: orNull(input.model),
        category: orNull(input.category),
      })
      .eq('id', productId);
    if (p.error) throw new Error(p.error.message);
  }
}

export async function updateListingPhotos(id: string, paths: string[]): Promise<void> {
  const { error } = await db().from('listings').update({ photos: paths }).eq('id', id);
  if (error) throw new Error(error.message);
}

export interface PriceHistoryRow {
  id: string;
  price_cents: number;
  observed_at: string;
}

export async function fetchPriceHistory(listingId: string): Promise<PriceHistoryRow[]> {
  const { data, error } = await db().from('price_history').select('id, price_cents, observed_at').eq('listing_id', listingId).order('observed_at', { ascending: false }).limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []) as PriceHistoryRow[];
}
