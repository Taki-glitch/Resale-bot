import { db } from './db.ts';
import { logActivity } from './audit.ts';
import { RESTORE_ORDER } from '../core/backup.ts';
import type { PreparedRestore } from '../core/backup.ts';
import { chunk } from '../lib/store.ts';

const TABLES = [...RESTORE_ORDER];

/** Sauvegarde JSON de toutes vos données (lecture seule, protégée par RLS). Les fichiers photo ne sont pas inclus (seuls leurs chemins). */
export async function exportAllData(): Promise<string> {
  const client = db();
  const tables: Record<string, unknown[]> = {};
  for (const t of TABLES) {
    const { data, error } = await client.from(t).select('*').limit(10000);
    if (error) throw new Error(`${t} : ${error.message}`);
    tables[t] = data ?? [];
  }
  const { data: settings } = await client.from('users').select('settings').maybeSingle();
  await logActivity('backup_exported', null, null, { rows: Object.fromEntries(Object.entries(tables).map(([k, v]) => [k, v.length])) });
  return JSON.stringify({ app: 'resale-bot', version: '0.5.0', exportedAt: new Date().toISOString(), settings: settings?.settings ?? {}, tables }, null, 2);
}

/** Tables dont un conflit d'unicité (même clé de déduplication, même nom) n'est pas bloquant : la ligne est simplement ignorée. */
const OPTIONAL = new Set(['notifications', 'search_configs']);

/**
 * Restaure une sauvegarde préparée (core/backup.ts) : ajoute ou met à jour les lignes par identifiant, ne supprime RIEN.
 * Rejouable sans doublon. S'arrête à la première table obligatoire en erreur (les tables précédentes restent restaurées).
 */
export async function restoreBackup(
  prepared: PreparedRestore,
  opts: { settings: Record<string, unknown> | null; userId: string },
): Promise<{ restored: Record<string, number>; skipped: Record<string, number> }> {
  const client = db();
  const restored: Record<string, number> = {};
  const skipped: Record<string, number> = {};
  for (const table of RESTORE_ORDER) {
    const rows = prepared.tables[table] ?? [];
    if (rows.length === 0) continue;
    restored[table] = 0;
    for (const part of chunk(rows, 100)) {
      const { error } = await client.from(table).upsert(part, { onConflict: 'id' });
      if (!error) {
        restored[table] += part.length;
        continue;
      }
      if (!OPTIONAL.has(table)) throw new Error(`Restauration interrompue à la table « ${table} » : ${error.message}. Les tables précédentes sont restaurées ; la restauration peut être relancée.`);
      for (const row of part) {
        const one = await client.from(table).upsert(row, { onConflict: 'id' });
        if (one.error) skipped[table] = (skipped[table] ?? 0) + 1;
        else restored[table] += 1;
      }
    }
  }
  if (opts.settings && Object.keys(opts.settings).length > 0) {
    const { error } = await client.from('users').update({ settings: opts.settings }).eq('id', opts.userId);
    if (error) throw new Error(`Paramètres non restaurés : ${error.message}`);
  }
  await logActivity('backup_restored', null, null, { restored, skipped, dropped: prepared.dropped, nulled: prepared.nulled });
  return { restored, skipped };
}
