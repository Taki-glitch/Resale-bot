/**
 * Sauvegarde / restauration. Le format est celui de `exportAllData`. La restauration est SÛRE :
 * identifiants conservés (opération rejouable sans doublon), propriétaire forcé à l'utilisateur courant,
 * références vers des données absentes de la sauvegarde neutralisées, lignes sans parent obligatoire écartées.
 */
export const RESTORE_ORDER = [
  'search_configs', 'products', 'listings', 'price_history', 'analyses', 'comparables', 'opportunities',
  'purchases', 'inventory', 'resales', 'sales', 'expenses', 'notifications',
] as const;
export type BackupTable = (typeof RESTORE_ORDER)[number];

type Row = Record<string, unknown>;

export interface BackupFile {
  app: 'resale-bot';
  version: string;
  exportedAt: string;
  settings: Record<string, unknown>;
  tables: Record<string, Row[]>;
}

/** colonne -> table parente. `required` : la ligne est écartée si le parent est absent. */
const REFS: Record<BackupTable, { col: string; parent: BackupTable | 'external'; required?: boolean }[]> = {
  search_configs: [],
  products: [],
  listings: [
    { col: 'product_id', parent: 'products' },
    { col: 'search_config_id', parent: 'search_configs' },
    { col: 'source_id', parent: 'external' }, // les sources ne font pas partie de la sauvegarde
  ],
  price_history: [{ col: 'listing_id', parent: 'listings', required: true }],
  analyses: [{ col: 'listing_id', parent: 'listings', required: true }, { col: 'product_id', parent: 'products' }],
  comparables: [{ col: 'product_id', parent: 'products' }, { col: 'analysis_id', parent: 'analyses' }],
  opportunities: [{ col: 'listing_id', parent: 'listings', required: true }, { col: 'analysis_id', parent: 'analyses' }],
  purchases: [{ col: 'opportunity_id', parent: 'opportunities' }, { col: 'listing_id', parent: 'listings' }],
  inventory: [{ col: 'purchase_id', parent: 'purchases' }, { col: 'product_id', parent: 'products' }],
  resales: [{ col: 'inventory_id', parent: 'inventory', required: true }],
  sales: [{ col: 'inventory_id', parent: 'inventory' }, { col: 'resale_id', parent: 'resales' }],
  expenses: [{ col: 'inventory_id', parent: 'inventory' }],
  notifications: [{ col: 'listing_id', parent: 'listings' }],
};

export type ValidationResult = { ok: true; backup: BackupFile; counts: Record<string, number> } | { ok: false; error: string };

export function validateBackup(raw: unknown): ValidationResult {
  if (!raw || typeof raw !== 'object') return { ok: false, error: "Ce fichier n'est pas une sauvegarde Resale Bot." };
  const b = raw as Partial<BackupFile>;
  if (b.app !== 'resale-bot') return { ok: false, error: "Ce fichier n'est pas une sauvegarde Resale Bot (champ « app » absent)." };
  if (!b.tables || typeof b.tables !== 'object') return { ok: false, error: 'Sauvegarde illisible : aucune table.' };
  const counts: Record<string, number> = {};
  const tables: Record<string, Row[]> = {};
  for (const t of RESTORE_ORDER) {
    const rows = (b.tables as Record<string, unknown>)[t];
    if (rows === undefined) continue;
    if (!Array.isArray(rows) || rows.some((r) => !r || typeof r !== 'object' || typeof (r as Row).id !== 'string')) {
      return { ok: false, error: `Table « ${t} » invalide : chaque ligne doit avoir un identifiant.` };
    }
    tables[t] = rows as Row[];
    counts[t] = rows.length;
  }
  if (Object.keys(counts).length === 0) return { ok: false, error: 'Sauvegarde vide : aucune table reconnue.' };
  return {
    ok: true,
    counts,
    backup: {
      app: 'resale-bot',
      version: String(b.version ?? ''),
      exportedAt: String(b.exportedAt ?? ''),
      settings: b.settings && typeof b.settings === 'object' ? (b.settings as Record<string, unknown>) : {},
      tables,
    },
  };
}

export interface PreparedRestore {
  tables: Record<string, Row[]>;
  dropped: Record<string, number>; // lignes écartées (parent obligatoire absent)
  nulled: Record<string, number>; // références neutralisées (clé « table.colonne »)
}

export function prepareRestore(backup: BackupFile, userId: string): PreparedRestore {
  const ids = new Map<string, Set<string>>();
  const tables: Record<string, Row[]> = {};
  const dropped: Record<string, number> = {};
  const nulled: Record<string, number> = {};
  for (const t of RESTORE_ORDER) {
    const src = backup.tables[t];
    if (!src) continue;
    const kept: Row[] = [];
    for (const row of src) {
      const next: Row = { ...row, user_id: userId };
      let drop = false;
      for (const ref of REFS[t]) {
        const v = next[ref.col];
        if (v === null || v === undefined) continue;
        const known = ref.parent !== 'external' && ids.get(ref.parent)?.has(String(v));
        if (known) continue;
        if (ref.required) {
          drop = true;
          break;
        }
        next[ref.col] = null;
        nulled[`${t}.${ref.col}`] = (nulled[`${t}.${ref.col}`] ?? 0) + 1;
      }
      if (drop) dropped[t] = (dropped[t] ?? 0) + 1;
      else kept.push(next);
    }
    tables[t] = kept;
    ids.set(t, new Set(kept.map((r) => String(r.id))));
  }
  return { tables, dropped, nulled };
}
