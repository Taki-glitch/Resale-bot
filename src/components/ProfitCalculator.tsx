import { useEffect, useMemo, useState } from 'react';
import { useSettings } from '../hooks/useSettings.ts';
import { computeProfit, computeScenarios, maxPurchasePrice, minResalePrice, NO_FEES } from '../core/profitability.ts';
import type { FeeModel } from '../core/profitability.ts';
import { formatEuros } from '../core/settings.ts';
import { formatPct, parseEuros } from '../core/format.ts';

interface Props {
  initialSaleCents?: number | null;
  initialPurchaseCents?: number | null;
  initialPlatform?: string;
}

const PLATFORMS = [
  { key: 'vinted', label: 'Vinted' },
  { key: 'leboncoin', label: 'Leboncoin' },
  { key: 'other', label: 'Autre' },
];

const toField = (cents?: number | null): string => (cents == null ? '' : String(cents / 100).replace('.', ','));
const tone = (cents: number): string => (cents > 0 ? 'text-gain' : cents < 0 ? 'text-loss' : 'text-navy-950');

export default function ProfitCalculator({ initialSaleCents, initialPurchaseCents, initialPlatform }: Props) {
  const { settings } = useSettings();
  const [platform, setPlatform] = useState(initialPlatform && initialPlatform !== 'manual' ? initialPlatform : 'vinted');
  const [sale, setSale] = useState(toField(initialSaleCents));
  const [purchase, setPurchase] = useState(toField(initialPurchaseCents));
  const [other, setOther] = useState('');
  const [percent, setPercent] = useState('0');
  const [fixed, setFixed] = useState('0');

  useEffect(() => setSale(toField(initialSaleCents)), [initialSaleCents]);
  useEffect(() => setPurchase(toField(initialPurchaseCents)), [initialPurchaseCents]);

  // Valeurs par défaut issues des paramètres (plateforme de revente, coûts annexes moyens).
  useEffect(() => {
    if (!initialPlatform) setPlatform(settings.resalePlatform);
  }, [initialPlatform, settings.resalePlatform]);
  useEffect(() => {
    setOther(settings.defaultOtherCostsCents > 0 ? toField(settings.defaultOtherCostsCents) : '');
  }, [settings.defaultOtherCostsCents]);

  // Frais proposés d'après les paramètres de la plateforme ; modifiables ensuite.
  useEffect(() => {
    const f: FeeModel = settings.fees[`${platform}:sale`] ?? NO_FEES;
    setPercent(String(f.percent).replace('.', ','));
    setFixed(toField(f.fixedCents) || '0');
  }, [platform, settings]);

  const result = useMemo(() => {
    const saleCents = parseEuros(sale);
    if (saleCents === null || saleCents <= 0) return null;
    const purchaseCents = parseEuros(purchase) ?? 0;
    const otherCents = parseEuros(other) ?? 0;
    const fee: FeeModel = { percent: Number(percent.replace(',', '.')) || 0, fixedCents: parseEuros(fixed) ?? 0 };
    const input = { salePriceCents: saleCents, purchasePriceCents: purchaseCents, fee, otherCostsCents: otherCents };
    return {
      realistic: computeProfit(input),
      scenarios: computeScenarios(input),
      maxBuy: maxPurchasePrice({ salePriceCents: saleCents, fee, otherCostsCents: otherCents, minProfitCents: settings.minProfitCents }),
      minSale: minResalePrice({ purchasePriceCents: purchaseCents, fee, otherCostsCents: otherCents, minProfitCents: settings.minProfitCents }),
    };
  }, [sale, purchase, other, percent, fixed, settings.minProfitCents]);

  const meetsGoals =
    result !== null &&
    result.realistic.netProfitCents >= settings.minProfitCents &&
    (result.realistic.roiPct ?? -Infinity) >= settings.minRoiPct;

  const field = (label: string, value: string, set: (v: string) => void, hint?: string) => (
    <div>
      <label className="label">{label}</label>
      <input className="input" inputMode="decimal" value={value} onChange={(e) => set(e.target.value)} placeholder={hint} />
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {field('Prix de revente (€)', sale, setSale, '0,00')}
        {field("Prix d'achat (€)", purchase, setPurchase, '0,00')}
        {field('Autres coûts (€)', other, setOther, 'transport, emballage…')}
        <div>
          <label className="label">Plateforme de revente</label>
          <select className="input" value={platform} onChange={(e) => setPlatform(e.target.value)}>
            {PLATFORMS.map((p) => (
              <option key={p.key} value={p.key}>{p.label}</option>
            ))}
          </select>
        </div>
        {field('Frais (%)', percent, setPercent)}
        {field('Frais fixes (€)', fixed, setFixed)}
      </div>

      {!result && <p className="text-sm text-slate-500">Renseigne un prix de revente pour calculer.</p>}

      {result && (
        <>
          <div className={`card ${meetsGoals ? 'border-gain' : 'border-warn'}`}>
            <p className="text-sm text-slate-500">Bénéfice net estimé (scénario réaliste)</p>
            <p className={`text-3xl font-semibold ${tone(result.realistic.netProfitCents)}`}>
              {formatEuros(result.realistic.netProfitCents)}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Marge {formatPct(result.realistic.marginPct)} · Rendement {formatPct(result.realistic.roiPct)} · Frais{' '}
              {formatEuros(result.realistic.feesCents)}
            </p>
            <p className={`mt-2 text-sm ${meetsGoals ? 'text-gain' : 'text-warn'}`}>
              {meetsGoals
                ? 'Atteint vos seuils (bénéfice et rendement minimum).'
                : `Sous vos seuils (${formatEuros(settings.minProfitCents)} et ${settings.minRoiPct} %).`}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="card">
              <p className="text-sm text-slate-500">Prix d'achat maximal</p>
              <p className="text-xl font-semibold text-navy-950">{formatEuros(result.maxBuy)}</p>
            </div>
            <div className="card">
              <p className="text-sm text-slate-500">Prix de revente minimum</p>
              <p className="text-xl font-semibold text-navy-950">{result.minSale === null ? '—' : formatEuros(result.minSale)}</p>
            </div>
          </div>

          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="pb-2">Scénario</th>
                  <th className="pb-2">Revente</th>
                  <th className="pb-2">Bénéfice</th>
                  <th className="pb-2">Rendement</th>
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    ['Optimiste (+10 %)', result.scenarios.optimistic],
                    ['Réaliste', result.scenarios.realistic],
                    ['Prudent (−15 %)', result.scenarios.cautious],
                  ] as const
                ).map(([label, s]) => (
                  <tr key={label} className="border-t border-slate-100">
                    <td className="py-2">{label}</td>
                    <td className="py-2">{formatEuros(s.salePriceCents)}</td>
                    <td className={`py-2 font-medium ${tone(s.netProfitCents)}`}>{formatEuros(s.netProfitCents)}</td>
                    <td className="py-2">{formatPct(s.roiPct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500">
            Estimations, jamais un bénéfice garanti. Les frais dépendent de la plateforme et du mode de livraison :
            vérifie-les dans Paramètres.
          </p>
        </>
      )}
    </div>
  );
}
