
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../services/db.ts';
import { errMsg } from '../lib/errors.ts';

interface Notice { id: string; title: string; body: string | null; type: string; read_at: string | null; created_at: string; }

export default function Notifications() {
  const [items, setItems] = useState<Notice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    try {
      const { data, error: e } = await db().from('notifications').select('id,title,body,type,read_at,created_at').eq('channel', 'in_app').order('created_at', { ascending: false }).limit(100);
      if (e) throw e;
      setItems((data ?? []) as Notice[]);
    } catch (e) { setError(errMsg(e)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function markRead(id: string) {
    try {
      const { error: e } = await db().from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
      if (e) throw e;
      await load();
    } catch (e) { setError(errMsg(e)); }
  }

  return <div className="space-y-4">
    <h1 className="text-2xl font-semibold text-navy-950">Notifications</h1>
    <p className="text-sm text-slate-500">Centre de notifications internes. Les alertes automatiques et Telegram seront ajoutés après validation du moteur d'opportunités.</p>
    {error && <p className="card text-sm text-loss">{error}</p>}
    {loading ? <p className="text-sm text-slate-500">Chargement…</p> : items.length === 0
      ? <p className="card text-sm text-slate-600">Aucune notification pour le moment.</p>
      : <div className="space-y-2">{items.map((n) => <article className="card flex flex-wrap items-start justify-between gap-3" key={n.id}>
        <div><p className="font-medium">{n.title}</p>{n.body && <p className="text-sm text-slate-600">{n.body}</p>}
          <p className="text-xs text-slate-400">{new Date(n.created_at).toLocaleString('fr-FR')} · {n.read_at ? 'Lue' : 'Non lue'}</p></div>
        {!n.read_at && <button className="btn btn-ghost" onClick={() => void markRead(n.id)}>Marquer comme lue</button>}
      </article>)}</div>}
    <Link to="/opportunites" className="text-sm underline">Voir les opportunités</Link>
  </div>;
}
