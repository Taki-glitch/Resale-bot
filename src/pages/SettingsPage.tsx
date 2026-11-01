import { useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { supabase } from '../lib/supabase.ts';
import { useSettings } from '../hooks/useSettings.ts';
import { centsToEuros, eurosToCents } from '../core/settings.ts';
import type { Settings } from '../core/settings.ts';
import { parseEuros } from '../core/format.ts';
import { CRITERIA_KEYS, CRITERIA_LABEL, DEFAULT_WEIGHTS } from '../core/scoring.ts';

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

type EuroKey = 'totalBudgetCents' | 'maxPerItemCents' | 'minProfitCents' | 'monthlyTargetCents' | 'defaultOtherCostsCents';

const FEE_ROWS = [
  { key: 'vinted:sale', label: 'Vinted (revente)' },
  { key: 'leboncoin:sale', label: 'Leboncoin (revente)' },
];

export default function SettingsPage() {
  const { settings, loading, error, save } = useSettings();
  const [form, setForm] = useState<Settings>(settings);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => setForm(settings), [settings]);

  const euro = (key: EuroKey) => (
    <input
      className="input"
      type="number"
      min={0}
      step="0.01"
      inputMode="decimal"
      value={centsToEuros(form[key])}
      onChange={(e) => setForm({ ...form, [key]: eurosToCents(Number(e.target.value)) })}
    />
  );

  const setFee = (key: string, patch: Partial<{ percent: number; fixedCents: number }>) => {
    const current = form.fees[key] ?? { percent: 0, fixedCents: 0 };
    setForm({
      ...form,
      fees: { ...form.fees, [key]: { ...current, ...patch } },
    });
  };

  const weightsTotal = CRITERIA_KEYS.reduce((sum, k) => sum + (Number(form.scoringWeights[k]) || 0), 0);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const err = await save(form);
    setStatus(err ? `Erreur : ${err}` : 'Réglages enregistrés.');
  }

  if (loading) return <p className="text-sm text-slate-500">Chargement…</p>;

  return (
    <form onSubmit={submit} className="space-y-6">
      <h1 className="text-2xl font-semibold text-navy-950">Paramètres</h1>
      {error && <p className="text-sm text-loss">{error}</p>}

      <section className="card grid gap-4 md:grid-cols-2">
        <Field label="Budget total (€)">{euro('totalBudgetCents')}</Field>
        <Field label="Budget maximal par article (€)">{euro('maxPerItemCents')}</Field>
        <Field label="Bénéfice minimum par article (€)">{euro('minProfitCents')}</Field>
        <Field label="Objectif de bénéfice mensuel (€)">{euro('monthlyTargetCents')}</Field>
        <Field label="Rendement minimum (%)">
          <input className="input" type="number" min={0} inputMode="decimal" value={form.minRoiPct}
            onChange={(e) => setForm({ ...form, minRoiPct: Number(e.target.value) })} />
        </Field>
        <Field label="Distance maximale (km)">
          <input className="input" type="number" min={0} inputMode="numeric" value={form.maxDistanceKm}
            onChange={(e) => setForm({ ...form, maxDistanceKm: Number(e.target.value) })} />
        </Field>
        <Field label="Localisation">
          <input className="input" value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })} />
        </Field>
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold text-navy-950">Frais de vente par plateforme</h2>
        <p className="text-xs text-slate-500">
          À renseigner d'après les conditions actuelles de chaque plateforme (elles changent selon le type de vente et la
          livraison). Tant qu'ils valent 0, le calculateur ne déduit aucun frais.
        </p>
        {FEE_ROWS.map(({ key, label }) => (
          <div key={key} className="grid grid-cols-2 gap-3">
            <Field label={`${label} : frais (%)`}>
              <input className="input" type="number" min={0} step="0.1" inputMode="decimal"
                value={form.fees[key]?.percent ?? 0}
                onChange={(e) => setFee(key, { percent: Number(e.target.value) })} />
            </Field>
            <Field label={`${label} : frais fixes (€)`}>
              <input className="input" inputMode="decimal"
                key={`${key}-${settings.fees[key]?.fixedCents ?? 0}`}
                defaultValue={centsToEuros(settings.fees[key]?.fixedCents ?? 0)}
                onBlur={(e) => setFee(key, { fixedCents: parseEuros(e.target.value) ?? 0 })} />
            </Field>
          </div>
        ))}
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Plateforme de revente par défaut (évaluation)">
            <select className="input" value={form.resalePlatform} onChange={(e) => setForm({ ...form, resalePlatform: e.target.value })}>
              <option value="vinted">Vinted</option>
              <option value="leboncoin">Leboncoin</option>
            </select>
          </Field>
          <Field label="Coûts annexes moyens par article (€) : livraison, emballage…">{euro('defaultOtherCostsCents')}</Field>
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold text-navy-950">Pondération du score</h2>
        <p className="text-xs text-slate-500">
          Importance de chaque critère. Les poids sont ramenés à 100 au calcul. Un critère non mesuré rapporte 0 point.
        </p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {CRITERIA_KEYS.map((k) => (
            <Field key={k} label={CRITERIA_LABEL[k]}>
              <input className="input" type="number" min={0} inputMode="decimal"
                value={form.scoringWeights[k]}
                onChange={(e) => setForm({ ...form, scoringWeights: { ...form.scoringWeights, [k]: Number(e.target.value) } })} />
            </Field>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
          <span>Total saisi : {weightsTotal}</span>
          <button type="button" className="btn btn-ghost"
            onClick={() => setForm({ ...form, scoringWeights: { ...DEFAULT_WEIGHTS } })}>
            Rétablir les poids par défaut
          </button>
        </div>
      </section>

      <p className="text-xs text-slate-500">Telegram : à venir dans une version ultérieure.</p>
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-primary">Enregistrer</button>
        <button type="button" className="btn btn-ghost" onClick={() => supabase?.auth.signOut()}>Se déconnecter</button>
        {status && <span className="text-sm text-slate-600">{status}</span>}
      </div>
    </form>
  );
}
