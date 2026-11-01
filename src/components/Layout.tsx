import { NavLink, Outlet } from 'react-router-dom';
import { useUnreadCount } from '../hooks/useUnreadCount.ts';
import {
  Bell, Calculator, LayoutDashboard, Package, Receipt, Search, Settings, Sparkles, Tag,
} from 'lucide-react';

const items = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/recherche', label: 'Recherche', icon: Search },
  { to: '/opportunites', label: 'Opportunités', icon: Sparkles },
  { to: '/calculateur', label: 'Calculateur', icon: Calculator },
  { to: '/inventaire', label: 'Inventaire', icon: Package },
  { to: '/reventes', label: 'Reventes', icon: Tag },
  { to: '/ventes', label: 'Ventes', icon: Receipt },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/parametres', label: 'Paramètres', icon: Settings },
];

export default function Layout() {
  const unread = useUnreadCount();
  const badge = (to: string) =>
    to === '/notifications' && unread > 0 ? (
      <span className="ml-auto rounded-full bg-loss px-1.5 text-[10px] font-semibold text-white">{unread}</span>
    ) : null;
  return (
    <div className="flex h-full flex-col md:flex-row">
      {/* Navigation latérale (tablette / ordinateur) */}
      <aside className="hidden w-60 shrink-0 flex-col bg-navy-950 p-4 text-white md:flex">
        <div className="mb-6 px-2 text-lg font-semibold">Resale Bot</div>
        <nav className="flex flex-col gap-1">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex min-h-[44px] items-center gap-3 rounded-lg px-3 text-sm ${
                  isActive ? 'bg-navy-800 font-medium' : 'text-slate-300 hover:bg-navy-900'
                }`
              }
            >
              <Icon size={18} /> {label}
              {badge(to)}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="min-h-0 flex-1 overflow-y-auto p-4 pt-[max(1rem,env(safe-area-inset-top))] md:p-8">
        <div className="mx-auto max-w-5xl">
          <Outlet />
        </div>
      </main>

      {/* Navigation mobile : barre du bas défilante */}
      <nav className="flex shrink-0 overflow-x-auto border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex min-h-[56px] min-w-[76px] flex-1 flex-col items-center justify-center gap-1 text-[11px] ${
                isActive ? 'font-semibold text-navy-950' : 'text-slate-500'
              }`
            }
          >
            <span className="relative">
              <Icon size={20} />
              {to === '/notifications' && unread > 0 && (
                <span className="absolute -right-2 -top-1 rounded-full bg-loss px-1 text-[9px] font-semibold text-white">{unread}</span>
              )}
            </span>
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
