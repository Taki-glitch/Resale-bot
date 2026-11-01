import type { Platform } from './core/listing.ts';
import type { PriceKind } from './core/estimate.ts';
import type { Recommendation, RiskLevel } from './core/evaluation.ts';
import type { OpportunityStatus } from './core/opportunities.ts';

export type { Platform, PriceKind };

export type SourceKind = 'manual' | 'import' | 'authorized_source';

export interface Listing {
  id: string;
  platform: Platform;
  external_id: string | null;
  url: string | null;
  title: string;
  description: string | null;
  price_cents: number | null;
  condition: string | null;
  location: string | null;
  product_id: string | null;
  source_kind?: SourceKind;
  status: string;
  detected_at: string;
}

export interface ProductRow {
  id: string;
  name: string;
  brand: string | null;
  model: string | null;
  reference: string | null;
  category: string | null;
}

export interface ComparableRow {
  id: string;
  product_id: string | null;
  source: string;
  url: string | null;
  price_cents: number;
  price_kind: PriceKind;
  condition: string | null;
  observed_at: string;
}

export interface AnalysisRow {
  id: string;
  listing_id: string;
  known: Record<string, unknown>;
  inferred: Record<string, unknown>;
  unknown: string[];
  details: {
    condition?: { summary?: string | null; visible_defects?: string[]; accessories?: string[] };
    authenticity_note?: string | null;
    risk_flags?: string[];
  };
  confidence: number | null;
  sufficient_data: boolean;
  model: string | null;
  created_at: string;
}

export interface OpportunityRow {
  id: string;
  listing_id: string;
  analysis_id: string | null;
  score: number | null;
  score_detail: Record<string, any> | null;
  risk_level: RiskLevel | null;
  recommendation: Recommendation | null;
  confidence: number | null;
  status: OpportunityStatus;
  is_selected: boolean;
  est_profit_cents: number | null;
  max_buy_cents: number | null;
  net_margin_pct: number | null;
  detected_at: string;
}

export interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string | null;
  listing_id: string | null;
  read_at: string | null;
  created_at: string;
}

export interface ListingDetail {
  listing: Listing;
  product: ProductRow | null;
  comparables: ComparableRow[];
  analysis: AnalysisRow | null;
  opportunity: OpportunityRow | null;
}
