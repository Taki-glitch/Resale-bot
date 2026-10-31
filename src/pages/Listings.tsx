import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createListing, DuplicateListingError, fetchListings } from '../services/listings.ts';
import { parseListingUrl } from '../core/listing.ts';
import { parseEuros } from '../core/format.ts';
import { formatEuros } from '../core/settings.ts';
import { errMsg } from '../lib/errors.ts';
import type { Listing, Platform } from '../types.ts';
import SavedSearches from '../components/SavedSearches.tsx';
import type { ListingSearchFilters } from '../services/searches.ts';

const CONDITIONS = ['Neuf avec étiquette', 'Neuf sans étiquette', 'Très bon état', 'Bon état', 'Satisfaisant', 'Inconnu'];
const PLATFORM_LABEL: Record<Platform, string> = { vinted: 'Vinted', leboncoin: 'Leboncoin', manual: 'Manuel', other: 'Autre' };

const EMPTY = {
  platform: 'vinted' as Platform, url: '', title: '', price: '', condition: 'Inconnu',
  description: '', location: '', brand: '', model: '', category: '',
};

function NewListingForm() {
  const navigate = useNavigate();
  const [f, setF] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dupId, setDupId] = useState<string | null>(null);

  const set = (patch: Partial<typeof EMPTY>) => setF((prev) => ({ ...prev, ...patch }));

  function onUrl(url: string) {
    const parsed = url ? parseListingUrl(url) : null;
    set({ url, ...(parsed && parsed.platform !== 'other' ? { platform: parsed.platform } : {}) });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setDupId(null);
    if (f.title.trim() === '') return setError('Le titre est obligatoire.');
    const priceCents = parseEuros(f.price);
    if (priceCents === null) return setError('Indique le prix demandé (ex. 25 ou 25,50).');
    setBusy(true);
    try {
      const id = await createListing({
        platform: f.platform, url: f.url, title: f.title, description: f.description,
        priceCents, condition: f.condition === 'Inconnu' ? '' : f.condition,
        location: f.location, brand: f.brand, model: f.model, category: f.category,
      });
      navigate(`/annonce/${id}`);
    } catch (err) {
      if (err instanceof DuplicateListingError) setDupId(err.existingId);
      else setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-4">
      <h2 className="font-semibold text-navy-950">Ajouter une annonce</h2>
      <p className="text-xs text-slate-500">
        Colle le lien pour le conserver (il n'est jamais visité automatiquement), puis recopie les informations de l'annonce.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="label">Lien de l'annonce (optionnel)</label>
          <input className="input" type="url" value={f.url} onChange={(e) => onUrl(e.target.value)} placeholder="https://…" />
        </div>
        <div>
          <label className="label">Plateforme</label>
          <select className="input" value={f.platform} onChange={(e) => set({ platform: e.target.value as Platform })}>
            {(Object.keys(PLATFORM_LABEL) as Platform[]).map((p) => (
              <option key={p} value={p}>{PLATFORM_LABEL[p]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Prix demandé (€)</label>
          <input className="input" inputMode="decimal" value={f.price} onChange={(e) => set({ price: e.target.value })} />
        </div>
        <div className="md:col-span-2">
          <label className="label">Titre</label>
          <input className="input" value={f.title} onChange={(e) => set({ title: e.target.value })} />
        </div>
        <div>
          <label className="label">État déclaré</label>
          <select className="input" value={f.condition} onChange={(e) => set({ condition: e.target.value })}>
            {CONDITIONS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Localisation</label>
          <input className="input" value={f.location} onChange={(e) => set({ location: e.target.value })} />
        </div>
        <div>
          <label className="label">Marque (optionnel)</label>
          <input className="input" value={f.brand} onChange={(e) => set({ brand: e.target.value })} />
        </div>
        <div>
          <label className="label">Modèle (optionnel)</label>
          <input className="input" value={f.model} onChange={(e) => set({ model: e.target.value })} />
        </div>
        <div className="md:col-span-2">
          <label className="label">Catégorie (optionnel)</label>
          <input className="input" value={f.category} onChange={(e) => set({ category: e.target.value })} />
        </div>
        <div className="md:col-span-2">
          <label className="label">Description</label>
          <textarea className="input min-h-[96px] py-2" value={f.description} onChange={(e) => set({ description: e.target.value })} />
        </div>
      </div>
      {error && <p className="text-sm text-loss">{error}</p>}
      {dupId && (
        <p className="text-sm text-warn">
          Cette annonce existe déjà. <Link className="underline" to={`/annonce/${dupId}`}>Ouvrir la fiche existante</Link>
        </p>
      )}
      <button className="btn btn-primary" disabled={busy}>{busy ? 'Enregistrement…' : "Enregistrer l'annonce"}</button>
    </form>
  );
}

export default function Listings() {
  const [items, setItems] = useState<Listing[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [filters, setFilters] = useState<ListingSearchFilters>({
    keyword: '', platform: 'all', category: '', location: '', maxPrice: '',
  });

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

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-navy-950">Recherche d'annonces</h1>
      <p className="card text-sm text-slate-600">
        Import manuel uniquement : aucun connecteur automatique n'est actif. Les filtres portent sur les annonces déjà importées.
      </p>
      <section className="card grid gap-3 sm:grid-cols-2">
        <label className="text-sm">Mot-clé
          <input className="input mt-1" value={filters.keyword} onChange={(e) => setFilters({ ...filters, keyword: e.target.value })} placeholder="Titre, marque…" />
        </label>
        <label className="text-sm">Plateforme
          <select className="input mt-1" value={filters.platform} onChange={(e) => setFilters({ ...filters, platform: e.target.value })}>
            <option value="all">Toutes</option><option value="vinted">Vinted</option><option value="leboncoin">Leboncoin</option><option value="manual">Manuel</option><option value="other">Autre</option>
          </select>
        </label>
        <label className="text-sm">Catégorie
          <input className="input mt-1" value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })} />
        </label>
        <label className="text-sm">Localisation
          <input className="input mt-1" value={filters.location} onChange={(e) => setFilters({ ...filters, location: e.target.value })} />
        </label>
        <label className="text-sm">Prix maximum (€)
          <input className="input mt-1" type="number" min="0" step="0.01" value={filters.maxPrice} onChange={(e) => setFilters({ ...filters, maxPrice: e.target.value })} />
        </label>
        <div className="flex items-end"><button className="btn btn-ghost" type="button" onClick={() => setFilters({ keyword: '', platform: 'all', category: '', location: '', maxPrice: '' })}>Effacer les filtres</button></div>
      </section>
      <SavedSearches filters={filters} onApply={setFilters} />
      <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
        {showForm ? 'Fermer' : 'Ajouter une annonce'}
      </button>
      {showForm && <NewListingForm />}
      {error && <p className="text-sm text-loss">{error}</p>}
      {!items && !error && <p className="text-sm text-slate-500">Chargement…</p>}
      {items && items.length === 0 && <p className="text-sm text-slate-500">Aucune annonce pour l'instant.</p>}
      <div className="space-y-2">
        {(items ?? []).filter((l) => {
          const q = filters.keyword.trim().toLocaleLowerCase('fr');
          const haystack = `${l.title} ${l.description ?? ''} ${l.product?.brand ?? ''} ${l.product?.model ?? ''} ${l.product?.category ?? ''}`.toLocaleLowerCase('fr');
          const categoryMatch = !filters.category || haystack.includes(filters.category.toLocaleLowerCase('fr'));
          const locationMatch = !filters.location || (l.location ?? '').toLocaleLowerCase('fr').includes(filters.location.toLocaleLowerCase('fr'));
          const priceMatch = !filters.maxPrice || (l.price_cents != null && l.price_cents <= Number(filters.maxPrice) * 100);
          return (!q || haystack.includes(q)) && (filters.platform === 'all' || l.platform === filters.platform) && categoryMatch && locationMatch && priceMatch;
        }).map((l) => (
          <Link key={l.id} to={`/annonce/${l.id}`} className="card block hover:border-navy-700">
            <p className="font-medium text-navy-950">{l.title}</p>
            <p className="text-sm text-slate-500">
              {PLATFORM_LABEL[l.platform]} · {l.price_cents == null ? 'prix inconnu' : formatEuros(l.price_cents)} ·{' '}
              {new Date(l.detected_at).toLocaleDateString('fr-FR')}
            </p>
          </Link>
        ))}
        {items && items.length > 0 && items.filter((l) => {
          const q = filters.keyword.trim().toLocaleLowerCase('fr');
          const haystack = `${l.title} ${l.description ?? ''} ${l.product?.brand ?? ''} ${l.product?.model ?? ''} ${l.product?.category ?? ''}`.toLocaleLowerCase('fr');
          return (!q || haystack.includes(q)) && (filters.platform === 'all' || l.platform === filters.platform)
            && (!filters.category || haystack.includes(filters.category.toLocaleLowerCase('fr')))
            && (!filters.location || (l.location ?? '').toLocaleLowerCase('fr').includes(filters.location.toLocaleLowerCase('fr')))
            && (!filters.maxPrice || (l.price_cents != null && l.price_cents <= Number(filters.maxPrice) * 100));
        }).length === 0 && <p className="text-sm text-slate-500">Aucune annonce ne correspond aux filtres.</p>}
      </div>
    </div>
  );
}
