import { db } from './db.ts';
import type { NotificationRow } from '../types.ts';

/** Crée une notification dans l'application. Renvoie false si elle existe déjà (clé de déduplication). */
export async function createNotification(n: {
  type: string;
  title: string;
  body: string;
  listingId: string | null;
  dedupKey: string;
}): Promise<boolean> {
  const { error } = await db()
    .from('notifications')
    .insert({
      type: n.type,
      title: n.title,
      body: n.body,
      listing_id: n.listingId,
      channel: 'in_app',
      dedup_key: n.dedupKey,
    });
  if (error) {
    if (error.code === '23505') return false; // déjà notifiée : pas de répétition
    throw new Error(error.message);
  }
  return true;
}

export async function fetchNotifications(limit = 50): Promise<NotificationRow[]> {
  const { data, error } = await db()
    .from('notifications')
    .select('*')
    .eq('channel', 'in_app')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as NotificationRow[];
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await db().from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function markAllNotificationsRead(): Promise<void> {
  const { error } = await db().from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null);
  if (error) throw new Error(error.message);
}

export async function countUnread(): Promise<number> {
  const { count, error } = await db()
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('channel', 'in_app')
    .is('read_at', null);
  if (error) throw new Error(error.message);
  return count ?? 0;
}
