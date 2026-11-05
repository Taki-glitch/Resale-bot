import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchSales } from '../services/sales.ts';
import { fetchInventory } from '../services/inventory.ts';
import { exportAllData } from '../services/backup.ts';
import { stockSummary, summarizeSales, realizedProfitCents } from '../core/inventory.ts';
import type { GroupPerformance, InventoryItemView, SaleView } from '../core/inventory.ts';
import { euros, toCsv } from '../core/export.ts';
import { formatEuros, formatPct } from '../core/format.ts';
import { downloadFile } from '../lib/download.ts';
import { errMsg } from '../lib/errors.ts';

const tone = (c: number): string => (c > 0 ? 'text-gain' : c < 0 ? 'text-loss' : 'text-navy-950');

function Card({ label, value, hint, valueClass }: { label: string; value: string; hint?: string; valueClass?: string }) {
  return (
    <div className="card">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-xl font-semibold ${valueClass ?? 'text-navy-950'}`}>{value}</p>
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

function GroupTable({ title, rows }: { title: string; rows: GroupPerformance[] }) {
  return (
    <div className="card overflow-x-auto">
      <p className="mb-2 font-semibold text-navy-950">{title}</p>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">Aucune vente.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="pb-1">Groupe</th><th className="pb-1">Ventes</th><th className="pb-1">CA</th><th className="pb-1">Bénéfice</th><th className="pb-1">Marge</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((g) => (
              <tr key={g.key} className="border-t border-slate-100">
                <td className="py-1.5">{g.key}</td><td>{g.count}</td><td>{formatEuros(g.revenueCents)}</td>
                <td className={`font-medium ${tone(g.netProfitCents)}`}>{formatEuros(g.netProfitCents)}</td><td>{formatPct(g.marginPct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function Sales() {
  const [sales, setSales] = useState<SaleView[] | null>(null);
  const [inventory, setInventory] = useState<InventoryItemView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [month, setMonth] = useState(''); // '' = tout
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, i] = await Promise.all([fetchSales(), fetchInventory()]);
      setSales(s);
      setInventory(i.views);
      setError(null);
    } catch (e) {
      setError(errMsg(e));
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const months = useMemo(() => Array.from(new Set((sales ?? []).map((s) => s.soldAt.slice(0, 7)))).sort().reverse(), [sales]);
  const scoped = useMemo(() => (sales ?? []).filter((s) => month === '' || s.soldAt.slice(0, 7) === month), [sales, month]);
  const summary = useMemo(() => summarizeSales(scoped), [scoped]);
  const stock = useMemo(() => stockSummary(inventory), [inventory]);

  function exportSales() {
    downloadFile(
      `ventes-${month || 'toutes'}.csv`,
      toCsv(scoped, [
        { label: 'Date', value: (s) => s.soldAt.slice(0, 10) },
        { label: 'Article', value: (s) => s.name },
        { label: 'Plateforme', value: (s) => s.platform },
        { label: 'Catégorie', value: (s) => s.category },
        { label: 'Prix de vente (€)', value: (s) => euros(s.priceCents) },
        { label: 'Commission (€)', value: (s) => euros(s.feesCents) },
        { label: 'Livraison (€)', value: (s) => euros(s.shippingCents) },
        { label: 'Autres coûts (€)', value: (s) => euros(s.extraCostsCents) },
        { label: "Coût d'acquisition (€)", value: (s) => euros(s.acquisitionCostCents) },
        { label: 'Bénéfice net (€)', value: (s) => euros(realizedProfitCents(s)) },
      ]),
      'text/csv',
    );
  }

  function exportStock() {
    downloadFile(
      'inventaire.csv',
      toCsv(inventory, [
        { label: 'Article', value: (i) => i.name },
        { label: 'Statut', value: (i) => i.status },
        { label: 'Catégorie', value: (i) => i.category },
        { label: "Prix d'achat (€)", value: (i) => euros(i.purchasePriceCents) },
        { label: "Frais d'achat (€)", value: (i) => euros(i.purchaseFeesCents) },
        { label: 'Dépenses (€)', value: (i) => euros(i.expensesCents) },
        { label: 'Prix prévu (€)', value: (i) => euros(i.plannedPriceCents) },
        { label: "Date d'achat", value: (i) => i.purchasedAt?.slice(0, 10) },
      ]),
      'text/csv',
    );
  }

  async function backup() {
    setBusy(true);
    try {
      downloadFile(`resale-bot-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`, await exportAllData(), 'application/json');
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold text-navy-950">Ventes et comptabilité</h1>
        <select className="input !w-auto" value={month} onChange={(e) => setMonth(e.target.value)}>
          <option value="">Toutes les périodes</option>
          {months.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>
      <p className="text-xs text-slate-500">
        Chiffres réels issus de vos achats et ventes enregistrés. Le bénéfice déduit commission, livraison, autres coûts, prix d'achat, frais d'achat et dépenses de l'article. Une vente dont le coût d'achat est inconnu compte dans le chiffre d'affaires mais pas dans le bénéfice.
      </p>
      {error && <p className="text-sm text-loss">{error}</p>}
      {!sales && !error && <p className="text-sm text-slate-500">Chargement…</p>}

      {sales && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Card label="Chiffre d'affaires" value={formatEuros(summary.revenueCents)} />
            <Card label="Coût total des achats vendus" value={formatEuros(summary.acquisitionCostCents)} />
            <Card label="Bénéfice net réalisé" value={formatEuros(summary.netProfitCents)} valueClass={tone(summary.netProfitCents)}
              hint={summary.unknownCostCount > 0 ? `${summary.unknownCostCount} vente(s) au coût inconnu exclue(s)` : undefined} />
            <Card label="Marge moyenne" value={formatPct(summary.averageMarginPct)} />
            <Card label="Produits vendus" value={String(summary.count)} />
            <Card label="Délai moyen de vente" value={summary.averageDaysToSell === null ? '—' : `${summary.averageDaysToSell} j`} />
            <Card label="Valeur du stock restant (coût)" value={formatEuros(stock.costCents)} hint={`${stock.count} article(s)`} />
            <Card label="Prévu contre réalisé"
              value={summary.plannedVsRealized.count === 0 ? '—' : formatEuros(summary.plannedVsRealized.realizedCents - summary.plannedVsRealized.plannedCents)}
              hint={summary.plannedVsRealized.count === 0 ? 'aucun prix prévu saisi' : `sur ${summary.plannedVsRealized.count} vente(s)`} />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <GroupTable title="Performance par plateforme" rows={summary.byPlatform} />
            <GroupTable title="Performance par catégorie" rows={summary.byCategory} />
          </div>

          <div className="card overflow-x-auto">
            <p className="mb-2 font-semibold text-navy-950">Historique des ventes</p>
            {scoped.length === 0 ? (
              <p className="text-sm text-slate-500">Aucune vente enregistrée. Ouvre un article d'inventaire pour enregistrer une vente.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500"><th className="pb-1">Date</th><th className="pb-1">Article</th><th className="pb-1">Prix</th><th className="pb-1">Bénéfice</th></tr>
                </thead>
                <tbody>
                  {scoped.map((s) => {
                    const profit = realizedProfitCents(s);
                    return (
                      <tr key={s.id} className="border-t border-slate-100">
                        <td className="py-1.5 whitespace-nowrap">{new Date(s.soldAt).toLocaleDateString('fr-FR')}</td>
                        <td>{s.inventoryId ? <Link className="underline" to={`/inventaire/${s.inventoryId}`}>{s.name}</Link> : s.name}</td>
                        <td>{formatEuros(s.priceCents)}</td>
                        <td className={profit === null ? 'text-warn' : `font-medium ${tone(profit)}`}>{profit === null ? 'inconnu' : formatEuros(profit)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div className="card space-y-2">
            <p className="font-semibold text-navy-950">Exports et sauvegarde</p>
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-ghost" onClick={exportSales} disabled={scoped.length === 0}>Ventes (CSV)</button>
              <button className="btn btn-ghost" onClick={exportStock} disabled={inventory.length === 0}>Inventaire (CSV)</button>
              <button className="btn btn-ghost" onClick={() => void backup()} disabled={busy}>{busy ? 'Préparation…' : 'Sauvegarde complète (JSON)'}</button>
            </div>
            <p className="text-xs text-slate-500">Les fichiers sont générés dans votre navigateur. La sauvegarde contient vos données (pas les fichiers photo, seulement leurs chemins). La restauration automatique n'est pas encore disponible.</p>
          </div>
        </>
      )}
    </div>
  );
}
