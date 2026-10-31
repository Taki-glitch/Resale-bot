
import { useCallback, useEffect, useState } from 'react';
import { errMsg } from '../lib/errors.ts';
import { deleteSavedSearch, fetchSavedSearches, saveSearch } from '../services/searches.ts';
import type { ListingSearchFilters, SavedSearch } from '../services/searches.ts';

export default function SavedSearches({ filters, onApply }: {
  filters: ListingSearchFilters;
  onApply: (filters: ListingSearchFilters) => void;
}) {
  const [items, setItems] = useState<SavedSearch[]>([]);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try { setItems(await fetchSavedSearches()); } catch (e) { setError(errMsg(e)); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function add() {
    if (!name.trim()) { setError('Donne un nom à cette recherche.'); return; }
    setBusy(true); setError(null);
    try { await saveSearch(name, filters); setName(''); await load(); }
    catch (e) { setError(errMsg(e)); }
    finally { setBusy(false); }
  }
  async function remove(id: string) {
    try { await deleteSavedSearch(id); await load(); } catch (e) { setError(errMsg(e)); }
  }

  return <section className="card space-y-3">
    <h2 className="font-semibold text-navy-950">Recherches sauvegardées</h2>
    <div className="flex flex-wrap gap-2">
      <input className="input min-w-0 flex-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom de la recherche" />
      <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void add()}>Enregistrer les filtres</button>
    </div>
    {error && <p className="text-sm text-loss">{error}</p>}
    {items.length === 0 ? <p className="text-xs text-slate-500">Aucune recherche sauvegardée.</p> :
      <div className="flex flex-wrap gap-2">{items.map((item) => <div key={item.id} className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
        <button type="button" className="px-2 py-1 text-sm hover:underline" onClick={() => onApply(item.filters)}>{item.name}</button>
        <button type="button" className="px-2 py-1 text-xs text-loss" aria-label={`Supprimer ${item.name}`} onClick={() => void remove(item.id)}>×</button>
      </div>)}</div>}
  </section>;
}
