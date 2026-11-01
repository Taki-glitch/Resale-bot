/** Classement, filtres et règles de notification des opportunités. Logique pure, testée. */
import type { Recommendation, RiskLevel } from './evaluation.ts';

export type OpportunityStatus = 'new' | 'to_check' | 'interesting' | 'to_negotiate' | 'rejected' | 'bought' | 'expired';

export const STATUS_LABEL: Record<OpportunityStatus, string> = {
  new: 'Nouvelle',
  to_check: 'À vérifier',
  interesting: 'Intéressante',
  to_negotiate: 'À négocier',
  rejected: 'Refusée',
  bought: 'Achetée',
  expired: 'Expirée',
};
export const STATUS_ORDER: OpportunityStatus[] = ['new', 'to_check', 'interesting', 'to_negotiate', 'rejected', 'bought', 'expired'];
/** Statuts « en cours » ; les autres relèvent de l'historique. */
export const ACTIVE_STATUSES: OpportunityStatus[] = ['new', 'to_check', 'interesting', 'to_negotiate'];

export interface OpportunityView {
  id: string;
  listingId: string;
  title: string;
  platform: string;
  category: string | null;
  priceCents: number | null;
  resaleEstimateCents: number | null;
  netProfitCents: number | null;
  netMarginPct: number | null;
  maxBuyCents: number | null;
  score: number | null;
  recommendation: Recommendation;
  riskLevel: RiskLevel | null;
  confidence: number | null;
  status: OpportunityStatus;
  isSelected: boolean;
  detectedAt: string;
}

export type SortKey = 'score' | 'profit' | 'margin' | 'risk';

export interface OpportunityFilters {
  platform: string; // '' = toutes
  category: string; // '' = toutes
  maxBudgetCents: number | null; // prix demandé maximal
  minProfitCents: number | null; // bénéfice net estimé minimal
  status: 'active' | 'all' | OpportunityStatus;
  selectedOnly: boolean;
  includeUnevaluable: boolean;
}

export const DEFAULT_FILTERS: OpportunityFilters = {
  platform: '',
  category: '',
  maxBudgetCents: null,
  minProfitCents: null,
  status: 'active',
  selectedOnly: false,
  includeUnevaluable: false,
};

export function filterOpportunities(rows: OpportunityView[], f: OpportunityFilters): OpportunityView[] {
  return rows.filter((o) => {
    if (!f.includeUnevaluable && o.recommendation === 'insufficient') return false;
    if (f.platform && o.platform !== f.platform) return false;
    if (f.category && o.category !== f.category) return false;
    if (f.maxBudgetCents !== null && (o.priceCents === null || o.priceCents > f.maxBudgetCents)) return false;
    if (f.minProfitCents !== null && (o.netProfitCents === null || o.netProfitCents < f.minProfitCents)) return false;
    if (f.selectedOnly && !o.isSelected) return false;
    if (f.status === 'active' && !ACTIVE_STATUSES.includes(o.status)) return false;
    if (f.status !== 'active' && f.status !== 'all' && o.status !== f.status) return false;
    return true;
  });
}

const RISK_RANK: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2 };

/** Tri stable ; les valeurs manquantes passent toujours en dernier. */
export function sortOpportunities(rows: OpportunityView[], key: SortKey): OpportunityView[] {
  const value = (o: OpportunityView): number | null => {
    switch (key) {
      case 'score':
        return o.score;
      case 'profit':
        return o.netProfitCents;
      case 'margin':
        return o.netMarginPct;
      case 'risk':
        return o.riskLevel === null ? null : -RISK_RANK[o.riskLevel]; // risque faible = valeur la plus haute
    }
  };
  return rows
    .map((o, i) => ({ o, i, v: value(o) }))
    .sort((a, b) => {
      if (a.v === null && b.v === null) return a.i - b.i;
      if (a.v === null) return 1;
      if (b.v === null) return -1;
      return b.v - a.v || a.i - b.i;
    })
    .map((x) => x.o);
}

/**
 * Notifier seulement quand une annonce VIENT de devenir une (très) bonne affaire
 * avec un bénéfice au moins égal au seuil, pour éviter les notifications répétitives.
 */
export function shouldNotifyOpportunity(
  previous: Recommendation | null,
  next: Recommendation,
  netProfitCents: number | null,
  minProfitCents: number,
): boolean {
  const hot = (r: Recommendation | null) => r === 'excellent' || r === 'good';
  return hot(next) && !hot(previous) && netProfitCents !== null && netProfitCents >= minProfitCents;
}
