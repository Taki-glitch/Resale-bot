import { useEffect, useMemo, useState } from 'react';
import { fetchSales } from '../services/sales.ts';
import { fetchInventory } from '../services/inventory.ts';
import { fetchListingsWithMeta } from '../services/listings.ts';
import { useSettings } from '../hooks/useSettings.ts';
import { BarChart, LineChart, ProgressBar } from '../components/charts.tsx';
import { agingBuckets, capitalUsage, funnelRates, monthlySeries, objectiveProgress, sellingCostsCents } from '../core/stats.ts';
import type { FunnelCounts } from '../core/stats.ts';
import { stockSummary, summarizeSales } from '../core/inventory.ts';
import type { InventoryItemView, SaleView } from '../core/inventory.ts';
import { deriveAction } from '../core/evaluation.ts';
import { formatEuros, formatPct } from '../core/format.ts';
import { errMsg } from '../lib/errors.ts';

function Kpi({ label, value, hint, valueClass }: { label: string; value: string; hint?: string; valueClass?: string }) {
  return (
    <div className="card">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-xl font-semibold ${valueClass ?? 'text-navy-950'}`}>{value}</p>
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

export default function Stats() {
  const { settings } = useSettings();
  const [sales, setSales] = useState<SaleView[] | null>(null);
  const [items, setItems] = useState<InventoryItemView[]>([]);
  const [funnel, setFunnel] = useState<FunnelCounts | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchSales(), fetchInventory(), fetchListingsWithMeta()])
      .then(([s, inv, listings]) => {
        setSales(s);
        setItems(inv.views);
        setFunnel({
          listings: listings.length,
          evaluated: listings.filter((l) => l.opportunity?.recommendation && l.opportunity.recommendation !== 'insufficient').length,
          recommended: listings.filter(
            (l) => l.opportunity?.recommendation && deriveAction(l.opportunity.recommendation, l.price_cents, l.opportunity.max_buy_cents) === 'buy',
          ).length,
          bought: listings.filter((l) => l.opportunity?.status === 'bought').length,
          sold: s.length,
        });
      })
      .catch((e) => setError(errMsg(e)));
  }, []);

  const month = new Date().toISOString().slice(0, 7);
  const series = useMemo(() => monthlySeries(sales ?? [], month, 12), [sales, month]);
  const summary = useMemo(() => summarizeSales(sales ?? []), [sales]);
  const stock = useMemo(() => stockSummary(items), [items]);
  const aging = useMemo(() => agingBuckets(items), [items]);
  const thisMonth = series[series.length - 1];
  const objective = objectiveProgress(thisMonth?.netProfitCents ?? 0, settings.monthlyTargetCents);
  const capital = capitalUsage(settings.totalBudgetCents, stock.costCents);
  const rates = funnel ? funnelRates(funnel) : null;
  const tone = (c: number) => (c > 0 ? 'text-gain' : c < 0 ? 'text-loss' : 'text-navy-950');

  if (error) return <p className="text-sm text-loss">{error}</p>;
  if (!sales || !funnel || !rates) return <p className="text-sm text-slate-500">Chargement…</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-navy-950">Statistiques</h1>
      <p className="text-xs text-slate-500">Données réelles issues de vos annonces, achats et ventes enregistrés. Aucune valeur n'est estimée dans cette page.</p>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Bénéfice net réalisé" value={formatEuros(summary.netProfitCents)} valueClass={tone(summary.netProfitCents)}
          hint={summary.unknownCostCount > 0 ? `${summary.unknownCostCount} vente(s) au coût inconnu exclue(s)` : undefined} />
        <Kpi label="Chiffre d'affaires" value={formatEuros(summary.revenueCents)} />
        <Kpi label="Frais de vente supportés" value={formatEuros(sellingCostsCents(sales))} hint="commissions, livraisons, autres" />
        <Kpi label="Marge moyenne" value={formatPct(summary.averageMarginPct)} hint={summary.averageDaysToSell === null ? undefined : `vente en ${summary.averageDaysToSell} j en moyenne`} />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="card space-y-2">
          <p className="font-semibold text-navy-950">Objectif du mois</p>
          <p className="text-sm text-slate-600">
            {formatEuros(thisMonth?.netProfitCents ?? 0)} sur {formatEuros(settings.monthlyTargetCents)}
            {objective.pct !== null ? ` (${objective.pct} %)` : ''}
          </p>
          <ProgressBar pct={objective.pct ?? 0} tone={(objective.pct ?? 0) >= 100 ? 'gain' : 'navy'} />
          <p className="text-xs text-slate-500">
            {objective.remainingCents > 0 ? `Reste ${formatEuros(objective.remainingCents)} pour atteindre l'objectif.` : 'Objectif atteint.'} Les objectifs sont des repères, pas des promesses.
          </p>
        </div>
        <div className="card space-y-2">
          <p className="font-semibold text-navy-950">Capital engagé</p>
          <p className="text-sm text-slate-600">
            {formatEuros(capital.engagedCents)} en stock sur un budget de {formatEuros(settings.totalBudgetCents)}
            {capital.usedPct !== null ? ` (${capital.usedPct} %)` : ''}
          </p>
          <ProgressBar pct={capital.usedPct ?? 0} tone={(capital.usedPct ?? 0) > 90 ? 'warn' : 'navy'} />
          <p className="text-xs text-slate-500">Budget disponible estimé : {formatEuros(Math.max(0, capital.availableCents))} (les gains réinvestis ne sont pas comptés).</p>
        </div>
      </div>

      <section className="card space-y-2">
        <p className="font-semibold text-navy-950">Bénéfice net par mois</p>
        <BarChart points={series.map((p) => ({ label: p.month, value: p.netProfitCents }))} format={formatEuros} />
      </section>
      <section className="card space-y-2">
        <p className="font-semibold text-navy-950">Bénéfice cumulé</p>
        <LineChart points={series.map((p) => ({ label: p.month, value: p.cumulativeProfitCents }))} format={formatEuros} />
      </section>
      <section className="card space-y-2">
        <p className="font-semibold text-navy-950">Chiffre d'affaires par mois</p>
        <BarChart points={series.map((p) => ({ label: p.month, value: p.revenueCents }))} format={formatEuros} />
      </section>

      <section className="card space-y-2">
        <p className="font-semibold text-navy-950">Parcours des annonces</p>
        <table className="w-full text-sm">
          <tbody>
            {[
              ['Annonces saisies', funnel.listings, null],
              ['Évaluables', funnel.evaluated, rates.evaluatedPct],
              ['Recommandées « Acheter »', funnel.recommended, rates.recommendedPct],
              ['Achetées', funnel.bought, rates.boughtPct],
              ['Vendues', funnel.sold, rates.soldPct],
            ].map(([label, n, pct]) => (
              <tr key={String(label)} className="border-t border-slate-100">
                <td className="py-1.5">{label}</td>
                <td className="font-medium">{n}</td>
                <td className="text-xs text-slate-500">{pct === null ? '' : `${pct} %`}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-slate-500">Pourcentages : évaluables / saisies, recommandées / évaluables, achetées / saisies, vendues / achetées.</p>
      </section>

      <section className="card space-y-2">
        <p className="font-semibold text-navy-950">Stock par ancienneté</p>
        <table className="w-full text-sm">
          <tbody>
            {aging.map((b) => (
              <tr key={b.label} className="border-t border-slate-100">
                <td className="py-1.5">{b.label}</td>
                <td>{b.count} article(s)</td>
                <td className="text-slate-600">{formatEuros(b.costCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
