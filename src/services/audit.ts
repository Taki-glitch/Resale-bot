import { db } from './db.ts';

/** Journal d'activité des opérations sensibles. N'interrompt jamais l'opération journalisée. */
export async function logActivity(action: string, entity: string | null, entityId: string | null, details: Record<string, unknown> = {}): Promise<void> {
  try {
    await db().from('audit_logs').insert({ action, entity, entity_id: entityId, details });
  } catch {
    /* le journal est un complément : il ne doit jamais bloquer l'opération */
  }
}

export interface ActivityRow {
  id: string;
  action: string;
  entity: string | null;
  entity_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

export async function fetchActivity(limit = 100): Promise<ActivityRow[]> {
  const { data, error } = await db().from('audit_logs').select('*').order('created_at', { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as ActivityRow[];
}

export interface JobRunRow {
  id: string;
  job: string;
  status: 'running' | 'success' | 'partial' | 'error' | 'skipped';
  stats: Record<string, number>;
  error: string | null;
  started_at: string;
  finished_at: string | null;
}

export async function fetchJobRuns(limit = 20): Promise<JobRunRow[]> {
  const { data, error } = await db().from('job_runs').select('*').order('started_at', { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as JobRunRow[];
}
