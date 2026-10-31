/** Saisie d'un montant en euros ("12,50" ou "12.50") -> centimes ; null si vide ou invalide. */
export function parseEuros(input: string): number | null {
  const s = input.trim().replace(/\s/g, '').replace(',', '.');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}

export function formatPct(value: number | null): string {
  return value === null ? '—' : `${value.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`;
}
