import { useState } from 'react';
import { prepareRestore, validateBackup } from '../core/backup.ts';
import type { BackupFile, PreparedRestore } from '../core/backup.ts';
import { exportAllData, restoreBackup } from '../services/backup.ts';
import { downloadFile } from '../lib/download.ts';
import { useAuth } from '../hooks/useAuth.tsx';
import { errMsg } from '../lib/errors.ts';

/** Sauvegarde et restauration. Restaurer n'efface rien : les lignes sont ajoutées ou mises à jour (même identifiant). */
export default function RestoreBackup() {
  const { session } = useAuth();
  const [backup, setBackup] = useState<BackupFile | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [prepared, setPrepared] = useState<PreparedRestore | null>(null);
  const [withSettings, setWithSettings] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    setError(null);
    try {
      downloadFile(`resale-bot-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`, await exportAllData(), 'application/json');
      setMessage('Sauvegarde téléchargée.');
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function pick(file: File | undefined) {
    setBackup(null);
    setPrepared(null);
    setMessage(null);
    setError(null);
    if (!file || !session) return;
    try {
      const v = validateBackup(JSON.parse(await file.text()));
      if (!v.ok) return setError(v.error);
      setBackup(v.backup);
      setCounts(v.counts);
      setPrepared(prepareRestore(v.backup, session.user.id));
    } catch {
      setError("Fichier illisible : ce n'est pas un JSON valide.");
    }
  }

  async function run() {
    if (!prepared || !session) return;
    setBusy(true);
    setError(null);
    try {
      const r = await restoreBackup(prepared, { settings: withSettings ? backup?.settings ?? null : null, userId: session.user.id });
      const total = Object.values(r.restored).reduce((a, n) => a + n, 0);
      const skipped = Object.values(r.skipped).reduce((a, n) => a + n, 0);
      setMessage(`Restauration terminée : ${total} ligne(s) restaurée(s)${skipped > 0 ? `, ${skipped} ignorée(s) (doublons)` : ''}.`);
      setBackup(null);
      setPrepared(null);
      setConfirm('');
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  const dropped = prepared ? Object.values(prepared.dropped).reduce((a, n) => a + n, 0) : 0;
  const nulled = prepared ? Object.values(prepared.nulled).reduce((a, n) => a + n, 0) : 0;

  return (
    <section className="card space-y-3">
      <h2 className="font-semibold text-navy-950">Sauvegarde et restauration</h2>
      <p className="text-xs text-slate-500">
        La sauvegarde contient vos annonces, comparables, analyses, opportunités, achats, inventaire, ventes, dépenses et recherches (pas les fichiers photo, seulement leurs chemins).
        Faites une sauvegarde avant toute migration ou mise à jour importante.
      </p>
      <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => void download()}>
        {busy ? 'Préparation…' : 'Télécharger une sauvegarde (JSON)'}
      </button>

      <div>
        <label className="label">Restaurer depuis un fichier de sauvegarde</label>
        <input type="file" accept="application/json,.json" className="text-sm" onChange={(e) => void pick(e.target.files?.[0])} />
      </div>

      {backup && prepared && (
        <div className="space-y-2 rounded-lg bg-slate-50 p-3 text-sm">
          <p>
            Sauvegarde du <strong>{backup.exportedAt ? new Date(backup.exportedAt).toLocaleString('fr-FR') : 'date inconnue'}</strong> (version {backup.version || '?'}).
          </p>
          <ul className="list-disc pl-5 text-slate-700">
            {Object.entries(counts).map(([t, n]) => (
              <li key={t}>{t} : {n}</li>
            ))}
          </ul>
          {(dropped > 0 || nulled > 0) && (
            <p className="text-warn">
              {dropped > 0 ? `${dropped} ligne(s) écartée(s) (parent obligatoire absent). ` : ''}
              {nulled > 0 ? `${nulled} référence(s) vers des données absentes neutralisée(s).` : ''}
            </p>
          )}
          <p className="text-xs text-slate-500">Aucune donnée existante n'est supprimée. Si les photos ne sont plus dans votre stockage, elles s'afficheront comme absentes.</p>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={withSettings} onChange={(e) => setWithSettings(e.target.checked)} />
            Restaurer aussi les paramètres (remplace les paramètres actuels)
          </label>
          <input className="input" placeholder="Tape RESTAURER pour confirmer" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          <button type="button" className="btn btn-primary" disabled={busy || confirm.trim() !== 'RESTAURER'} onClick={() => void run()}>
            {busy ? 'Restauration…' : 'Restaurer'}
          </button>
        </div>
      )}
      {error && <p className="text-sm text-loss">{error}</p>}
      {message && <p className="text-sm text-gain">{message}</p>}
    </section>
  );
}
