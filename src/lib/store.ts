/**
 * Accès base de données indépendant du navigateur : utilisé par l'application (client authentifié, RLS) ET par la
 * tâche planifiée (clé service, sans RLS). Avec la clé service, `scope.userId` est OBLIGATOIRE : il limite chaque lecture
 * et renseigne `user_id` à chaque écriture, pour qu'aucune donnée d'un autre utilisateur ne soit touchée.
 */
import { detectEvents } from '../core/notifications.ts';
import { buildOpportunityPayload } from '../core/opportunity-payload.ts';
import type { Evaluation, Recommendation } from '../core/evaluation.ts';
import type { InventoryItemView, InventoryStatus } from '../core/inventory.ts';
import type { Settings } from '../core/settings.ts';
import { evaluateRows } from './evaluateRows.ts';
import type { AnalysisRow, ComparableRow, Listing, OpportunityRow } from '../types.ts';

export type Client = any; // client Supabase (typage dynamique : le schéma n'est pas généré)
export interface Scope {
  userId: string;
}

const scoped = (q: any, scope?: Scope) => (scope ? q.eq('user_id', scope.userId) : q);
const own = (scope?: Scope): Record<string, unknown> => (scope ? { user_id: scope.userId } : {});

export const chunk = <T,>(items: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

/** Crée une notification dans l'application. Renvoie false si elle existe déjà (clé de déduplication). */
export async function createNotificationWith(
  client: Client,
  n: { type: string; title: string; body: string; listingId: string | null; dedupKey: string; channel?: 'in_app' | 'telegram' },
  scope?: Scope,
): Promise<boolean> {
  const { error } = await client.from('notifications').insert({
    ...own(scope),
    type: n.type,
    title: n.title,
    body: n.body,
    listing_id: n.listingId,
    channel: n.channel ?? 'in_app',
    dedup_key: n.dedupKey,
  });
  if (error) {
    if (error.code === '23505') return false; // déjà notifiée : pas de répétition
    throw new Error(error.message);
  }
  return true;
}

export interface KnownOpportunity {
  id: string;
  recommendation: Recommendation | null;
  score: number | null;
  risks: string[];
}

/**
 * Enregistre (crée ou met à jour) l'évaluation d'une annonce. Le statut et la sélection choisis par l'utilisateur ne sont
 * jamais écrasés ; les notifications ne sont créées que pour un changement important (core/notifications.ts).
 */
export async function persistEvaluation(
  client: Client,
  args: {
    listingId: string;
    listingTitle: string;
    analysisId: string | null;
    evaluation: Evaluation;
    minProfitCents: number;
    known?: KnownOpportunity | null;
  },
  scope?: Scope,
): Promise<OpportunityRow> {
  const ev = args.evaluation;
  const payload = buildOpportunityPayload(ev, args.analysisId);

  let known = args.known;
  if (known === undefined) {
    const found = await scoped(client.from('opportunities').select('id, recommendation, score, score_detail').eq('listing_id', args.listingId), scope).maybeSingle();
    if (found.error) throw new Error(found.error.message);
    known = found.data
      ? {
          id: found.data.id as string,
          recommendation: (found.data.recommendation ?? null) as Recommendation | null,
          score: (found.data.score ?? null) as number | null,
          risks: (found.data.score_detail?.risks ?? []) as string[],
        }
      : null;
  }

  const res = known
    ? await client.from('opportunities').update(payload).eq('id', known.id).select('*').single()
    : await client.from('opportunities').insert({ ...own(scope), listing_id: args.listingId, ...payload }).select('*').single();
  if (res.error) throw new Error(res.error.message);

  const events = detectEvents({
    listingId: args.listingId,
    listingTitle: args.listingTitle,
    previous: known ? { recommendation: known.recommendation, score: known.score, risks: known.risks } : null,
    next: {
      recommendation: ev.recommendation,
      score: ev.score,
      risks: ev.risks,
      netProfitCents: ev.netProfitCents,
      priceCents: ev.purchaseCents,
      maxBuyCents: ev.maxBuyCents,
      staleComparables: ev.staleComparables,
    },
    minProfitCents: args.minProfitCents,
  });
  for (const e of events) {
    try {
      await createNotificationWith(client, { type: e.type, title: e.title, body: e.body, listingId: args.listingId, dedupKey: e.dedupKey }, scope);
    } catch {
      /* une notification manquée ne doit jamais bloquer l'évaluation */
    }
  }
  return res.data as OpportunityRow;
}

/**
 * Recalcule les évaluations (annonces actives, ou une seule). N'écrit que si la signature a changé :
 * un recalcul sans changement ne crée ni écriture ni notification.
 */
export async function refreshEvaluationsWith(
  client: Client,
  settings: Settings,
  scope?: Scope,
  listingId?: string,
): Promise<{ evaluated: number; updated: number }> {
  let lq = client.from('listings').select('*');
  lq = listingId ? lq.eq('id', listingId) : lq.eq('status', 'active').order('detected_at', { ascending: false }).limit(200);
  const lres = await scoped(lq, scope);
  if (lres.error) throw new Error(lres.error.message);
  const listings = (lres.data ?? []) as Listing[];
  if (listings.length === 0) return { evaluated: 0, updated: 0 };

  const ids = listings.map((l) => l.id);
  const productIds = Array.from(new Set(listings.map((l) => l.product_id).filter((p): p is string => Boolean(p))));
  const comps: ComparableRow[] = [];
  for (const part of chunk(productIds, 40)) {
    const r = await scoped(client.from('comparables').select('*').in('product_id', part), scope);
    if (r.error) throw new Error(r.error.message);
    comps.push(...((r.data ?? []) as ComparableRow[]));
  }
  const latestAnalysis = new Map<string, AnalysisRow>();
  const knownByListing = new Map<string, KnownOpportunity & { signature: string | null }>();
  for (const part of chunk(ids, 40)) {
    const a = await scoped(client.from('analyses').select('*').in('listing_id', part).order('created_at', { ascending: false }), scope);
    if (a.error) throw new Error(a.error.message);
    for (const row of (a.data ?? []) as AnalysisRow[]) if (!latestAnalysis.has(row.listing_id)) latestAnalysis.set(row.listing_id, row);
    const o = await scoped(client.from('opportunities').select('id, listing_id, recommendation, score, score_detail').in('listing_id', part), scope);
    if (o.error) throw new Error(o.error.message);
    for (const row of (o.data ?? []) as any[]) {
      knownByListing.set(row.listing_id as string, {
        id: row.id as string,
        recommendation: (row.recommendation ?? null) as Recommendation | null,
        score: (row.score ?? null) as number | null,
        risks: (row.score_detail?.risks ?? []) as string[],
        signature: (row.score_detail?.signature ?? null) as string | null,
      });
    }
  }

  let updated = 0;
  for (const l of listings) {
    const analysis = latestAnalysis.get(l.id) ?? null;
    const evaluation = evaluateRows({ listing: l, comparables: comps.filter((c) => c.product_id === l.product_id), analysis, settings });
    const known = knownByListing.get(l.id) ?? null;
    if (known && known.signature === evaluation.signature) continue;
    await persistEvaluation(
      client,
      {
        listingId: l.id,
        listingTitle: l.title,
        analysisId: analysis?.id ?? null,
        evaluation,
        minProfitCents: settings.minProfitCents,
        known: known ? { id: known.id, recommendation: known.recommendation, score: known.score, risks: known.risks } : null,
      },
      scope,
    );
    updated += 1;
  }
  return { evaluated: listings.length, updated };
}

const sumBy = (rows: { inventory_id: string; amount_cents: number }[]): Map<string, number> => {
  const m = new Map<string, number>();
  for (const r of rows) m.set(r.inventory_id, (m.get(r.inventory_id) ?? 0) + r.amount_cents);
  return m;
};

export function inventoryToView(r: any, expenses: Map<string, number>): InventoryItemView {
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

export const INVENTORY_SELECT =
  '*, purchase:purchases(id, price_cents, fees_cents, purchased_at, platform, seller_ref, condition_notes, accessories, url), product:products(brand, model, category)';

export async function loadInventoryWith(client: Client, scope?: Scope): Promise<{ views: InventoryItemView[]; photos: Map<string, string[]> }> {
  const inv = await scoped(client.from('inventory').select(INVENTORY_SELECT).order('created_at', { ascending: false }).limit(500), scope);
  if (inv.error) throw new Error(inv.error.message);
  const exp = await scoped(client.from('expenses').select('inventory_id, amount_cents').not('inventory_id', 'is', null).limit(5000), scope);
  if (exp.error) throw new Error(exp.error.message);
  const sums = sumBy((exp.data ?? []) as { inventory_id: string; amount_cents: number }[]);
  const rows = (inv.data ?? []) as any[];
  return {
    views: rows.map((r) => inventoryToView(r, sums)),
    photos: new Map(rows.map((r) => [r.id as string, (Array.isArray(r.photos) ? r.photos : []) as string[]])),
  };
}
