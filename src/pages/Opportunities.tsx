
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSettings } from '../hooks/useSettings.ts';
import { formatEuros } from '../core/settings.ts';
import { errMsg } from '../lib/errors.ts';
import { fetchOpportunities, refreshOpportunities, updateOpportunityStatus } from '../services/opportunities.ts';
import type { OpportunityRecord } from '../services/opportunities.ts';

const riskLabel = { low: 'Faible', medium: 'Modéré', high: 'Élevé' } as const;
const statusOptions = [
  ['new', 'Nouvelle'], ['to_check', 'À vérifier'], ['interesting', 'Intéressante'],
  ['to_negotiate', 'À négocier'], ['rejected', 'Écartée'],
];

export default function Opportunities() {
  const { settings } = useSettings();
  const [items, setItems] = useState<OpportunityRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [risk, setRisk] = useState('all');
  const [sort, setSort] = useState('score');

  const load = useCallback(async () => {
    try { setItems(await fetchOpportunities()); setError(null); }
    catch (e) { setError(errMsg(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function calculate() {
    setBusy(true); setError(null);
    try {
      const count = await refreshOpportunities({
        fees: settings.fees, minProfitCents: settings.minProfitCents,
        minRoiPct: settings.minRoiPct, maxPerItemCents: settings.maxPerItemCents,
      });
      await load();
      if (!count) setError('Aucune annonce active à qualifier. Ajoute d’abord des annonces.');
    } catch (e) { setError(errMsg(e)); }
    finally { setBusy(false); }
  }

  async function changeStatus(id: string, status: string) {
    try { await updateOpportunityStatus(id, status); await load(); }
    catch (e) { setError(errMsg(e)); }
  }

  const visible = items.filter((x) => risk === 'all' || x.risk_level === risk)
    .sort((a, b) => sort === 'profit'
      ? (b.est_profit_cents ?? -Infinity) - (a.est_profit_cents ?? -Infinity)
      : (b.score ?? -1) - (a.score ?? -1));

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-2xl font-semibold text-navy-950">Opportunités</h1>
        <p className="text-sm text-slate-500">Classement des annonces importées, sans achat automatique.</p></div>
      <button className="btn btn-primary" disabled={busy} onClick={calculate}>
        {busy ? 'Qualification…' : 'Actualiser les scores'}
      </button>
    </div>
    <div className="card grid gap-3 sm:grid-cols-2">
      <label className="text-sm">Niveau de risque
        <select className="input mt-1" value={risk} onChange={(e) => setRisk(e.target.value)}>
          <option value="all">Tous</option><option value="low">Faible</option><option value="medium">Modéré</option><option value="high">Élevé</option>
        </select>
      </label>
      <label className="text-sm">Trier par
        <select className="input mt-1" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="score">Meilleur score</option><option value="profit">Bénéfice estimé</option>
        </select>
      </label>
    </div>
    {error && <p className="card text-sm text-loss">{error}</p>}
    {loading ? <p className="text-sm text-slate-500">Chargement…</p> : visible.length === 0
      ? <p className="card text-sm text-slate-600">Aucune opportunité qualifiée. Clique sur « Actualiser les scores » pour analyser les annonces déjà importées.</p>
      : <div className="space-y-3">{visible.map((o) => {
        const l = o.listing;
        if (!l) return null;
        const details = o.score_detail ?? {};
        return <article className="card space-y-3" key={o.id}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0"><Link className="font-semibold text-navy-950 hover:underline" to={`/annonce/${l.id}`}>{l.title}</Link>
              <p className="text-xs text-slate-500">{l.platform} · Achat {l.price_cents == null ? 'inconnu' : formatEuros(l.price_cents)}</p></div>
            <div className="text-right"><p className="text-2xl font-semibold">{o.score ?? '—'}<span className="text-sm text-slate-400">/100</span></p>
              <p className="text-xs text-slate-500">Risque {o.risk_level ? riskLabel[o.risk_level] : 'inconnu'}</p></div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><p className="text-slate-500">Bénéfice estimé</p><strong>{o.est_profit_cents == null ? 'Indisponible' : formatEuros(o.est_profit_cents)}</strong></div>
            <div><p className="text-slate-500">Achat maximum conseillé</p><strong>{o.max_buy_cents == null ? 'Indisponible' : formatEuros(o.max_buy_cents)}</strong></div>
          </div>
          {details.reasons?.length ? <ul className="list-disc pl-5 text-xs text-slate-600">{details.reasons.map((r) => <li key={r}>{r}</li>)}</ul> : null}
          {details.missing?.length ? <p className="text-xs text-warn">À compléter : {details.missing.join(' · ')}</p> : null}
          <p className="text-xs text-slate-500">Estimation indicative avant coûts non renseignés ; les prix affichés ne garantissent pas une vente.</p>
          <label className="text-sm">Statut
            <select className="input mt-1" value={o.status} onChange={(e) => void changeStatus(o.id, e.target.value)}>
              {statusOptions.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
            </select>
          </label>
        </article>;
      })}</div>}
  </div>;
}
