import { db } from './db.ts';

const TABLES = ['products', 'listings', 'comparables', 'analyses', 'opportunities', 'search_configs', 'purchases', 'inventory', 'resales', 'sales', 'expenses', 'notifications'];

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
  return JSON.stringify({ app: 'resale-bot', version: '0.4.0', exportedAt: new Date().toISOString(), settings: settings?.settings ?? {}, tables }, null, 2);
}
