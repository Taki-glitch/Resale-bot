import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Star } from 'lucide-react';
import { fetchOpportunityViews, updateOpportunity } from '../services/opportunities.ts';
import { DEFAULT_FILTERS, filterOpportunities, sortOpportunities, STATUS_LABEL, STATUS_ORDER } from '../core/opportunities.ts';
import type { OpportunityFilters, OpportunityView, SortKey } from '../core/opportunities.ts';
import { formatEuros, formatPct, parseEuros } from '../core/format.ts';
import { RecommendationBadge, RiskBadge } from '../components/badges.tsx';
import { PLATFORM_LABEL } from '../lib/labels.ts';
import { errMsg } from '../lib/errors.ts';
import type { Platform } from '../types.ts';

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'score', label: 'Meilleur score' },
  { key: 'profit', label: 'Meilleur bénéfice' },
  { key: 'margin', label: 'Meilleure marge' },
  { key: 'risk', label: 'Risque le plus faible' },
];

const money = (c: number | null) => (c === null ? '—' : formatEuros(c));

export default function Opportunities() {
  const [rows, setRows] = useState<OpportunityView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<OpportunityFilters>(DEFAULT_FILTERS);
  const [budget, setBudget] = useState('');
  const [minProfit, setMinProfit] = useState('');
  const [sort, setSort] = useState<SortKey>('score');

  const load = useCallback(async () => {
    try {
      setRows(await fetchOpportunityViews());
      setError(null);
    } catch (e) {
      setError(errMsg(e));
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const categories = useMemo(
    () => Array.from(new Set((rows ?? []).map((r) => r.category).filter((c): c is string => Boolean(c)))).sort(),
    [rows],
  );

  const shown = useMemo(
    () =>
      sortOpportunities(
        filterOpportunities(rows ?? [], { ...filters, maxBudgetCents: parseEuros(budget), minProfitCents: parseEuros(minProfit) }),
        sort,
      ),
    [rows, filters, budget, minProfit, sort],
  );

  const set = (patch: Partial<OpportunityFilters>) => setFilters((f) => ({ ...f, ...patch }));

  async function toggleSelected(o: OpportunityView) {
    try {
      await updateOpportunity(o.id, { is_selected: !o.isSelected });
      setRows((prev) => (prev ?? []).map((r) => (r.id === o.id ? { ...r, isSelected: !r.isSelected } : r)));
    } catch (e) {
      setError(errMsg(e));
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-navy-950">Opportunités</h1>
      <p className="text-sm text-slate-600">
        Annonces évaluées à partir de vos comparables, classées par potentiel. Ce sont des estimations : la décision d'achat vous appartient.
      </p>

      <div className="card grid grid-cols-2 gap-3 md:grid-cols-4">
        <div>
          <label className="label">Plateforme</label>
          <select className="input" value={filters.platform} onChange={(e) => set({ platform: e.target.value })}>
            <option value="">Toutes</option>
            {(Object.keys(PLATFORM_LABEL) as Platform[]).map((p) => (
              <option key={p} value={p}>{PLATFORM_LABEL[p]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Catégorie</label>
          <select className="input" value={filters.category} onChange={(e) => set({ category: e.target.value })}>
            <option value="">Toutes</option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Budget max (€)</label>
          <input className="input" inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} />
        </div>
        <div>
          <label className="label">Bénéfice min (€)</label>
          <input className="input" inputMode="decimal" value={minProfit} onChange={(e) => setMinProfit(e.target.value)} />
        </div>
        <div>
          <label className="label">Statut</label>
          <select className="input" value={filters.status} onChange={(e) => set({ status: e.target.value as OpportunityFilters['status'] })}>
            <option value="active">En cours</option>
            <option value="all">Historique complet</option>
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Trier par</label>
          <select className="input" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
        </div>
        <label className="flex min-h-[44px] items-center gap-2 text-sm">
          <input type="checkbox" checked={filters.selectedOnly} onChange={(e) => set({ selectedOnly: e.target.checked })} />
          Ma sélection
        </label>
        <label className="flex min-h-[44px] items-center gap-2 text-sm">
          <input type="checkbox" checked={filters.includeUnevaluable} onChange={(e) => set({ includeUnevaluable: e.target.checked })} />
          Non évaluables
        </label>
      </div>

      {error && <p className="text-sm text-loss">{error}</p>}
      {!rows && !error && <p className="text-sm text-slate-500">Chargement…</p>}
      {rows && rows.length === 0 && (
        <p className="card text-sm text-slate-600">
          Aucune annonce évaluée. Ouvre une annonce depuis « Recherche », ajoute au moins 3 comparables : l'évaluation s'enregistre alors ici.
        </p>
      )}
      {rows && rows.length > 0 && shown.length === 0 && <p className="text-sm text-slate-500">Aucune opportunité ne correspond aux filtres.</p>}

      <div className="space-y-3">
        {shown.map((o) => (
          <div key={o.id} className="card space-y-2">
            <div className="flex items-start justify-between gap-2">
              <Link to={`/annonce/${o.listingId}`} className="min-w-0 flex-1">
                <p className="font-medium text-navy-950">{o.title}</p>
                <p className="text-xs text-slate-500">
                  {PLATFORM_LABEL[o.platform as Platform] ?? o.platform}
                  {o.category ? ` · ${o.category}` : ''} · {STATUS_LABEL[o.status]}
                </p>
              </Link>
              <button
                className="btn btn-ghost !min-h-[40px] !px-2"
                aria-label={o.isSelected ? 'Retirer de ma sélection' : 'Ajouter à ma sélection'}
                onClick={() => void toggleSelected(o)}
              >
                <Star size={18} fill={o.isSelected ? 'currentColor' : 'none'} />
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <RecommendationBadge value={o.recommendation} />
              <RiskBadge value={o.riskLevel} />
              {o.score !== null && <span className="text-xs text-slate-600">Score {o.score}/100</span>}
              {o.confidence !== null && <span className="text-xs text-slate-600">Confiance {Math.round(o.confidence * 100)} %</span>}
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
              <p><span className="text-slate-500">Achat</span> {money(o.priceCents)}</p>
              <p><span className="text-slate-500">Revente est.</span> {money(o.resaleEstimateCents)}</p>
              <p className={o.netProfitCents !== null && o.netProfitCents > 0 ? 'text-gain' : 'text-loss'}>
                <span className="text-slate-500">Bénéfice net</span> {money(o.netProfitCents)}
              </p>
              <p><span className="text-slate-500">Marge</span> {formatPct(o.netMarginPct)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
