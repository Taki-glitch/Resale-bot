import { Link } from 'react-router-dom';
import { PackagePlus, Search, ShoppingCart, Sparkles, Warehouse } from 'lucide-react';
import { useDashboardStats } from '../hooks/useDashboardStats.ts';
import { useSettings } from '../hooks/useSettings.ts';
import { formatEuros } from '../core/settings.ts';

function Stat({ label, value, tone, hint }: { label: string; value: string; tone?: 'gain' | 'loss'; hint?: string }) {
  const color = tone === 'gain' ? 'text-gain' : tone === 'loss' ? 'text-loss' : 'text-navy-950';
  return (
    <div className="card">
      <div className="text-sm text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${color}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-400">{hint}</div>}
    </div>
  );
}

const shortcuts = [
  { to: '/recherche', label: 'Lancer une recherche', icon: Search },
  { to: '/recherche', label: 'Ajouter une annonce', icon: PackagePlus },
  { to: '/opportunites', label: 'Voir les opportunités', icon: Sparkles },
  { to: '/inventaire', label: 'Ajouter un achat', icon: ShoppingCart },
  { to: '/inventaire', label: 'Consulter le stock', icon: Warehouse },
];

export default function Dashboard() {
  const { stats, error } = useDashboardStats();
  const { settings } = useSettings();
  const profitTone = (c: number) => (c > 0 ? 'gain' : c < 0 ? 'loss' : undefined);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-navy-950">Dashboard</h1>
      {error && <p className="card text-sm text-loss">Erreur de chargement : {error}</p>}
      {!stats && !error && <p className="text-sm text-slate-500">Chargement…</p>}
      {stats && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Budget total" value={formatEuros(settings.totalBudgetCents)} />
            <Stat label="Capital investi" value={formatEuros(stats.investedCents)} />
            <Stat label="Chiffre d'affaires" value={formatEuros(stats.revenueCents)} />
            <Stat label="Bénéfices réalisés" value={formatEuros(stats.realizedProfitCents)}
              tone={profitTone(stats.realizedProfitCents)} hint="Ventes réelles uniquement" />
            <Stat label="Bénéfices potentiels" value={formatEuros(stats.potentialProfitCents)}
              hint="Estimation, non garantie" />
            <Stat label="Annonces analysées" value={String(stats.listingsAnalyzed)} />
            <Stat label="Opportunités" value={String(stats.opportunities)} />
            <Stat label="Articles en stock" value={String(stats.inStock)} />
            <Stat label="Ventes" value={String(stats.salesCount)} />
          </div>
          {stats.listingsAnalyzed === 0 && (
            <p className="card text-sm text-slate-600">
              Aucune donnée pour l'instant. Les graphiques arriveront en V0.5 ; commence par ajouter une annonce.
            </p>
          )}
        </>
      )}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
        {shortcuts.map(({ to, label, icon: Icon }) => (
          <Link key={label} to={to} className="btn btn-ghost justify-start"><Icon size={18} /> {label}</Link>
        ))}
      </div>
    </div>
  );
}
