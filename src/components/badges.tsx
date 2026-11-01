import { RECOMMENDATION_LABEL, RISK_LABEL } from '../core/evaluation.ts';
import type { Recommendation, RiskLevel } from '../core/evaluation.ts';

const REC_STYLE: Record<Recommendation, string> = {
  excellent: 'bg-gain text-white',
  good: 'bg-emerald-100 text-gain',
  conditional: 'bg-orange-100 text-warn',
  poor: 'bg-slate-200 text-slate-700',
  avoid: 'bg-red-100 text-loss',
  insufficient: 'border border-warn bg-orange-50 text-warn',
};

const RISK_STYLE: Record<RiskLevel, string> = {
  low: 'bg-emerald-100 text-gain',
  medium: 'bg-orange-100 text-warn',
  high: 'bg-red-100 text-loss',
};

export function RecommendationBadge({ value }: { value: Recommendation }) {
  return (
    <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${REC_STYLE[value]}`}>
      {RECOMMENDATION_LABEL[value]}
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
