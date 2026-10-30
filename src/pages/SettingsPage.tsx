import { useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { supabase } from '../lib/supabase.ts';
import { useSettings } from '../hooks/useSettings.ts';
import { centsToEuros, eurosToCents } from '../core/settings.ts';
import type { Settings } from '../core/settings.ts';

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
      <p className="text-xs text-slate-500">
        Frais par plateforme, Telegram et IA : à venir (V0.2 et V0.3). Les frais restent à 0 tant que tu ne les renseignes pas.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-primary">Enregistrer</button>
        <button type="button" className="btn btn-ghost" onClick={() => supabase?.auth.signOut()}>Se déconnecter</button>
        {status && <span className="text-sm text-slate-600">{status}</span>}
      </div>
    </form>
  );
}
