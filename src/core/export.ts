/** Exports CSV (séparateur « ; », lisible par Excel en français) et JSON. Neutralise l'injection de formules. */
export interface CsvColumn<T> {
  label: string;
  value: (row: T) => string | number | null | undefined;
}

export function csvCell(v: string | number | null | undefined): string {
  let s = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+([.,]\d+)?$/.test(s)) s = `'${s}`; // formule potentielle -> texte
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const head = columns.map((c) => csvCell(c.label)).join(';');
  const body = rows.map((r) => columns.map((c) => csvCell(c.value(r))).join(';'));
  return '\ufeff' + [head, ...body].join('\r\n');
}

export const euros = (cents: number | null): string => (cents === null ? '' : (cents / 100).toFixed(2).replace('.', ','));
