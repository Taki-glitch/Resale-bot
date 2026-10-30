import type { FeeModel } from './profitability.ts';
import { NO_FEES } from './profitability.ts';

/** Paramètres utilisateur, stockés en JSON dans users.settings. Montants en centimes. */
export interface Settings {
  totalBudgetCents: number;
  maxPerItemCents: number;
  minProfitCents: number;
  minRoiPct: number;
  monthlyTargetCents: number;
  location: string;
  maxDistanceKm: number;
  /** Frais par plateforme et type de transaction, ex. "vinted:sale". À renseigner par l'utilisateur. */
  fees: Record<string, FeeModel>;
}

export const DEFAULT_SETTINGS: Settings = {
  totalBudgetCents: 20000, // 200 € (plage prévue : 100 à 300 €)
  maxPerItemCents: 5000,
  minProfitCents: 1000, // 10 € (plage prévue : 10 à 15 €)
  minRoiPct: 40,
  monthlyTargetCents: 30000, // 300 € (plage prévue : 200 à 400 €)
  location: '',
  maxDistanceKm: 30,
  // Valeurs à 0 volontairement : les frais réels varient selon plateforme et mode de livraison.
  fees: { 'vinted:sale': { ...NO_FEES }, 'leboncoin:sale': { ...NO_FEES } },
};

/** Fusionne des réglages partiels (venant de la base) avec les valeurs par défaut. */
export function mergeSettings(raw: unknown): Settings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<Settings>;
  return { ...DEFAULT_SETTINGS, ...r, fees: { ...DEFAULT_SETTINGS.fees, ...(r.fees ?? {}) } };
}

export const eurosToCents = (e: number): number => Math.round(e * 100);
export const centsToEuros = (c: number): number => c / 100;
export const formatEuros = (cents: number): string =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100);
