import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { deleteNotification, fetchNotifications, markAllNotificationsRead, markNotificationRead } from '../services/notifications.ts';
import { NOTIFICATION_TYPE_LABEL } from '../core/notifications.ts';
import { errMsg } from '../lib/errors.ts';
import type { NotificationRow } from '../types.ts';

export default function Notifications() {
  const [items, setItems] = useState<NotificationRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('all'); // all | unread | <type>

  const load = useCallback(async () => {
    try {
      setItems(await fetchNotifications());
      setError(null);
    } catch (e) {
      setError(errMsg(e));
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function run(fn: () => Promise<void>) {
    try {
      await fn();
      await load();
    } catch (e) {
      setError(errMsg(e));
    }
  }

  const unread = (items ?? []).filter((n) => !n.read_at).length;
  const types = useMemo(() => Array.from(new Set((items ?? []).map((n) => n.type))).sort(), [items]);
  const shown = (items ?? []).filter((n) => (filter === 'all' ? true : filter === 'unread' ? !n.read_at : n.type === filter));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold text-navy-950">Notifications</h1>
        {unread > 0 && (
          <button className="btn btn-ghost" onClick={() => void run(markAllNotificationsRead)}>Tout marquer comme lu</button>
        )}
      </div>
      <p className="text-xs text-slate-500">
        Alertes dans l'application, sans répétition : un même fait n'est notifié qu'une fois. Telegram n'est pas encore disponible.
      </p>
      <select className="input" value={filter} onChange={(e) => setFilter(e.target.value)}>
        <option value="all">Toutes ({items?.length ?? 0})</option>
        <option value="unread">Non lues ({unread})</option>
        {types.map((t) => (
          <option key={t} value={t}>{NOTIFICATION_TYPE_LABEL[t] ?? t}</option>
        ))}
      </select>
      {error && <p className="text-sm text-loss">{error}</p>}
      {!items && !error && <p className="text-sm text-slate-500">Chargement…</p>}
      {items && items.length === 0 && <p className="card text-sm text-slate-600">Aucune notification pour l'instant.</p>}
      {items && items.length > 0 && shown.length === 0 && <p className="text-sm text-slate-500">Aucune notification ne correspond.</p>}
      <div className="space-y-2">
        {shown.map((n) => (
          <div key={n.id} className={`card space-y-1 ${n.read_at ? 'opacity-70' : 'border-navy-700'}`}>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{NOTIFICATION_TYPE_LABEL[n.type] ?? n.type}</p>
            <p className="font-medium text-navy-950">{n.title}</p>
            {n.body && <p className="text-sm text-slate-600">{n.body}</p>}
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
              <span>{new Date(n.created_at).toLocaleString('fr-FR')}</span>
              {n.listing_id && <Link className="underline" to={`/annonce/${n.listing_id}`}>Ouvrir l'annonce</Link>}
              {!n.read_at && <button className="underline" onClick={() => void run(() => markNotificationRead(n.id))}>Marquer comme lu</button>}
              <button
                className="text-loss underline"
                onClick={() => {
                  if (window.confirm('Supprimer cette notification ?')) void run(() => deleteNotification(n.id));
                }}
              >
                Supprimer
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
