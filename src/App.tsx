import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth.tsx';
import { isConfigured } from './lib/supabase.ts';
import Layout from './components/Layout.tsx';
import ComingSoon from './components/ComingSoon.tsx';
import Login from './pages/Login.tsx';
import Dashboard from './pages/Dashboard.tsx';
import SettingsPage from './pages/SettingsPage.tsx';
import Listings from './pages/Listings.tsx';
import ListingDetail from './pages/ListingDetail.tsx';
import CalculatorPage from './pages/CalculatorPage.tsx';
import Opportunities from './pages/Opportunities.tsx';
import Notifications from './pages/Notifications.tsx';

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
        <Routes>
          <Route element={<Guard />}>
            <Route index element={<Dashboard />} />
            <Route path="recherche" element={<Listings />} />
            <Route path="annonce/:id" element={<ListingDetail />} />
            <Route path="calculateur" element={<CalculatorPage />} />
            <Route path="opportunites" element={<Opportunities />} />
            <Route path="inventaire" element={<ComingSoon title="Inventaire" version="V0.4"
              text="Achats confirmés, statuts et suivi du stock." />} />
            <Route path="reventes" element={<ComingSoon title="Reventes" version="V0.4"
              text="Préparation des annonces de revente (publication manuelle)." />} />
            <Route path="ventes" element={<ComingSoon title="Ventes et comptabilité" version="V0.4"
              text="Ventes réelles, bénéfices obtenus, export CSV et JSON." />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="parametres" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
}
