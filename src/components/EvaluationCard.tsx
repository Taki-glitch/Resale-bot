import { BAND_LABEL, CONFIDENCE_LABEL } from '../core/evaluation.ts';
import type { Evaluation } from '../core/evaluation.ts';
import { formatEuros, formatPct } from '../core/format.ts';
import { ActionBadge, RiskBadge } from './badges.tsx';

const tone = (cents: number | null): string =>
  cents === null ? 'text-navy-950' : cents > 0 ? 'text-gain' : cents < 0 ? 'text-loss' : 'text-navy-950';
const money = (c: number | null) => (c === null ? '—' : formatEuros(c));

function Cell({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`font-semibold ${valueClass ?? 'text-navy-950'}`}>{value}</p>
    </div>
  );
}

function List({ title, titleClass, items }: { title: string; titleClass: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className={`mb-1 text-sm font-semibold ${titleClass}`}>{title}</p>
      <ul className="list-disc space-y-0.5 pl-5 text-sm text-slate-700">
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </div>
  );
}

export default function EvaluationCard({ ev }: { ev: Evaluation }) {
  const evaluable = ev.recommendation !== 'insufficient';
  return (
    <div className="card space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ActionBadge recommendation={ev.recommendation} priceCents={ev.purchaseCents} maxBuyCents={ev.maxBuyCents} />
        <p className="text-sm text-slate-600">
          Score <strong className="text-navy-950">{ev.score === null ? '—' : `${ev.score}/100`}</strong>
          {ev.score !== null && <span> · {BAND_LABEL[ev.band]}</span>}
        </p>
      </div>
      <p className="text-sm text-slate-700">{ev.summary}</p>

      {evaluable && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Cell label="Prix d'achat" value={money(ev.purchaseCents)} />
            <Cell label="Coût d'acquisition total" value={money(ev.costs?.acquisitionCostCents ?? null)} />
            <Cell label="Revente estimée (chiffre d'affaires)" value={money(ev.resaleEstimateCents)} />
            <Cell label="Bénéfice net estimé" value={money(ev.netProfitCents)} valueClass={tone(ev.netProfitCents)} />
            <Cell label="Marge nette" value={formatPct(ev.netMarginPct)} />
            <Cell label="Rendement" value={formatPct(ev.roiPct)} />
            <Cell label="Achat maximal conseillé" value={money(ev.maxBuyCents)} />
            <Cell label="Équilibre de revente" value={money(ev.breakEvenCents)} />
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-slate-600">
              Confiance de l'estimation : <strong>{CONFIDENCE_LABEL[ev.confidenceLevel]}</strong> ({Math.round(ev.confidence * 100)} %)
            </span>
            <RiskBadge value={ev.risk} />
          </div>

          {ev.costs && (
            <div className="text-sm text-slate-700">
              <p className="mb-1 font-semibold text-navy-950">Hypothèses de coûts</p>
              <p>
                Achat {formatEuros(ev.costs.purchaseCents)} + livraison achat {formatEuros(ev.costs.purchaseShippingCents)} + remise en état{' '}
                {formatEuros(ev.costs.cleaningCents)} + autres {formatEuros(ev.costs.otherCents)} = <strong>{formatEuros(ev.costs.acquisitionCostCents)}</strong>.
                À la vente : frais de plateforme {formatEuros(ev.costs.platformFeesCents)} et livraison {formatEuros(ev.costs.saleShippingCents)}.
              </p>
            </div>
          )}

          {ev.scenarios && (
            <div className="overflow-x-auto">
              <p className="mb-1 text-sm font-semibold text-navy-950">Scénarios de revente</p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500">
                    <th className="pb-1">Scénario</th>
                    <th className="pb-1">Revente</th>
                    <th className="pb-1">Bénéfice net</th>
                    <th className="pb-1">Rendement</th>
                  </tr>
                </thead>
                <tbody>
                  {(
                    [
                      ['Prudent', ev.scenarios.prudent],
                      ['Central', ev.scenarios.central],
                      ['Optimiste', ev.scenarios.optimistic],
                    ] as const
                  ).map(([label, s]) => (
                    <tr key={label} className="border-t border-slate-100">
                      <td className="py-1.5">{label}</td>
                      {s ? (
                        <>
                          <td className="py-1.5">{formatEuros(s.salePriceCents)}</td>
                          <td className={`py-1.5 font-medium ${tone(s.netProfitCents)}`}>{formatEuros(s.netProfitCents)}</td>
                          <td className="py-1.5">{formatPct(s.roiPct)}</td>
                        </>
                      ) : (
                        <td className="py-1.5 text-xs text-slate-500" colSpan={3}>Non affiché : les données ne le justifient pas</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              <ul className="mt-1 list-disc pl-5 text-xs text-slate-500">
                {ev.scenarioNotes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      <List title="Justification" titleClass="text-navy-950" items={ev.justification} />
      <List title="Pour que l'achat devienne raisonnable" titleClass="text-warn" items={ev.conditions} />
      <List title="Risques identifiés" titleClass="text-loss" items={ev.risks} />

      {ev.scoreCap && (
        <p className="rounded-lg bg-orange-50 p-2 text-xs text-warn">
          Score plafonné à {ev.scoreCap.value} (score brut {ev.rawScore}) : {ev.scoreCap.reasons.join(' ; ')}.
        </p>
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
