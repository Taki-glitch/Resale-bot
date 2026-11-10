/**
 * Événements de notification déclenchés par un changement d'évaluation.
 * Aucune notification si rien d'important n'a changé ; chaque événement porte une clé de déduplication
 * (unique en base par utilisateur et canal) pour qu'un même fait ne soit jamais notifié deux fois.
 */
import { ACTION_LABEL, BAND_RANK, RECOMMENDATION_LABEL, scoreBand, deriveAction } from './evaluation.ts';
import type { Recommendation } from './evaluation.ts';
import { shouldNotifyOpportunity } from './opportunities.ts';

export type NotificationType =
  | 'opportunity'
  | 'became_evaluable'
  | 'became_unevaluable'
  | 'recommendation_changed'
  | 'score_band_up'
  | 'new_risk'
  | 'reevaluation_needed'
  | 'price_drop';

export const NOTIFICATION_TYPE_LABEL: Record<string, string> = {
  opportunity: 'Opportunité',
  became_evaluable: 'Devenue évaluable',
  became_unevaluable: 'Devenue non évaluable',
  recommendation_changed: 'Recommandation modifiée',
  score_band_up: 'Score en hausse',
  new_risk: 'Nouveau risque',
  reevaluation_needed: 'Réévaluation nécessaire',
  sale_recorded: 'Vente enregistrée',
  stock_aging: 'Stock immobilisé',
  price_drop: 'Baisse de prix',
};

export interface PreviousState {
  recommendation: Recommendation | null;
  score: number | null;
  risks: string[];
}

export interface NextState {
  recommendation: Recommendation;
  score: number | null;
  risks: string[];
  netProfitCents: number | null;
  priceCents: number | null;
  maxBuyCents: number | null;
  staleComparables: boolean;
}

export interface NotificationEvent {
  type: NotificationType;
  title: string;
  body: string;
  dedupKey: string;
}

/** Empreinte courte et stable d'une liste de textes (clé de déduplication). */
export function shortHash(texts: string[]): string {
  let h = 5381;
  for (const ch of texts.join('|')) h = ((h << 5) + h + ch.charCodeAt(0)) | 0;
  return (h >>> 0).toString(36);
}

export function detectEvents(args: {
  listingId: string;
  listingTitle: string;
  previous: PreviousState | null;
  next: NextState;
  minProfitCents: number;
  now?: Date;
}): NotificationEvent[] {
  const { listingId: id, listingTitle: title, previous, next } = args;
  const prevRec = previous?.recommendation ?? null;
  const events: NotificationEvent[] = [];
  const evaluable = (r: Recommendation | null) => r !== null && r !== 'insufficient';
  const label = (r: Recommendation) => RECOMMENDATION_LABEL[r];

  const hot = shouldNotifyOpportunity(prevRec, next.recommendation, next.netProfitCents, args.minProfitCents);
  if (hot) {
    events.push({
      type: 'opportunity',
      title: `${ACTION_LABEL[deriveAction(next.recommendation, next.priceCents, next.maxBuyCents)]} : ${title}`,
      body: `${label(next.recommendation)}. Bénéfice net estimé : ${((next.netProfitCents ?? 0) / 100).toFixed(2)} € (estimation, non garantie).`,
      dedupKey: `opp:${id}:${next.recommendation}`,
    });
  }

  if (previous !== null && prevRec === 'insufficient' && evaluable(next.recommendation)) {
    events.push({
      type: 'became_evaluable',
      title: `Évaluation disponible : ${title}`,
      body: `L'annonce est désormais évaluable : ${label(next.recommendation)}.`,
      dedupKey: `evaluable:${id}:${next.recommendation}`,
    });
  } else if (evaluable(prevRec) && next.recommendation === 'insufficient') {
    events.push({
      type: 'became_unevaluable',
      title: `Évaluation indisponible : ${title}`,
      body: 'Des données essentielles manquent à nouveau (comparables ou prix) : la recommandation précédente n\'est plus valable.',
      dedupKey: `unevaluable:${id}:from_${prevRec}`,
    });
  } else if (evaluable(prevRec) && evaluable(next.recommendation) && prevRec !== next.recommendation && !hot) {
    events.push({
      type: 'recommendation_changed',
      title: `Recommandation modifiée : ${title}`,
      body: `${label(prevRec as Recommendation)} → ${label(next.recommendation)}.`,
      dedupKey: `rec:${id}:${prevRec}>${next.recommendation}`,
    });
  }

  if (previous && previous.score !== null && next.score !== null) {
    const before = scoreBand(previous.score);
    const after = scoreBand(next.score);
    if (BAND_RANK[after] > BAND_RANK[before]) {
      events.push({
        type: 'score_band_up',
        title: `Score en hausse : ${title}`,
        body: `Score ${previous.score} → ${next.score}/100.`,
        dedupKey: `band:${id}:${after}`,
      });
    }
  }

  if (previous && evaluable(prevRec)) {
    const fresh = next.risks.filter((r) => !previous.risks.includes(r));
    if (fresh.length > 0 && evaluable(next.recommendation)) {
      events.push({
        type: 'new_risk',
        title: `Nouveau risque : ${title}`,
        body: fresh.slice(0, 3).join(' ; '),
        dedupKey: `risk:${id}:${shortHash(fresh)}`,
      });
    }
  }

  if (next.staleComparables && (next.recommendation === 'excellent' || next.recommendation === 'good')) {
    const month = (args.now ?? new Date()).toISOString().slice(0, 7);
    events.push({
      type: 'reevaluation_needed',
      title: `Réévaluation nécessaire : ${title}`,
      body: 'Les comparables les plus récents ont plus de 90 jours : actualisez-les avant d\'acheter.',
      dedupKey: `stale:${id}:${month}`,
    });
  }
  return events;
}
