/**
 * Maintenance planifiée (GitHub Actions, voir .github/workflows/scheduled-maintenance.yml).
 *
 * Ce que fait la tâche, pour chaque utilisateur :
 *  1. recalcule les évaluations (les comparables vieillissent : récence, réévaluation nécessaire) ;
 *  2. signale le stock immobilisé ;
 *  3. consulte les sources AUTORISÉES (aucune aujourd'hui : voir worker/connectors.ts) ;
 *  4. envoie, si l'utilisateur l'a activé, les notifications importantes sur Telegram.
 *
 * Garanties : verrou (pas d'exécution concurrente), isolation des erreurs par utilisateur (reprise au prochain passage),
 * déduplication (clés uniques), journal d'exécution (table job_runs), `scope.userId` sur chaque lecture/écriture
 * (la clé service ignore la RLS), aucune opération financière.
 * Secrets : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (obligatoires), TELEGRAM_BOT_TOKEN (facultatif).
 */
import { createClient } from '@supabase/supabase-js';
import { mergeSettings } from '../src/core/settings.ts';
import { agedItems, AGING_DAYS } from '../src/core/inventory.ts';
import { formatTelegramMessage, isValidChatId, shouldSendTelegram } from '../src/core/telegram.ts';
import { withRetry } from '../src/core/retry.ts';
import { createNotificationWith, loadInventoryWith, refreshEvaluationsWith } from '../src/lib/store.ts';
import type { Client, Scope } from '../src/lib/store.ts';
import { getConnector } from './connectors.ts';

const JOB = 'maintenance';
const MAX_TELEGRAM_PER_RUN = 20;

interface UserStats {
  evaluated: number;
  updated: number;
  agingAlerts: number;
  sourcesSkipped: number;
  telegramSent: number;
  telegramErrors: number;
}

async function checkSources(client: Client, scope: Scope): Promise<number> {
  const { data, error } = await client
    .from('sources')
    .select('id, name, connector, config')
    .eq('user_id', scope.userId)
    .eq('is_authorized', true)
    .eq('is_enabled', true);
  if (error) throw new Error(error.message);
  let skipped = 0;
  for (const s of (data ?? []) as { id: string; name: string; connector: string }[]) {
    if (!getConnector(s.connector)) {
      skipped += 1;
      console.log(`  source « ${s.name} » ignorée : aucun connecteur « ${s.connector} » n'est installé`);
    }
    // Un connecteur autorisé serait appelé ici (quota, fréquence minimale, déduplication par empreinte).
  }
  return skipped;
}

async function agingAlerts(client: Client, scope: Scope): Promise<number> {
  const { views } = await loadInventoryWith(client, scope);
  const month = new Date().toISOString().slice(0, 7);
  let created = 0;
  for (const it of agedItems(views).slice(0, 10)) {
    const ok = await createNotificationWith(
      client,
      {
        type: 'stock_aging',
        title: `Stock immobilisé : ${it.name}`,
        body: `Cet article n'est pas vendu depuis plus de ${AGING_DAYS} jours. Pense à baisser le prix ou à le republier.`,
        listingId: null,
        dedupKey: `aging:${it.id}:${month}`,
      },
      scope,
    );
    if (ok) created += 1;
  }
  return created;
}

async function sendTelegram(token: string, chatId: string, text: string): Promise<void> {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Telegram a répondu ${res.status}`); // le jeton n'est jamais journalisé
}

/** Chaque notification importante n'est envoyée qu'une fois : sa « copie » Telegram (clé unique) fait office d'accusé d'envoi. */
async function deliverTelegram(client: Client, scope: Scope, token: string, chatId: string, appUrl?: string): Promise<{ sent: number; errors: number }> {
  const since = new Date(Date.now() - 3 * 86_400_000).toISOString();
  const { data, error } = await client
    .from('notifications')
    .select('id, type, title, body, listing_id, dedup_key')
    .eq('user_id', scope.userId)
    .eq('channel', 'in_app')
    .gte('created_at', since)
    .order('created_at', { ascending: true })
    .limit(100);
  if (error) throw new Error(error.message);
  let sent = 0;
  let errors = 0;
  for (const n of (data ?? []) as { id: string; type: string; title: string; body: string | null; listing_id: string | null; dedup_key: string | null }[]) {
    if (sent >= MAX_TELEGRAM_PER_RUN) break;
    if (!shouldSendTelegram(n.type)) continue;
    const key = n.dedup_key ?? `tg:${n.id}`;
    const fresh = await createNotificationWith(
      client,
      { type: n.type, title: n.title, body: n.body ?? '', listingId: n.listing_id, dedupKey: key, channel: 'telegram' },
      scope,
    );
    if (!fresh) continue; // déjà envoyée
    try {
      await withRetry(() => sendTelegram(token, chatId, formatTelegramMessage(n, appUrl)), { retries: 2, baseMs: 1000 });
      sent += 1;
    } catch (e) {
      errors += 1;
      console.error(`  Telegram : échec d'envoi (${e instanceof Error ? e.message : 'erreur'}) ; nouvel essai au prochain passage`);
      await client.from('notifications').delete().eq('user_id', scope.userId).eq('channel', 'telegram').eq('dedup_key', key);
    }
  }
  return { sent, errors };
}

async function processUser(client: Client, user: { id: string; settings: unknown }, token: string | undefined, appUrl?: string): Promise<UserStats> {
  const scope: Scope = { userId: user.id };
  const settings = mergeSettings(user.settings);
  const r = await refreshEvaluationsWith(client, settings, scope);
  const aging = await agingAlerts(client, scope);
  const skipped = await checkSources(client, scope);
  let telegramSent = 0;
  let telegramErrors = 0;
  if (token && settings.telegramEnabled && isValidChatId(settings.telegramChatId)) {
    const t = await deliverTelegram(client, scope, token, settings.telegramChatId.trim(), appUrl);
    telegramSent = t.sent;
    telegramErrors = t.errors;
  }
  return { evaluated: r.evaluated, updated: r.updated, agingAlerts: aging, sourcesSkipped: skipped, telegramSent, telegramErrors };
}

async function main(): Promise<number> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.log('Tâche ignorée : secrets SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY non configurés.');
    return 0;
  }
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const owner = `run-${Date.now()}`;

  const lock = await client.rpc('acquire_job_lock', { p_job: JOB, p_owner: owner, p_minutes: 20 });
  if (lock.error) throw new Error(`Verrou indisponible : ${lock.error.message} (migration 0006 exécutée ?)`);
  if (lock.data !== true) {
    console.log('Une exécution est déjà en cours : arrêt sans rien faire.');
    return 0;
  }

  let failures = 0;
  try {
    const users = await client.from('users').select('id, settings');
    if (users.error) throw new Error(users.error.message);
    const appUrl = process.env.APP_URL;
    for (const u of (users.data ?? []) as { id: string; settings: unknown }[]) {
      const started = new Date().toISOString();
      const run = await client.from('job_runs').insert({ user_id: u.id, job: JOB, status: 'running', started_at: started }).select('id').single();
      try {
        const stats = await processUser(client, u, process.env.TELEGRAM_BOT_TOKEN, appUrl);
        console.log(`Utilisateur ${u.id.slice(0, 8)}… : ${JSON.stringify(stats)}`);
        const status = stats.telegramErrors > 0 ? 'partial' : 'success';
        if (run.data) await client.from('job_runs').update({ status, stats, finished_at: new Date().toISOString() }).eq('id', run.data.id);
      } catch (e) {
        failures += 1; // isolé : les autres utilisateurs sont traités, ce passage sera rejoué au prochain horaire
        const message = e instanceof Error ? e.message : String(e);
        console.error(`Utilisateur ${u.id.slice(0, 8)}… : erreur — ${message}`);
        if (run.data) await client.from('job_runs').update({ status: 'error', error: message.slice(0, 500), finished_at: new Date().toISOString() }).eq('id', run.data.id);
      }
    }
  } finally {
    await client.rpc('release_job_lock', { p_job: JOB, p_owner: owner });
  }
  return failures > 0 ? 1 : 0;
}

main()
  .then((code) => process.exit(code))
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
