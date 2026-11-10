export interface PriceChange {
  changed: boolean;
  dropped: boolean;
  deltaCents: number;
  pct: number | null;
}

/** Évolution du prix demandé d'une annonce (saisie manuelle de la mise à jour). */
export function priceChange(oldCents: number | null, newCents: number | null): PriceChange {
  if (oldCents === null || newCents === null || oldCents === newCents) return { changed: false, dropped: false, deltaCents: 0, pct: null };
  const delta = newCents - oldCents;
  return { changed: true, dropped: delta < 0, deltaCents: delta, pct: oldCents > 0 ? Math.round((delta / oldCents) * 1000) / 10 : null };
}
