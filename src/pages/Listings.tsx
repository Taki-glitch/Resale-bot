import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createListing, fetchListings } from '../services/listings.ts';
import ListingForm, { EMPTY_LISTING_FORM } from '../components/ListingForm.tsx';
import { formatEuros } from '../core/format.ts';
import { PLATFORM_LABEL, SOURCE_KIND_LABEL } from '../lib/labels.ts';
import { errMsg } from '../lib/errors.ts';
import type { Listing, Platform } from '../types.ts';

export default function Listings() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Listing[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState('');
  const [platform, setPlatform] = useState('');

  const load = useCallback(async () => {
    try {
      setItems(await fetchListings());
    } catch (e) {
      setError(errMsg(e));
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (items ?? []).filter(
      (l) => (platform === '' || l.platform === platform) && (q === '' || l.title.toLowerCase().includes(q)),
    );
  }, [items, query, platform]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-navy-950">Recherche d'annonces</h1>
      <p className="card text-sm text-slate-600">
        Import manuel uniquement : aucun connecteur automatique n'est actif, car aucune source autorisée n'est configurée.
        Les recherches enregistrées arrivent dans une version ultérieure.
      </p>
      <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
        {showForm ? 'Fermer' : 'Ajouter une annonce'}
      </button>
      {showForm && (
        <ListingForm
          initial={EMPTY_LISTING_FORM}
          heading="Ajouter une annonce"
          submitLabel="Enregistrer l'annonce"
          onSubmit={async (input) => {
            const id = await createListing(input);
            navigate(`/annonce/${id}`);
          }}
        />
      )}
      <div className="grid grid-cols-2 gap-3">
        <input className="input" placeholder="Rechercher un titre…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select className="input" value={platform} onChange={(e) => setPlatform(e.target.value)}>
          <option value="">Toutes les plateformes</option>
          {(Object.keys(PLATFORM_LABEL) as Platform[]).map((p) => (
            <option key={p} value={p}>{PLATFORM_LABEL[p]}</option>
          ))}
        </select>
      </div>
      {error && <p className="text-sm text-loss">{error}</p>}
      {!items && !error && <p className="text-sm text-slate-500">Chargement…</p>}
      {items && shown.length === 0 && <p className="text-sm text-slate-500">Aucune annonce ne correspond.</p>}
      <div className="space-y-2">
        {shown.map((l) => (
          <Link key={l.id} to={`/annonce/${l.id}`} className="card block hover:border-navy-700">
            <p className="font-medium text-navy-950">{l.title}</p>
            <p className="text-sm text-slate-500">
              {PLATFORM_LABEL[l.platform]} · {l.price_cents == null ? 'prix inconnu' : formatEuros(l.price_cents)} ·{' '}
              {new Date(l.detected_at).toLocaleDateString('fr-FR')} · {SOURCE_KIND_LABEL[l.source_kind ?? 'manual']}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
