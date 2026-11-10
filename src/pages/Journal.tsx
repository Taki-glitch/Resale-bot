import { useEffect, useState } from 'react';
import { fetchActivity, fetchJobRuns } from '../services/audit.ts';
import type { ActivityRow, JobRunRow } from '../services/audit.ts';
import { AUDIT_LABEL } from '../core/audit.ts';
import { errMsg } from '../lib/errors.ts';

const STATUS: Record<JobRunRow['status'], { label: string; cls: string }> = {
  running: { label: 'En cours', cls: 'text-slate-600' },
  success: { label: 'Réussie', cls: 'text-gain' },
  partial: { label: 'Partielle', cls: 'text-warn' },
  error: { label: 'Erreur', cls: 'text-loss' },
  skipped: { label: 'Ignorée', cls: 'text-slate-500' },
};

export default function Journal() {
  const [activity, setActivity] = useState<ActivityRow[] | null>(null);
  const [runs, setRuns] = useState<JobRunRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchActivity().then(setActivity).catch((e) => setError(errMsg(e)));
    fetchJobRuns().then(setRuns).catch(() => setRuns([])); // table absente avant la migration 0006 : section vide
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-navy-950">Journal</h1>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-navy-950">Maintenance planifiée</h2>
        <p className="text-xs text-slate-500">
          Réévaluation, alertes de stock et Telegram. Aucune collecte sur les plateformes : aucune source autorisée n'est configurée.
        </p>
        {runs && runs.length === 0 && <p className="card text-sm text-slate-600">Aucune exécution pour l'instant (la tâche doit être activée dans GitHub Actions).</p>}
        {(runs ?? []).map((r) => (
          <div key={r.id} className="card text-sm">
            <p>
              <span className={`font-medium ${STATUS[r.status].cls}`}>{STATUS[r.status].label}</span> ·{' '}
              {new Date(r.started_at).toLocaleString('fr-FR')}
            </p>
            {r.error && <p className="text-loss">{r.error}</p>}
            {Object.keys(r.stats ?? {}).length > 0 && (
              <p className="text-xs text-slate-500">
                {r.stats.evaluated ?? 0} annonce(s) évaluée(s), {r.stats.updated ?? 0} mise(s) à jour, {r.stats.agingAlerts ?? 0} alerte(s) de stock,{' '}
                {r.stats.telegramSent ?? 0} message(s) Telegram
              </p>
            )}
          </div>
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-navy-950">Opérations sensibles</h2>
        {error && <p className="text-sm text-loss">{error}</p>}
        {!activity && !error && <p className="text-sm text-slate-500">Chargement…</p>}
        {activity && activity.length === 0 && <p className="card text-sm text-slate-600">Aucune opération enregistrée.</p>}
        {(activity ?? []).map((a) => (
          <div key={a.id} className="card text-sm">
            <p className="font-medium text-navy-950">{AUDIT_LABEL[a.action] ?? a.action}</p>
            <p className="text-xs text-slate-500">{new Date(a.created_at).toLocaleString('fr-FR')}{a.entity ? ` · ${a.entity}` : ''}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
