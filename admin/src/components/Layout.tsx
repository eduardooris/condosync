import { NavLink, Outlet } from 'react-router-dom';
import {
  CircleDot,
  CreditCard,
  LogOut,
  Receipt,
  Webhook,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/auth/auth.context';
import { cn } from '@/lib/cn';

const NAV: Array<{ to: string; label: string; icon: LucideIcon; end?: boolean }> = [
  { to: '/', label: 'Visão geral', icon: CircleDot, end: true },
  { to: '/pagamentos', label: 'Pagamentos', icon: CreditCard },
  { to: '/cobrancas', label: 'Cobranças', icon: Receipt },
  { to: '/webhooks', label: 'Webhooks', icon: Webhook },
];

export function Layout() {
  const auth = useAuth();
  return (
    <div className="flex h-dvh bg-bg text-fg">
      <aside className="flex w-60 flex-col border-r border-border bg-bg-surface">
        <div className="flex h-12 items-center gap-2 px-4 border-b border-border">
          <div className="h-2 w-2 rounded-full bg-accent" />
          <span className="font-semibold tracking-tight">CondoSync</span>
          <span className="ml-auto text-xs uppercase tracking-wider text-fg-subtle">
            admin
          </span>
        </div>
        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 rounded px-2.5 py-1.5 text-sm transition',
                  isActive
                    ? 'bg-bg-elevated text-fg'
                    : 'text-fg-dim hover:bg-bg-elevated/60 hover:text-fg',
                )
              }
            >
              <Icon className="h-4 w-4" strokeWidth={2} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-border p-3 text-xs">
          <div className="text-fg-dim truncate" title={auth.session?.email}>
            {auth.session?.email ?? '—'}
          </div>
          <button
            type="button"
            onClick={() => void auth.signOut()}
            className="mt-2 inline-flex items-center gap-1.5 text-fg-subtle hover:text-fg transition"
          >
            <LogOut className="h-3 w-3" />
            Sair
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
