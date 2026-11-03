/**
 * Recherche, filtres et tri des annonces déjà enregistrées (aucune collecte sur les plateformes).
 * Les critères sont aussi ceux des « recherches enregistrées » stockées en base (search_configs.filters).
 * Règle de prudence : un filtre portant sur l'évaluation exclut les annonces non évaluées.
 */
import type { ConfidenceLevel, Recommendation } from './evaluation.ts';
import type { OpportunityStatus } from './opportunities.ts';
import { parseEuros } from './format.ts';

export interface SearchCriteria {
  keyword: string;
  platform: string; // '' = toutes
  category: string;
  brand: string;
  maxPriceCents: number | null;
  minProfitCents: number | null;
  minMarginPct: number | null;
  minScore: number | null;
  confidence: '' | ConfidenceLevel;
  status: '' | OpportunityStatus | 'unevaluated';
}

export const EMPTY_CRITERIA: SearchCriteria = {
  keyword: '',
  platform: '',
  category: '',
  brand: '',
  maxPriceCents: null,
  minProfitCents: null,
  minMarginPct: null,
  minScore: null,
  confidence: '',
  status: '',
};

export type SearchSort = 'date' | 'profit' | 'score' | 'margin';
export const SORT_LABEL: Record<SearchSort, string> = {
  date: "Date d'ajout",
  profit: 'Rentabilité (bénéfice net)',
  score: 'Score',
  margin: 'Marge',
};

export interface SearchableListing {
  id: string;
  title: string;
  platform: string;
  location: string | null;
  priceCents: number | null;
  brand: string | null;
  model: string | null;
  category: string | null;
  detectedAt: string;
  score: number | null;
  netProfitCents: number | null;
  netMarginPct: number | null;
  confidenceLevel: ConfidenceLevel | null;
  status: OpportunityStatus | null;
  recommendation: Recommendation | null;
}

const norm = (s: string | null | undefined): string =>
  (s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

export function filterListings(rows: SearchableListing[], c: SearchCriteria): SearchableListing[] {
  const words = norm(c.keyword).split(/\s+/).filter(Boolean);
  const brand = norm(c.brand);
  return rows.filter((r) => {
    if (words.length > 0) {
      const hay = norm([r.title, r.brand, r.model, r.category, r.location].filter(Boolean).join(' '));
      if (!words.every((w) => hay.includes(w))) return false;
    }
    if (c.platform && r.platform !== c.platform) return false;
    if (c.category && r.category !== c.category) return false;
    if (brand && !norm(r.brand).includes(brand)) return false;
    if (c.maxPriceCents !== null && (r.priceCents === null || r.priceCents > c.maxPriceCents)) return false;
    if (c.minProfitCents !== null && (r.netProfitCents === null || r.netProfitCents < c.minProfitCents)) return false;
    if (c.minMarginPct !== null && (r.netMarginPct === null || r.netMarginPct < c.minMarginPct)) return false;
    if (c.minScore !== null && (r.score === null || r.score < c.minScore)) return false;
    if (c.confidence && r.confidenceLevel !== c.confidence) return false;
    if (c.status === 'unevaluated') {
      if (r.recommendation !== null && r.recommendation !== 'insufficient') return false;
    } else if (c.status && r.status !== c.status) return false;
    return true;
  });
}

export function sortListings(rows: SearchableListing[], sort: SearchSort): SearchableListing[] {
  const value = (r: SearchableListing): number | null => {
    switch (sort) {
      case 'date':
        return new Date(r.detectedAt).getTime();
      case 'profit':
        return r.netProfitCents;
      case 'score':
        return r.score;
      case 'margin':
        return r.netMarginPct;
    }
  };
  return rows
    .map((r, i) => ({ r, i, v: value(r) }))
    .sort((a, b) => {
      if (a.v === null && b.v === null) return a.i - b.i;
      if (a.v === null) return 1;
      if (b.v === null) return -1;
      return b.v - a.v || a.i - b.i;
    })
    .map((x) => x.r);
}

/** Format stocké en base (v2). Les anciennes recherches (clés keyword, platform, category, maxPrice en euros) restent lisibles. */
export function serializeSearch(criteria: SearchCriteria, sort: SearchSort): Record<string, unknown> {
  return { v: 2, ...criteria, sort };
}

export function parseSavedSearch(raw: unknown): { criteria: SearchCriteria; sort: SearchSort } {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const str = (v: unknown): string => (typeof v === 'string' ? v : '');
  const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const platform = str(r.platform) === 'all' ? '' : str(r.platform);
  const sorts: SearchSort[] = ['date', 'profit', 'score', 'margin'];
  const sort = sorts.includes(r.sort as SearchSort) ? (r.sort as SearchSort) : 'date';
  const confidence = ['low', 'medium', 'high'].includes(str(r.confidence)) ? (str(r.confidence) as SearchCriteria['confidence']) : '';
  return {
    sort,
    criteria: {
      keyword: str(r.keyword),
      platform,
      category: str(r.category),
      brand: str(r.brand),
      maxPriceCents: r.v === 2 ? num(r.maxPriceCents) : parseEuros(str(r.maxPrice)),
      minProfitCents: num(r.minProfitCents),
      minMarginPct: num(r.minMarginPct),
      minScore: num(r.minScore),
      confidence,
      status: str(r.status) as SearchCriteria['status'],
    },
  };
}
