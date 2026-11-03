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

/** Simulation libre : toutes les hypothèses sont saisies et affichées. L'évaluation d'annonce utilise ses propres données observées. */
export default function ProfitCalculator({ initialSaleCents, initialPurchaseCents, initialPlatform }: Props) {
  const { settings } = useSettings();
  const [platform, setPlatform] = useState(initialPlatform && initialPlatform !== 'manual' ? initialPlatform : 'vinted');
  const [sale, setSale] = useState(toField(initialSaleCents));
  const [purchase, setPurchase] = useState(toField(initialPurchaseCents));
  const [purchaseShipping, setPurchaseShipping] = useState('');
  const [cleaning, setCleaning] = useState('');
  const [other, setOther] = useState('');
  const [saleShipping, setSaleShipping] = useState('');
  const [percent, setPercent] = useState('0');
  const [fixed, setFixed] = useState('0');

  useEffect(() => setSale(toField(initialSaleCents)), [initialSaleCents]);
  useEffect(() => setPurchase(toField(initialPurchaseCents)), [initialPurchaseCents]);

  // Valeurs par défaut issues des paramètres ; modifiables ensuite.
  useEffect(() => {
    if (!initialPlatform) setPlatform(settings.resalePlatform);
  }, [initialPlatform, settings.resalePlatform]);
  useEffect(() => {
    setPurchaseShipping(settings.defaultPurchaseShippingCents > 0 ? toField(settings.defaultPurchaseShippingCents) : '');
    setCleaning(settings.defaultCleaningCents > 0 ? toField(settings.defaultCleaningCents) : '');
    setOther(settings.defaultOtherCostsCents > 0 ? toField(settings.defaultOtherCostsCents) : '');
    setSaleShipping(settings.defaultSaleShippingCents > 0 ? toField(settings.defaultSaleShippingCents) : '');
  }, [settings.defaultPurchaseShippingCents, settings.defaultCleaningCents, settings.defaultOtherCostsCents, settings.defaultSaleShippingCents]);
  useEffect(() => {
    const f: FeeModel = settings.fees[`${platform}:sale`] ?? NO_FEES;
    setPercent(String(f.percent).replace('.', ','));
    setFixed(toField(f.fixedCents) || '0');
  }, [platform, settings]);

  const result = useMemo(() => {
    const saleCents = parseEuros(sale);
    if (saleCents === null || saleCents <= 0) return null;
    const costs = {
      purchaseShippingCents: parseEuros(purchaseShipping) ?? 0,
      cleaningCents: parseEuros(cleaning) ?? 0,
      otherCostsCents: parseEuros(other) ?? 0,
      saleShippingCents: parseEuros(saleShipping) ?? 0,
    };
    const fee: FeeModel = { percent: Number(percent.replace(',', '.')) || 0, fixedCents: parseEuros(fixed) ?? 0 };
    const input = { salePriceCents: saleCents, purchasePriceCents: parseEuros(purchase) ?? 0, fee, ...costs };
    return {
      central: computeProfit(input),
      scenarios: computeScenarios(input),
      maxBuy: maxPurchasePrice({ salePriceCents: saleCents, fee, minProfitCents: settings.minProfitCents, ...costs }),
      minSale: minResalePrice({ purchasePriceCents: input.purchasePriceCents, fee, minProfitCents: settings.minProfitCents, ...costs }),
      breakEven: minResalePrice({ purchasePriceCents: input.purchasePriceCents, fee, minProfitCents: 0, ...costs }),
    };
  }, [sale, purchase, purchaseShipping, cleaning, other, saleShipping, percent, fixed, settings.minProfitCents]);

  const meetsGoals =
    result !== null &&
    result.central.netProfitCents >= settings.minProfitCents &&
    (result.central.roiPct ?? -Infinity) >= settings.minRoiPct;

  const field = (label: string, value: string, set: (v: string) => void, hint?: string) => (
    <div>
      <label className="label">{label}</label>
      <input className="input" inputMode="decimal" value={value} onChange={(e) => set(e.target.value)} placeholder={hint} />
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {field('Prix de revente estimé (€)', sale, setSale, '0,00')}
        {field("Prix d'achat (€)", purchase, setPurchase, '0,00')}
        {field("Livraison à l'achat (€)", purchaseShipping, setPurchaseShipping, '0,00')}
        {field('Nettoyage / remise en état (€)', cleaning, setCleaning, '0,00')}
        {field('Autres coûts (€)', other, setOther, 'emballage…')}
        {field('Livraison vente à ta charge (€)', saleShipping, setSaleShipping, '0 si payée par l\'acheteur')}
        <div>
          <label className="label">Plateforme de revente</label>
          <select className="input" value={platform} onChange={(e) => setPlatform(e.target.value)}>
            {PLATFORMS.map((p) => (
              <option key={p.key} value={p.key}>{p.label}</option>
            ))}
          </select>
        </div>
        {field('Frais de plateforme (%)', percent, setPercent)}
        {field('Frais fixes (€)', fixed, setFixed)}
      </div>

      {!result && <p className="text-sm text-slate-500">Renseigne un prix de revente pour calculer.</p>}

      {result && (
        <>
          <div className={`card ${meetsGoals ? 'border-gain' : 'border-warn'}`}>
            <p className="text-sm text-slate-500">Bénéfice net estimé (scénario central)</p>
            <p className={`text-3xl font-semibold ${tone(result.central.netProfitCents)}`}>{formatEuros(result.central.netProfitCents)}</p>
            <p className="mt-1 text-sm text-slate-600">
              Marge nette {formatPct(result.central.marginPct)} · Rendement {formatPct(result.central.roiPct)}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Coût total d'acquisition {formatEuros(result.central.acquisitionCostCents)} · Frais de plateforme {formatEuros(result.central.feesCents)} ·
              Livraison vente {formatEuros(result.central.saleShippingCents)} · Chiffre d'affaires {formatEuros(parseEuros(sale) ?? 0)}
            </p>
            <p className={`mt-2 text-sm ${meetsGoals ? 'text-gain' : 'text-warn'}`}>
              {meetsGoals
                ? 'Atteint vos seuils (bénéfice et rendement minimum).'
                : `Sous vos seuils (${formatEuros(settings.minProfitCents)} et ${settings.minRoiPct} %).`}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="card">
              <p className="text-xs text-slate-500">Achat maximal acceptable</p>
              <p className="text-lg font-semibold text-navy-950">{formatEuros(result.maxBuy)}</p>
            </div>
            <div className="card">
              <p className="text-xs text-slate-500">Revente minimale (objectif)</p>
              <p className="text-lg font-semibold text-navy-950">{result.minSale === null ? '—' : formatEuros(result.minSale)}</p>
            </div>
            <div className="card">
              <p className="text-xs text-slate-500">Équilibre de revente</p>
              <p className="text-lg font-semibold text-navy-950">{result.breakEven === null ? '—' : formatEuros(result.breakEven)}</p>
            </div>
          </div>

          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="pb-2">Scénario (hypothèse)</th>
                  <th className="pb-2">Revente</th>
                  <th className="pb-2">Bénéfice</th>
                  <th className="pb-2">Rendement</th>
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    ['Prudent (−15 %)', result.scenarios.cautious],
                    ['Central', result.scenarios.realistic],
                    ['Optimiste (+10 %)', result.scenarios.optimistic],
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
            Simulation manuelle : −15 % et +10 % sont de simples hypothèses, pas des prévisions. Les frais ne sont comptés qu'une fois : si l'acheteur paie la
            livraison, laisse « livraison vente » à 0. Estimations, jamais un bénéfice garanti.
          </p>
        </>
      )}
    </div>
  );
}
