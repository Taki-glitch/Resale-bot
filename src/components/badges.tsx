import { ACTION_LABEL, BAND_LABEL, RISK_LABEL, deriveAction, scoreBand } from '../core/evaluation.ts';
import type { Action, Recommendation, RiskLevel } from '../core/evaluation.ts';

const ACTION_STYLE: Record<Action, string> = {
  buy: 'bg-gain text-white',
  watch: 'bg-orange-100 text-warn',
  negotiate: 'bg-amber-100 text-amber-800',
  avoid: 'bg-red-100 text-loss',
  insufficient: 'border border-warn bg-orange-50 text-warn',
};

const RISK_STYLE: Record<RiskLevel, string> = {
  low: 'bg-emerald-100 text-gain',
  medium: 'bg-orange-100 text-warn',
  high: 'bg-red-100 text-loss',
};

/** Action suggérée (Acheter, À surveiller, À négocier, Ne pas acheter, Non évaluable). */
export function ActionBadge({
  recommendation,
  priceCents,
  maxBuyCents,
}: {
  recommendation: Recommendation;
  priceCents: number | null;
  maxBuyCents: number | null;
}) {
  const action = deriveAction(recommendation, priceCents, maxBuyCents);
  return (
    <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${ACTION_STYLE[action]}`}>{ACTION_LABEL[action]}</span>
  );
}

export function ScoreChip({ score }: { score: number | null }) {
  if (score === null) return <span className="text-xs text-slate-400">Score —</span>;
  return (
    <span className="text-xs text-slate-600">
      Score <strong className="text-navy-950">{score}/100</strong> · {BAND_LABEL[scoreBand(score)]}
    </span>
  );
}

export function RiskBadge({ value }: { value: RiskLevel | null }) {
  if (!value) return <span className="text-xs text-slate-400">Risque : —</span>;
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${RISK_STYLE[value]}`}>
      Risque {RISK_LABEL[value].toLowerCase()}
    </span>
  );
}
