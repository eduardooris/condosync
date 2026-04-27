import {
  LayoutDashboard,
  Building2,
  Users,
  Receipt,
  Newspaper,
  BarChart2,
  Wallet,
  ClipboardList,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/shared/stores/auth.store';
import { canAccessCondominiumAdminRoutes } from '@/shared/utils/roles';
import { cn } from '@/shared/utils/cn';

interface QuickNavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

const smartphoneAdminLinks: QuickNavItem[] = [
  { to: '/', label: 'Início', icon: LayoutDashboard, end: true },
  { to: '/charges', label: 'Cobranças', icon: Receipt },
  { to: '/expenses', label: 'Despesas', icon: Wallet },
  { to: '/occurrences', label: 'Ocorrências', icon: ClipboardList },
  { to: '/settings', label: 'Conta', icon: Settings },
];

const smartphoneResidentLinks: QuickNavItem[] = [
  { to: '/', label: 'Início', icon: LayoutDashboard, end: true },
  { to: '/charges', label: 'Cobranças', icon: Receipt },
  { to: '/bulletin', label: 'Mural', icon: Newspaper },
  { to: '/expenses', label: 'Despesas', icon: Wallet },
  { to: '/settings', label: 'Conta', icon: Settings },
];

const tabletLinks: QuickNavItem[] = [
  { to: '/', label: 'Início', icon: LayoutDashboard, end: true },
  { to: '/charges', label: 'Cobranças', icon: Receipt },
  { to: '/expenses', label: 'Despesas', icon: Wallet },
  { to: '/bulletin', label: 'Mural', icon: Newspaper },
  { to: '/polls', label: 'Enquetes', icon: BarChart2 },
  { to: '/occurrences', label: 'Ocorrências', icon: ClipboardList },
  { to: '/units', label: 'Unidades', icon: Building2 },
  { to: '/residents', label: 'Moradores', icon: Users },
  { to: '/settings', label: 'Configurações', icon: Settings },
];

export function MobileQuickNav() {
  const role = useAuthStore((state) => state.role);
  const location = useLocation();
  const isAdmin = canAccessCondominiumAdminRoutes(role);
  const phoneLinks = isAdmin ? smartphoneAdminLinks : smartphoneResidentLinks;
  const compactTabletLinks = isAdmin ? tabletLinks : tabletLinks.filter((item) => item.to !== '/units' && item.to !== '/residents');

  const isRouteActive = (to: string, end?: boolean) => {
    if (end) return location.pathname === to;
    return location.pathname === to || location.pathname.startsWith(`${to}/`);
  };

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-ds-stroke-subtle/80 bg-[var(--ds-tabbar-bg)] px-2 pb-[calc(env(safe-area-inset-bottom)+0.45rem)] pt-1.5 backdrop-blur-xl ds-md:hidden"
        aria-label="Navegação principal mobile"
      >
        <ul className="grid grid-cols-5 gap-1">
          {phoneLinks.map(({ to, label, icon: Icon, end }) => {
            const active = isRouteActive(to, end);

            return (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  className={cn(
                    'flex min-h-[3.5rem] flex-col items-center justify-center gap-1 rounded-ds-lg px-1 py-1 text-[10px] font-semibold transition',
                    active
                      ? 'bg-brand-500/18 text-brand-900 dark:text-white'
                      : 'text-ds-subtle hover:bg-ds-surface hover:text-ds-body dark:hover:bg-white/[0.05]',
                  )}
                >
                  <Icon
                    className={cn(
                      'h-4 w-4 shrink-0',
                      active ? 'text-brand-700 dark:text-brand-200' : 'text-ds-subtle',
                    )}
                    strokeWidth={active ? 2.2 : 1.9}
                    aria-hidden
                  />
                  <span className="truncate">{label}</span>
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      <nav
        className="mx-4 mt-2 hidden gap-1.5 overflow-x-auto pb-1 ds-md:flex ds-lg:hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label="Acesso rápido tablet"
      >
        {compactTabletLinks.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex shrink-0 items-center gap-1.5 rounded-ds-md px-3 py-1.5 text-ds-xs font-semibold transition-all',
                isActive
                  ? 'bg-gradient-to-r from-brand-400/20 to-brand-500/12 text-brand-900 dark:text-white'
                  : 'text-ds-dim hover:bg-ds-surface hover:text-ds-body dark:hover:bg-white/[0.04]',
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  className={cn(
                    'h-3 w-3 shrink-0',
                    isActive ? 'text-brand-700 dark:text-brand-300' : 'text-ds-subtle',
                  )}
                  strokeWidth={isActive ? 2.2 : 1.75}
                  aria-hidden
                />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </>
  );
}
