import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.ts';

export interface DashboardStats {
  listingsAnalyzed: number;
  opportunities: number;
  inStock: number;
  salesCount: number;
  investedCents: number;
  revenueCents: number;
  realizedProfitCents: number;
  potentialProfitCents: number; // ESTIMATION issue des opportunités ouvertes
}

const sum = (rows: Record<string, number | null>[] | null, key: string) =>
  (rows ?? []).reduce((acc, r) => acc + (r[key] ?? 0), 0);

/** Toutes les valeurs viennent de la base. Base vide = zéros, jamais de chiffres inventés. */
export function useDashboardStats() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const db = supabase;
    if (!db) return;
    const count = (table: string, filter?: (q: any) => any) => {
      let q: any = db.from(table).select('id', { count: 'exact', head: true });
      if (filter) q = filter(q);
      return q;
    };
    Promise.all([
      count('analyses'),
      count('opportunities', (q) => q.in('status', ['new', 'to_check', 'interesting', 'to_negotiate'])),
      count('inventory', (q) => q.in('status', ['received', 'in_stock', 'preparing', 'listed'])),
      count('sales'),
      db.from('purchases').select('price_cents, fees_cents'),
      db.from('sales').select('price_cents'),
      db.from('sales_with_profit').select('realized_profit_cents'),
      db
        .from('opportunities')
        .select('est_profit_cents')
        .in('status', ['new', 'to_check', 'interesting', 'to_negotiate']),
    ]).then((r: any[]) => {
      const failed = r.find((x) => x.error);
      if (failed) return setError(failed.error.message);
      setStats({
        listingsAnalyzed: r[0].count ?? 0,
        opportunities: r[1].count ?? 0,
        inStock: r[2].count ?? 0,
        salesCount: r[3].count ?? 0,
        investedCents: sum(r[4].data, 'price_cents') + sum(r[4].data, 'fees_cents'),
        revenueCents: sum(r[5].data, 'price_cents'),
        realizedProfitCents: sum(r[6].data, 'realized_profit_cents'),
        potentialProfitCents: sum(r[7].data, 'est_profit_cents'),
      });
    });
  }, []);

  return { stats, error };
}
