import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createListing, fetchListingsWithMeta, toSearchable } from '../services/listings.ts';
import ListingForm, { EMPTY_LISTING_FORM } from '../components/ListingForm.tsx';
import SavedSearches from '../components/SavedSearches.tsx';
import { ActionBadge, ScoreChip } from '../components/badges.tsx';
import PhotoThumb from '../components/PhotoThumb.tsx';
import { EMPTY_CRITERIA, filterListings, SORT_LABEL, sortListings } from '../core/search.ts';
import type { SearchCriteria, SearchSort } from '../core/search.ts';
import { STATUS_LABEL, STATUS_ORDER } from '../core/opportunities.ts';
import { formatEuros, parseEuros } from '../core/format.ts';
import { PLATFORM_LABEL, SOURCE_KIND_LABEL } from '../lib/labels.ts';
import { errMsg } from '../lib/errors.ts';
import type { ListingWithMeta, Platform } from '../types.ts';

interface Drafts {
  maxPrice: string;
  minProfit: string;
  minMargin: string;
  minScore: string;
}
const EMPTY_DRAFTS: Drafts = { maxPrice: '', minProfit: '', minMargin: '', minScore: '' };
const cents = (v: number | null): string => (v === null ? '' : String(v / 100).replace('.', ','));
const numStr = (v: number | null): string => (v === null ? '' : String(v));
const num = (s: string): number | null => {
  const n = Number(s.replace(',', '.'));
  return s.trim() !== '' && Number.isFinite(n) ? n : null;
};

export default function Listings() {
  const navigate = useNavigate();
  const [items, setItems] = useState<ListingWithMeta[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [base, setBase] = useState<SearchCriteria>(EMPTY_CRITERIA);
  const [drafts, setDrafts] = useState<Drafts>(EMPTY_DRAFTS);
  const [sort, setSort] = useState<SearchSort>('date');

  const load = useCallback(async () => {
    try {
      setItems(await fetchListingsWithMeta());
    } catch (e) {
      setError(errMsg(e));
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const criteria: SearchCriteria = useMemo(
    () => ({
      ...base,
      maxPriceCents: parseEuros(drafts.maxPrice),
      minProfitCents: parseEuros(drafts.minProfit),
      minMarginPct: num(drafts.minMargin),
      minScore: num(drafts.minScore),
    }),
    [base, drafts],
  );

  const byId = useMemo(() => new Map((items ?? []).map((l) => [l.id, l])), [items]);
  const shown = useMemo(
    () => sortListings(filterListings((items ?? []).map(toSearchable), criteria), sort).map((s) => byId.get(s.id) as ListingWithMeta),
    [items, criteria, sort, byId],
  );
  const categories = useMemo(() => Array.from(new Set((items ?? []).map((l) => l.product?.category).filter((c): c is string => Boolean(c)))).sort(), [items]);
  const activeFilters = Object.values(criteria).filter((v) => v !== '' && v !== null).length;

  const apply = (c: SearchCriteria, s: SearchSort) => {
    setBase(c);
    setSort(s);
    setDrafts({ maxPrice: cents(c.maxPriceCents), minProfit: cents(c.minProfitCents), minMargin: numStr(c.minMarginPct), minScore: numStr(c.minScore) });
  };
  const set = (patch: Partial<SearchCriteria>) => setBase((b) => ({ ...b, ...patch }));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-navy-950">Recherche d'annonces</h1>
      <p className="card text-sm text-slate-600">
        Annonces que vous avez ajoutées. Aucun connecteur automatique n'est actif (aucune source autorisée configurée) : la saisie est manuelle et les
        recherches enregistrées ne surveillent aucune plateforme, elles mémorisent seulement vos filtres.
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
        <input className="input" placeholder="Mot-clé (titre, marque, modèle…)" value={base.keyword} onChange={(e) => set({ keyword: e.target.value })} />
        <select className="input" value={sort} onChange={(e) => setSort(e.target.value as SearchSort)}>
          {(Object.keys(SORT_LABEL) as SearchSort[]).map((k) => (
            <option key={k} value={k}>Tri : {SORT_LABEL[k]}</option>
          ))}
        </select>
      </div>

      <details className="card space-y-3">
        <summary className="cursor-pointer text-sm font-medium text-navy-950">
          Filtres et recherches enregistrées {activeFilters > 0 ? `(${activeFilters} actif${activeFilters > 1 ? 's' : ''})` : ''}
        </summary>
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div>
            <label className="label">Plateforme</label>
            <select className="input" value={base.platform} onChange={(e) => set({ platform: e.target.value })}>
              <option value="">Toutes</option>
              {(Object.keys(PLATFORM_LABEL) as Platform[]).map((p) => (
                <option key={p} value={p}>{PLATFORM_LABEL[p]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Catégorie</label>
            <select className="input" value={base.category} onChange={(e) => set({ category: e.target.value })}>
              <option value="">Toutes</option>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Marque</label>
            <input className="input" value={base.brand} onChange={(e) => set({ brand: e.target.value })} />
          </div>
          <div>
            <label className="label">Prix d'achat max (€)</label>
            <input className="input" inputMode="decimal" value={drafts.maxPrice} onChange={(e) => setDrafts({ ...drafts, maxPrice: e.target.value })} />
          </div>
          <div>
            <label className="label">Bénéfice estimé min (€)</label>
            <input className="input" inputMode="decimal" value={drafts.minProfit} onChange={(e) => setDrafts({ ...drafts, minProfit: e.target.value })} />
          </div>
          <div>
            <label className="label">Marge min (%)</label>
            <input className="input" inputMode="decimal" value={drafts.minMargin} onChange={(e) => setDrafts({ ...drafts, minMargin: e.target.value })} />
          </div>
          <div>
            <label className="label">Score min</label>
            <input className="input" inputMode="numeric" value={drafts.minScore} onChange={(e) => setDrafts({ ...drafts, minScore: e.target.value })} />
          </div>
          <div>
            <label className="label">Confiance</label>
            <select className="input" value={base.confidence} onChange={(e) => set({ confidence: e.target.value as SearchCriteria['confidence'] })}>
              <option value="">Toutes</option>
              <option value="low">Faible</option>
              <option value="medium">Moyenne</option>
              <option value="high">Élevée</option>
            </select>
          </div>
          <div>
            <label className="label">Statut</label>
            <select className="input" value={base.status} onChange={(e) => set({ status: e.target.value as SearchCriteria['status'] })}>
              <option value="">Tous</option>
              <option value="unevaluated">Non évaluées</option>
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>{STATUS_LABEL[s]}</option>
              ))}
            </select>
          </div>
        </div>
        <button className="btn btn-ghost" onClick={() => apply(EMPTY_CRITERIA, 'date')}>Réinitialiser les filtres</button>
        <SavedSearches criteria={criteria} sort={sort} onApply={apply} />
      </details>

      {error && <p className="text-sm text-loss">{error}</p>}
      {!items && !error && <p className="text-sm text-slate-500">Chargement…</p>}
      {items && items.length === 0 && (
        <p className="card text-sm text-slate-600">Aucune annonce pour l'instant. Ajoute ta première annonce avec le bouton ci-dessus.</p>
      )}
      {items && items.length > 0 && <p className="text-xs text-slate-500">{shown.length} annonce(s) sur {items.length}</p>}
      {items && items.length > 0 && shown.length === 0 && <p className="text-sm text-slate-500">Aucune annonce ne correspond aux filtres.</p>}
      <div className="space-y-2">
        {shown.map((l) => (
          <Link key={l.id} to={`/annonce/${l.id}`} className="card flex items-start gap-3 hover:border-navy-700">
            <PhotoThumb paths={l.photos ?? []} size={56} />
            <div className="min-w-0 flex-1 space-y-1">
            <p className="font-medium text-navy-950">{l.title}</p>
            <p className="text-sm text-slate-500">
              {PLATFORM_LABEL[l.platform]} · {l.price_cents == null ? 'prix inconnu' : formatEuros(l.price_cents)} ·{' '}
              {new Date(l.detected_at).toLocaleDateString('fr-FR')} · {SOURCE_KIND_LABEL[l.source_kind ?? 'manual']}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {l.opportunity?.recommendation ? (
                <ActionBadge recommendation={l.opportunity.recommendation} priceCents={l.price_cents} maxBuyCents={l.opportunity.max_buy_cents} />
              ) : (
                <span className="text-xs text-slate-400">Non évaluée</span>
              )}
              <ScoreChip score={l.opportunity?.score ?? null} />
              {l.opportunity?.est_profit_cents != null && (
                <span className="text-xs text-slate-600">Bénéfice net est. {formatEuros(l.opportunity.est_profit_cents)}</span>
              )}
            </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
