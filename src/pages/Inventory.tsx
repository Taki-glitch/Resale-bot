import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchInventory } from '../services/inventory.ts';
import { createNotification } from '../services/notifications.ts';
import PhotoThumb from '../components/PhotoThumb.tsx';
import {
  agedItems, AGING_DAYS, filterInventory, INVENTORY_STATUS_LABEL, INVENTORY_STATUS_ORDER, itemCostCents, RESALE_STATUSES, stockSummary,
} from '../core/inventory.ts';
import type { InventoryItemView, InventoryStatus } from '../core/inventory.ts';
import { formatEuros } from '../core/format.ts';
import { errMsg } from '../lib/errors.ts';

/** Inventaire complet, ou vue « Reventes » (articles en préparation, publiés ou réservés) selon `mode`. */
export default function Inventory({ mode = 'inventory' }: { mode?: 'inventory' | 'resale' }) {
  const [views, setViews] = useState<InventoryItemView[] | null>(null);
  const [photos, setPhotos] = useState<Map<string, string[]>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'' | InventoryStatus>('');

  const load = useCallback(async () => {
    try {
      const r = await fetchInventory();
      setViews(r.views);
      setPhotos(r.photos);
      setError(null);
      // Alerte de stock immobilisé (une seule notification par article et par mois).
      const month = new Date().toISOString().slice(0, 7);
      for (const it of agedItems(r.views).slice(0, 5)) {
        try {
          await createNotification({
            type: 'stock_aging',
            title: `Stock immobilisé : ${it.name}`,
            body: `Cet article n'est pas vendu depuis plus de ${AGING_DAYS} jours. Pense à baisser le prix ou à le republier.`,
            listingId: null,
            dedupKey: `aging:${it.id}:${month}`,
          });
        } catch {
          /* l'alerte est facultative */
        }
      }
    } catch (e) {
      setError(errMsg(e));
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const scoped = useMemo(
    () => (mode === 'resale' ? (views ?? []).filter((v) => RESALE_STATUSES.includes(v.status)) : views ?? []),
    [views, mode],
  );
  const shown = useMemo(() => filterInventory(scoped, { query, status }), [scoped, query, status]);
  const summary = useMemo(() => stockSummary(views ?? []), [views]);
  const aged = useMemo(() => agedItems(views ?? []), [views]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-navy-950">{mode === 'resale' ? 'Reventes' : 'Inventaire'}</h1>
      {mode === 'resale' && (
        <p className="text-sm text-slate-600">
          Articles reçus ou en cours de revente. Ouvre un article pour préparer son annonce (titre, description, prix). La publication sur la plateforme reste manuelle.
        </p>
      )}

      {views && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="card"><p className="text-xs text-slate-500">Articles en stock</p><p className="text-xl font-semibold text-navy-950">{summary.count}</p></div>
          <div className="card">
            <p className="text-xs text-slate-500">Coût du stock</p>
            <p className="text-xl font-semibold text-navy-950">{formatEuros(summary.costCents)}</p>
            {summary.unknownCostCount > 0 && <p className="text-xs text-warn">{summary.unknownCostCount} coût(s) inconnu(s)</p>}
          </div>
          <div className="card">
            <p className="text-xs text-slate-500">Valeur de revente prévue</p>
            <p className="text-xl font-semibold text-navy-950">{formatEuros(summary.plannedValueCents)}</p>
            {summary.unplannedCount > 0 && <p className="text-xs text-slate-500">{summary.unplannedCount} sans prix prévu</p>}
          </div>
          <div className="card">
            <p className="text-xs text-slate-500">Immobilisés &gt; {AGING_DAYS} jours</p>
            <p className={`text-xl font-semibold ${aged.length > 0 ? 'text-warn' : 'text-navy-950'}`}>{aged.length}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <input className="input" placeholder="Rechercher un article…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value as '' | InventoryStatus)}>
          <option value="">Tous les statuts</option>
          {INVENTORY_STATUS_ORDER.map((s) => (
            <option key={s} value={s}>{INVENTORY_STATUS_LABEL[s]}</option>
          ))}
        </select>
      </div>

      {error && <p className="text-sm text-loss">{error}</p>}
      {!views && !error && <p className="text-sm text-slate-500">Chargement…</p>}
      {views && scoped.length === 0 && (
        <p className="card text-sm text-slate-600">
          {mode === 'resale'
            ? 'Aucun article en cours de revente. Passe un article en « En préparation » depuis sa fiche.'
            : "Aucun article en inventaire. Depuis une annonce, utilise « Ajouter à l'inventaire » après un achat réel."}
        </p>
      )}
      {views && scoped.length > 0 && shown.length === 0 && <p className="text-sm text-slate-500">Aucun article ne correspond.</p>}

      <div className="space-y-2">
        {shown.map((i) => {
          const cost = itemCostCents(i);
          return (
            <Link key={i.id} to={`/inventaire/${i.id}`} className="card flex items-center gap-3 hover:border-navy-700">
              <PhotoThumb paths={photos.get(i.id) ?? []} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-navy-950">{i.name}</p>
                <p className="text-xs text-slate-500">
                  {INVENTORY_STATUS_LABEL[i.status]}
                  {i.platform ? ` · acheté sur ${i.platform}` : ''}
                  {i.category ? ` · ${i.category}` : ''}
                </p>
                <p className="text-sm text-slate-700">
                  Coût {cost === null ? 'inconnu' : formatEuros(cost)}
                  {i.plannedPriceCents !== null ? ` · prévu ${formatEuros(i.plannedPriceCents)}` : ''}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
