import type { FeeModel } from './profitability.ts';
import { NO_FEES } from './profitability.ts';
import type { ScoringWeights } from './scoring.ts';
import { DEFAULT_WEIGHTS } from './scoring.ts';

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
  /** Plateforme de revente supposée par défaut pour l'évaluation (clé de `fees`). */
  resalePlatform: string;
  /** Coûts annexes moyens par article (livraison, emballage, préparation), en centimes. */
  defaultOtherCostsCents: number;
  /** Poids du score (normalisés à 100 au calcul). */
  scoringWeights: ScoringWeights;
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
  resalePlatform: 'vinted',
  defaultOtherCostsCents: 0,
  scoringWeights: { ...DEFAULT_WEIGHTS },
};

/** Fusionne des réglages partiels (venant de la base) avec les valeurs par défaut. */
export function mergeSettings(raw: unknown): Settings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<Settings>;
  return {
    ...DEFAULT_SETTINGS,
    ...r,
    fees: { ...DEFAULT_SETTINGS.fees, ...(r.fees ?? {}) },
    scoringWeights: { ...DEFAULT_WEIGHTS, ...(r.scoringWeights ?? {}) },
  };
}

export const eurosToCents = (e: number): number => Math.round(e * 100);
export const centsToEuros = (c: number): number => c / 100;
export { formatEuros } from './format.ts';
