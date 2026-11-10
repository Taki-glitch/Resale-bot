import { useEffect, useState } from 'react';
import { fetchPriceHistory } from '../services/listings.ts';
import type { PriceHistoryRow } from '../services/listings.ts';
import { priceChange } from '../core/price.ts';
import { formatEuros } from '../core/format.ts';

/** Évolution du prix demandé (chaque modification de l'annonce est conservée). */
export default function PriceHistory({ listingId, refreshKey }: { listingId: string; refreshKey: number }) {
  const [rows, setRows] = useState<PriceHistoryRow[] | null>(null);
  useEffect(() => {
    fetchPriceHistory(listingId)
      .then(setRows)
      .catch(() => setRows([]));
  }, [listingId, refreshKey]);
  if (!rows || rows.length === 0) return null;
  return (
    <details className="card text-sm">
      <summary className="cursor-pointer font-medium text-navy-950">Historique du prix ({rows.length})</summary>
      <ul className="mt-2 space-y-1">
        {rows.map((r, i) => {
          const older = rows[i + 1];
          const c = older ? priceChange(older.price_cents, r.price_cents) : null;
          return (
            <li key={r.id} className="flex flex-wrap gap-x-3 text-slate-700">
              <span className="text-slate-500">{new Date(r.observed_at).toLocaleDateString('fr-FR')}</span>
              <strong>{formatEuros(r.price_cents)}</strong>
              {c?.changed && (
                <span className={c.dropped ? 'text-gain' : 'text-loss'}>
                  {c.deltaCents > 0 ? '+' : ''}
                  {formatEuros(c.deltaCents)} {c.pct !== null ? `(${c.pct} %)` : ''}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </details>
  );
}
