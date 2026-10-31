import { useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { supabase } from '../lib/supabase.ts';
import { useSettings } from '../hooks/useSettings.ts';
import { centsToEuros, eurosToCents } from '../core/settings.ts';
import type { Settings } from '../core/settings.ts';
import { parseEuros } from '../core/format.ts';

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const { settings, loading, error, save } = useSettings();
  const [form, setForm] = useState<Settings>(settings);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => setForm(settings), [settings]);

  const euro = (key: 'totalBudgetCents' | 'maxPerItemCents' | 'minProfitCents' | 'monthlyTargetCents') => (
    <input className="input" type="number" min={0} step="0.01" inputMode="decimal"
      value={centsToEuros(form[key])}
      onChange={(e) => setForm({ ...form, [key]: eurosToCents(Number(e.target.value)) })} />
  );

  const FEE_ROWS = [
    { key: 'vinted:sale', label: 'Vinted (revente)' },
    { key: 'leboncoin:sale', label: 'Leboncoin (revente)' },
  ];
  const setFee = (key: string, patch: Partial<{ percent: number; fixedCents: number }>) =>
    setForm({ ...form, fees: { ...form.fees, [key]: { percent: 0, fixedCents: 0, ...form.fees[key], ...patch } } });

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
      </section>
      <p className="text-xs text-slate-500">Telegram et paramètres IA : à venir (V0.3).</p>
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-primary">Enregistrer</button>
        <button type="button" className="btn btn-ghost" onClick={() => supabase?.auth.signOut()}>Se déconnecter</button>
        {status && <span className="text-sm text-slate-600">{status}</span>}
      </div>
    </form>
  );
}
