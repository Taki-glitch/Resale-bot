import { CONFIDENCE_LABEL } from '../core/evaluation.ts';
import type { Evaluation } from '../core/evaluation.ts';
import { formatEuros, formatPct } from '../core/format.ts';
import { RecommendationBadge, RiskBadge } from './badges.tsx';

const tone = (cents: number | null): string =>
  cents === null ? 'text-navy-950' : cents > 0 ? 'text-gain' : cents < 0 ? 'text-loss' : 'text-navy-950';

function Cell({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`font-semibold ${valueClass ?? 'text-navy-950'}`}>{value}</p>
    </div>
  );
}

export default function EvaluationCard({ ev }: { ev: Evaluation }) {
  const money = (c: number | null) => (c === null ? '—' : formatEuros(c));
  return (
    <div className="card space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <RecommendationBadge value={ev.recommendation} />
        <p className="text-sm text-slate-600">
          Score <strong className="text-navy-950">{ev.score === null ? '—' : `${ev.score}/100`}</strong>
        </p>
      </div>

      {ev.recommendation !== 'insufficient' && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Cell label="Prix d'achat" value={money(ev.purchaseCents)} />
            <Cell label="Revente estimée" value={money(ev.resaleEstimateCents)} />
            <Cell label="Frais estimés" value={money(ev.feesCents)} />
            <Cell label="Bénéfice net estimé" value={money(ev.netProfitCents)} valueClass={tone(ev.netProfitCents)} />
            <Cell label="Marge nette" value={formatPct(ev.netMarginPct)} />
            <Cell label="Rendement" value={formatPct(ev.roiPct)} />
            <Cell label="Achat maximal conseillé" value={money(ev.maxBuyCents)} />
            <Cell label="Revente minimale" value={money(ev.minResaleCents)} />
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-slate-600">
              Confiance de l'estimation : <strong>{CONFIDENCE_LABEL[ev.confidenceLevel]}</strong> ({Math.round(ev.confidence * 100)} %)
            </span>
            <RiskBadge value={ev.risk} />
          </div>
        </>
      )}

      <div>
        <p className="mb-1 text-sm font-semibold text-navy-950">Justification</p>
        <ul className="list-disc space-y-0.5 pl-5 text-sm text-slate-700">
          {ev.justification.map((j) => (
            <li key={j}>{j}</li>
          ))}
        </ul>
      </div>

      {ev.conditions.length > 0 && (
        <div>
          <p className="mb-1 text-sm font-semibold text-warn">Pour que l'achat devienne raisonnable</p>
          <ul className="list-disc space-y-0.5 pl-5 text-sm text-slate-700">
            {ev.conditions.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      )}

      {ev.risks.length > 0 && (
        <div>
          <p className="mb-1 text-sm font-semibold text-loss">Risques identifiés</p>
          <ul className="list-disc space-y-0.5 pl-5 text-sm text-slate-700">
            {ev.risks.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      {ev.criteria.length > 0 && (
        <div className="overflow-x-auto">
          <p className="mb-1 text-sm font-semibold text-navy-950">Détail du score</p>
          <table className="w-full text-sm">
            <tbody>
              {ev.criteria.map((c) => (
                <tr key={c.key} className="border-t border-slate-100 align-top">
                  <td className="py-1.5 pr-2 font-medium">{c.label}</td>
                  <td className="whitespace-nowrap py-1.5 pr-2">
                    {c.earned.toFixed(1)} / {c.max.toFixed(0)}
                  </td>
                  <td className={`py-1.5 text-xs ${c.measured ? 'text-slate-500' : 'text-warn'}`}>{c.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-slate-500">
        Estimation fondée sur vos comparables : ce n'est ni un prix de vente garanti ni un conseil financier. La décision d'achat reste la vôtre.
      </p>
    </div>
  );
}
