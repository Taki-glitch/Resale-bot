import { lazy, Suspense } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth.tsx';
import { isConfigured } from './lib/supabase.ts';
import Layout from './components/Layout.tsx';
import Login from './pages/Login.tsx';
import Dashboard from './pages/Dashboard.tsx';
import SettingsPage from './pages/SettingsPage.tsx';
import Listings from './pages/Listings.tsx';
const ListingDetail = lazy(() => import('./pages/ListingDetail.tsx'));
const CalculatorPage = lazy(() => import('./pages/CalculatorPage.tsx'));
const Opportunities = lazy(() => import('./pages/Opportunities.tsx'));
const Notifications = lazy(() => import('./pages/Notifications.tsx'));
const Inventory = lazy(() => import('./pages/Inventory.tsx'));
const InventoryDetail = lazy(() => import('./pages/InventoryDetail.tsx'));
const Sales = lazy(() => import('./pages/Sales.tsx'));
const Stats = lazy(() => import('./pages/Stats.tsx'));
const Journal = lazy(() => import('./pages/Journal.tsx'));

function Guard() {
  const { session, loading } = useAuth();
  if (loading) return <div className="p-6 text-sm text-slate-500">Chargement…</div>;
  return session ? <Layout /> : <Login />;
}

export default function App() {
  if (!isConfigured) {
    return (
      <div className="flex min-h-full items-center justify-center p-6">
        <div className="card max-w-md">
          <h1 className="mb-2 text-lg font-semibold text-loss">Configuration manquante</h1>
          <p className="text-sm text-slate-600">
            Définis VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY (voir .env.example et README).
          </p>
        </div>
      </div>
    );
  }
  return (
    <AuthProvider>
      <HashRouter>
        <Suspense fallback={<div className="p-6 text-sm text-slate-500">Chargement…</div>}>
        <Routes>
          <Route element={<Guard />}>
            <Route index element={<Dashboard />} />
            <Route path="recherche" element={<Listings />} />
            <Route path="annonce/:id" element={<ListingDetail />} />
            <Route path="calculateur" element={<CalculatorPage />} />
            <Route path="opportunites" element={<Opportunities />} />
            <Route path="inventaire" element={<Inventory />} />
            <Route path="inventaire/:id" element={<InventoryDetail />} />
            <Route path="reventes" element={<Inventory mode="resale" />} />
            <Route path="ventes" element={<Sales />} />
            <Route path="statistiques" element={<Stats />} />
            <Route path="journal" element={<Journal />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="parametres" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
        </Suspense>
      </HashRouter>
    </AuthProvider>
  );
}
