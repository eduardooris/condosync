import { useState } from 'react';
import {
  LayoutDashboard,
  Receipt,
  Wallet,
  ClipboardList,
  MoreHorizontal,
  type LucideIcon,
} from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/shared/stores/auth.store';
import { canAccessCondominiumAdminRoutes } from '@/shared/utils/roles';
import { cn } from '@/shared/utils/cn';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/shared/components/ui/Dialog';
import { SIDEBAR_SECTIONS } from '@/shared/components/layout/Sidebar';

interface QuickNavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

const PHONE_PRIMARY_ADMIN: QuickNavItem[] = [
  { to: '/', label: 'Início', icon: LayoutDashboard, end: true },
  { to: '/charges', label: 'Cobranças', icon: Receipt },
  { to: '/expenses', label: 'Despesas', icon: Wallet },
  { to: '/occurrences', label: 'Ocorrências', icon: ClipboardList },
];

const PHONE_PRIMARY_RESIDENT: QuickNavItem[] = [
  { to: '/', label: 'Início', icon: LayoutDashboard, end: true },
  { to: '/charges', label: 'Cobranças', icon: Receipt },
  { to: '/expenses', label: 'Despesas', icon: Wallet },
  { to: '/bulletin', label: 'Mural', icon: ClipboardList },
];

export function MobileQuickNav() {
  const role = useAuthStore((state) => state.role);
  const location = useLocation();
  const isAdmin = canAccessCondominiumAdminRoutes(role);
  const phonePrimary = isAdmin ? PHONE_PRIMARY_ADMIN : PHONE_PRIMARY_RESIDENT;
  const [moreOpen, setMoreOpen] = useState(false);

  const isRouteActive = (to: string, end?: boolean) => {
    if (end) return location.pathname === to;
    return location.pathname === to || location.pathname.startsWith(`${to}/`);
  };

  const sections = SIDEBAR_SECTIONS.filter(
    (section) => !section.adminOnly || isAdmin,
  );

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-ds-stroke-subtle/80 bg-[var(--ds-tabbar-bg)] px-2 pb-[calc(env(safe-area-inset-bottom)+0.45rem)] pt-1.5 backdrop-blur-xl ds-md:hidden"
        aria-label="Navegação principal mobile"
      >
        <ul className="grid grid-cols-5 gap-1">
          {phonePrimary.map(({ to, label, icon: Icon, end }) => {
            const active = isRouteActive(to, end);
            return (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  className={cn(
                    'flex min-h-[3.5rem] flex-col items-center justify-center gap-1 rounded-ds-lg px-1 py-1 text-[11px] font-semibold transition',
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
          <li>
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              className="flex min-h-[3.5rem] w-full flex-col items-center justify-center gap-1 rounded-ds-lg px-1 py-1 text-[11px] font-semibold text-ds-subtle transition hover:bg-ds-surface hover:text-ds-body dark:hover:bg-white/[0.05]"
              aria-label="Abrir menu completo"
            >
              <MoreHorizontal className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
              <span>Mais</span>
            </button>
          </li>
        </ul>
      </nav>

      <Dialog open={moreOpen} onOpenChange={setMoreOpen}>
        <DialogContent
          className="max-w-md"
          aria-describedby={undefined}
        >
          <DialogHeader>
            <DialogTitle>Menu completo</DialogTitle>
            <DialogDescription>Acesso a todos os módulos do CondoSync.</DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            {sections.map((section) => (
              <div key={section.id} className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ds-subtle">
                  {section.label}
                </p>
                <ul className="grid grid-cols-2 gap-2">
                  {section.items.map(({ to, label, icon: Icon, end }) => {
                    const active = isRouteActive(to, end);
                    return (
                      <li key={to}>
                        <DialogClose asChild>
                          <NavLink
                            to={to}
                            end={end}
                            onClick={() => setMoreOpen(false)}
                            className={cn(
                              'flex items-center gap-2.5 rounded-ds-lg border border-ds-stroke bg-ds-surface px-3 py-2.5 text-ds-sm font-medium transition',
                              'dark:bg-white/[0.02] dark:border-transparent',
                              active
                                ? 'bg-brand-500/15 text-brand-900 ring-1 ring-brand-500/30 dark:text-white'
                                : 'text-ds-body hover:bg-ds-elevated dark:hover:bg-white/[0.06]',
                            )}
                          >
                            <Icon
                              className={cn(
                                'h-4 w-4 shrink-0',
                                active ? 'text-brand-700 dark:text-brand-300' : 'text-ds-subtle',
                              )}
                              strokeWidth={1.8}
                              aria-hidden
                            />
                            <span className="truncate">{label}</span>
                          </NavLink>
                        </DialogClose>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Tablet: barra horizontal sincronizada com a sidebar */}
      <nav
        className="mx-4 mt-2 hidden gap-1.5 overflow-x-auto pb-1 ds-md:flex ds-lg:hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label="Acesso rápido tablet"
      >
        {sections
          .flatMap((section) => section.items)
          .map(({ to, label, icon: Icon, end }) => (
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
