
import { db } from './db.ts';

export interface ListingSearchFilters {
  keyword: string;
  platform: string;
  category: string;
  location: string;
  maxPrice: string;
}
export interface SavedSearch {
  id: string;
  name: string;
  filters: ListingSearchFilters;
  is_active: boolean;
  created_at: string;
}
const EMPTY: ListingSearchFilters = { keyword: '', platform: 'all', category: '', location: '', maxPrice: '' };

export async function fetchSavedSearches(): Promise<SavedSearch[]> {
  const { data, error } = await db().from('search_configs')
    .select('id,name,filters,is_active,created_at').order('updated_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: any) => ({ ...row, filters: { ...EMPTY, ...(row.filters ?? {}) } })) as SavedSearch[];
}

export async function saveSearch(name: string, filters: ListingSearchFilters): Promise<void> {
  const { error } = await db().from('search_configs').insert({
    name: name.trim(), platform: filters.platform === 'all' ? null : filters.platform,
    filters, is_active: true,
  });
  if (error) throw new Error(error.message);
}

export async function deleteSavedSearch(id: string): Promise<void> {
  const { error } = await db().from('search_configs').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
