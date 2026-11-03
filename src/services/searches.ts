import { db } from './db.ts';
import { parseSavedSearch, serializeSearch } from '../core/search.ts';
import type { SearchCriteria, SearchSort } from '../core/search.ts';

export interface SavedSearch {
  id: string;
  name: string;
  criteria: SearchCriteria;
  sort: SearchSort;
  created_at: string;
  updated_at: string;
}

const friendly = (e: { code?: string; message: string }): Error =>
  new Error(e.code === '23505' ? 'Une recherche porte déjà ce nom.' : e.message);

/** Recherches de l'utilisateur connecté (protégées par RLS), les plus récemment modifiées d'abord. */
export async function fetchSavedSearches(): Promise<SavedSearch[]> {
  const { data, error } = await db()
    .from('search_configs')
    .select('id, name, filters, created_at, updated_at')
    .order('updated_at', { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as any[]).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    ...parseSavedSearch(r.filters),
    created_at: r.created_at as string,
    updated_at: r.updated_at as string,
  }));
}

export async function saveSearch(name: string, criteria: SearchCriteria, sort: SearchSort): Promise<void> {
  const { error } = await db()
    .from('search_configs')
    .insert({ name: name.trim(), platform: criteria.platform || null, filters: serializeSearch(criteria, sort), is_active: true });
  if (error) throw friendly(error);
}

export async function updateSavedSearch(
  id: string,
  patch: { name?: string; criteria?: SearchCriteria; sort?: SearchSort },
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name.trim();
  if (patch.criteria && patch.sort) {
    row.filters = serializeSearch(patch.criteria, patch.sort);
    row.platform = patch.criteria.platform || null;
  }
  const { error } = await db().from('search_configs').update(row).eq('id', id);
  if (error) throw friendly(error);
}

export async function deleteSavedSearch(id: string): Promise<void> {
  const { error } = await db().from('search_configs').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
