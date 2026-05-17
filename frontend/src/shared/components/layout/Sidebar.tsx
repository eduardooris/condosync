import { motion, useReducedMotion } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  Building2,
  Receipt,
  Newspaper,
  FolderOpen,
  ClipboardList,
  BarChart2,
  Settings,
  LogOut,
  Wallet,
  CalendarDays,
  UserRoundPlus,
  PackageCheck,
  DoorOpen,
  type LucideIcon,
} from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/shared/stores/auth.store';
import { useUIStore } from '@/shared/stores/ui.store';
import { canAccessCondominiumAdminRoutes } from '@/shared/utils/roles';
import { cn } from '@/shared/utils/cn';
import { CondoSwitcher } from '@/shared/components/layout/CondoSwitcher';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

export interface NavSection {
  id: string;
  label: string;
  items: NavItem[];
  adminOnly?: boolean;
}

export const SIDEBAR_SECTIONS: NavSection[] = [
  {
    id: 'principal',
    label: 'Principal',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/charges', label: 'Cobranças', icon: Receipt },
      { to: '/expenses', label: 'Despesas', icon: Wallet },
    ],
  },
  {
    id: 'moradores',
    label: 'Moradores',
    adminOnly: true,
    items: [
      { to: '/units', label: 'Unidades & moradores', icon: Building2 },
      { to: '/visitors', label: 'Visitantes', icon: UserRoundPlus },
      { to: '/portaria-admin', label: 'Portaria virtual', icon: DoorOpen },
      { to: '/correspondences', label: 'Correspondências', icon: PackageCheck },
    ],
  },
  {
    id: 'comunicacao',
    label: 'Comunicação',
    items: [
      { to: '/bulletin', label: 'Mural de recados', icon: Newspaper },
      { to: '/occurrences', label: 'Ocorrências', icon: ClipboardList },
    ],
  },
  {
    id: 'servicos',
    label: 'Serviços',
    items: [
      { to: '/reservations', label: 'Reservas', icon: CalendarDays },
      { to: '/polls', label: 'Enquetes', icon: BarChart2 },
    ],
  },
  {
    id: 'documentos',
    label: 'Documentos',
    items: [{ to: '/documents', label: 'Documentos', icon: FolderOpen }],
  },
  {
    id: 'conta',
    label: 'Conta',
    items: [{ to: '/settings', label: 'Configurações', icon: Settings }],
  },
];

const SECTIONS = SIDEBAR_SECTIONS;

interface SidebarProps {
  onOpenCommandPalette?: () => void;
}

export function Sidebar({ onOpenCommandPalette }: SidebarProps) {
  const role = useAuthStore((s) => s.role);
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const showAdmin = canAccessCondominiumAdminRoutes(role);
  const location = useLocation();
  const reduce = useReducedMotion();

  const sections = SECTIONS.filter((section) => !section.adminOnly || showAdmin);

  function userInitials(name?: string | null) {
    if (!name?.trim()) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return `${parts[0]![0] ?? ''}${parts[parts.length - 1]![0] ?? ''}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }

  return (
    <aside
      className={cn(
        'hidden shrink-0 flex-col overflow-hidden ds-lg:flex',
        sidebarOpen ? 'w-64' : 'w-20',
      )}
      aria-label="Navegação principal"
    >
      <div className={cn('pointer-events-none absolute inset-0 overflow-hidden', sidebarOpen ? 'w-64' : 'w-20')}>
        <div className="absolute -left-10 -top-10 h-40 w-40 rounded-full bg-brand-400/20 blur-3xl" />
        <div className="absolute -bottom-10 -left-5 h-32 w-32 rounded-full bg-brand-600/25 blur-2xl" />
      </div>

      <div className="relative flex h-full flex-col bg-gradient-to-b from-brand-900/80 via-brand-900/60 to-ds-deep/90 backdrop-blur-xl">
        {/* Top: brand + condo switcher */}
        <div className="space-y-3 px-3 pb-3 pt-5">
          <div className="flex items-center gap-2.5 px-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-ds-lg bg-gradient-to-br from-brand-300 to-brand-600 shadow-md shadow-brand-500/30">
              <Building2 className="h-4 w-4 text-white" strokeWidth={2} aria-hidden />
            </div>
            {sidebarOpen ? (
              <div>
                <span className="block text-[14px] font-bold tracking-tight text-white">CondoSync</span>
                <span className="block text-[9px] font-medium uppercase tracking-widest text-brand-300/70">
                  Gestão condominial
                </span>
              </div>
            ) : null}
            <button
              type="button"
              onClick={toggleSidebar}
              className="ml-auto rounded-ds-md p-1.5 text-brand-200/70 transition hover:bg-white/10 hover:text-white"
              aria-label={sidebarOpen ? 'Recolher menu lateral' : 'Expandir menu lateral'}
              title={sidebarOpen ? 'Recolher menu' : 'Expandir menu'}
            >
              {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          </div>
          {sidebarOpen ? <CondoSwitcher onOpenCommandPalette={onOpenCommandPalette} /> : null}
        </div>

        <div className="mx-4 mb-2 h-px bg-ds-stroke-subtle/70" />

        {/* Nav grouped */}
        <nav className="flex-1 overflow-y-auto px-3 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {sections.map((section, sectionIdx) => (
            <div key={section.id} className={cn(sectionIdx > 0 && 'mt-4')}>
              {sidebarOpen ? (
                <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-300/55">
                  {section.label}
                </p>
              ) : null}
              <ul className="space-y-0.5">
                {section.items.map(({ to, label, icon: Icon, end }) => {
                  const isActive = end
                    ? location.pathname === to
                    : location.pathname === to || location.pathname.startsWith(`${to}/`);

                  return (
                    <li key={to}>
                      <NavLink
                        to={to}
                        end={end}
                        className={cn(
                          'relative flex items-center gap-3 rounded-ds-xl px-3 py-2 text-ds-sm font-medium transition-all duration-200',
                          isActive ? 'text-white' : 'text-brand-200/60 hover:bg-white/5 hover:text-white',
                        )}
                      >
                        {isActive && !reduce ? (
                          <motion.div
                            layoutId="sidebar-active"
                            className="absolute inset-0 rounded-ds-xl bg-gradient-to-r from-brand-400/30 to-brand-500/15"
                            transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                          />
                        ) : null}
                        {isActive && reduce ? (
                          <div className="absolute inset-0 rounded-ds-xl bg-gradient-to-r from-brand-400/30 to-brand-500/15" />
                        ) : null}
                        <span className="relative flex w-full items-center gap-3">
                          <Icon
                            className={cn('h-4 w-4 shrink-0 transition-colors', isActive ? 'text-brand-300' : 'text-brand-400/50')}
                            strokeWidth={isActive ? 2 : 1.75}
                            aria-hidden
                          />
                          {sidebarOpen ? label : null}
                          <span className="ml-auto flex items-center gap-1.5">
                            {isActive ? <span className="h-1.5 w-1.5 rounded-full bg-brand-300" aria-hidden /> : null}
                          </span>
                        </span>
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* User pill */}
        <div className="p-3">
          <div className="mx-1 mb-2 h-px bg-ds-stroke-subtle/70" />
          <div className={cn('flex items-center rounded-ds-xl px-3 py-2.5', sidebarOpen ? 'gap-3' : 'justify-center')}>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-ds-lg bg-gradient-to-br from-brand-300 to-brand-600 text-[11px] font-bold text-white shadow-ds-sm">
              {userInitials(user?.name)}
            </div>
            {sidebarOpen ? (
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-semibold text-ds-body">{user?.name ?? 'Visitante'}</p>
                <p className="truncate text-[10px] text-brand-300/60">{user?.email ?? ''}</p>
              </div>
            ) : null}
            <button
              type="button"
              onClick={logout}
              title="Sair"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-ds-md text-brand-300/50 transition hover:bg-white/10 hover:text-ds-danger"
              aria-label="Sair da conta"
            >
              <LogOut className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
