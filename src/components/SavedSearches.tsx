import { useCallback, useEffect, useState } from 'react';
import { deleteSavedSearch, fetchSavedSearches, saveSearch, updateSavedSearch } from '../services/searches.ts';
import type { SavedSearch } from '../services/searches.ts';
import type { SearchCriteria, SearchSort } from '../core/search.ts';
import { errMsg } from '../lib/errors.ts';

/** Recherches enregistrées (stockées en base, propres à l'utilisateur connecté). Aucune surveillance automatique des plateformes. */
export default function SavedSearches({
  criteria,
  sort,
  onApply,
}: {
  criteria: SearchCriteria;
  sort: SearchSort;
  onApply: (criteria: SearchCriteria, sort: SearchSort) => void;
}) {
  const [items, setItems] = useState<SavedSearch[] | null>(null);
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await fetchSavedSearches());
    } catch (e) {
      setError(errMsg(e));
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await load();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3">
      <h3 className="font-semibold text-navy-950">Recherches enregistrées</h3>
      <div className="flex flex-wrap gap-2">
        <input className="input min-w-0 flex-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom de la recherche" />
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy}
          onClick={() => {
            if (name.trim() === '') return setError('Donne un nom à cette recherche.');
            void run(async () => {
              await saveSearch(name, criteria, sort);
              setName('');
            });
          }}
        >
          Enregistrer les filtres actuels
        </button>
      </div>
      {error && <p className="text-sm text-loss">{error}</p>}
      {items === null && !error && <p className="text-xs text-slate-500">Chargement…</p>}
      {items !== null && items.length === 0 && <p className="text-xs text-slate-500">Aucune recherche enregistrée.</p>}
      <div className="space-y-2">
        {(items ?? []).map((item) => (
          <div key={item.id} className="rounded-lg border border-slate-200 p-2">
            {editingId === item.id ? (
              <div className="flex flex-wrap gap-2">
                <input className="input min-w-0 flex-1" value={editName} onChange={(e) => setEditName(e.target.value)} />
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      if (editName.trim() === '') throw new Error('Le nom ne peut pas être vide.');
                      await updateSavedSearch(item.id, { name: editName });
                      setEditingId(null);
                    })
                  }
                >
                  Renommer
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setEditingId(null)}>Annuler</button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" className="btn btn-ghost" onClick={() => onApply(item.criteria, item.sort)}>
                  Relancer « {item.name} »
                </button>
                <button
                  type="button"
                  className="text-xs underline"
                  disabled={busy}
                  onClick={() => void run(() => updateSavedSearch(item.id, { criteria, sort }))}
                >
                  Mettre à jour avec les filtres actuels
                </button>
                <button
                  type="button"
                  className="text-xs underline"
                  onClick={() => {
                    setEditingId(item.id);
                    setEditName(item.name);
                  }}
                >
                  Renommer
                </button>
                <button
                  type="button"
                  className="text-xs text-loss underline"
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm(`Supprimer la recherche « ${item.name} » ?`)) void run(() => deleteSavedSearch(item.id));
                  }}
                >
                  Supprimer
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
