import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchNotifications, markAllNotificationsRead, markNotificationRead } from '../services/notifications.ts';
import { errMsg } from '../lib/errors.ts';
import type { NotificationRow } from '../types.ts';

export default function Notifications() {
  const [items, setItems] = useState<NotificationRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  async function read(id: string) {
    try {
      await markNotificationRead(id);
      await load();
    } catch (e) {
      setError(errMsg(e));
    }
  }

  async function readAll() {
    try {
      await markAllNotificationsRead();
      await load();
    } catch (e) {
      setError(errMsg(e));
    }
  }

  const unread = (items ?? []).filter((n) => !n.read_at).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold text-navy-950">Notifications</h1>
        {unread > 0 && (
          <button className="btn btn-ghost" onClick={() => void readAll()}>Tout marquer comme lu</button>
        )}
      </div>
      <p className="text-xs text-slate-500">
        Alertes dans l'application, sans répétition. Les notifications Telegram sont prévues dans une version ultérieure.
      </p>
      {error && <p className="text-sm text-loss">{error}</p>}
      {!items && !error && <p className="text-sm text-slate-500">Chargement…</p>}
      {items && items.length === 0 && <p className="card text-sm text-slate-600">Aucune notification pour l'instant.</p>}
      <div className="space-y-2">
        {(items ?? []).map((n) => (
          <div key={n.id} className={`card space-y-1 ${n.read_at ? 'opacity-70' : 'border-navy-700'}`}>
            <p className="font-medium text-navy-950">{n.title}</p>
            {n.body && <p className="text-sm text-slate-600">{n.body}</p>}
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
              <span>{new Date(n.created_at).toLocaleString('fr-FR')}</span>
              {n.listing_id && <Link className="underline" to={`/annonce/${n.listing_id}`}>Ouvrir l'annonce</Link>}
              {!n.read_at && (
                <button className="underline" onClick={() => void read(n.id)}>Marquer comme lu</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
