import { motion } from 'framer-motion';
import { Bell, Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { notificationsService } from '@/domains/notifications/services/notifications.service';
import { useAuthStore } from '@/shared/stores/auth.store';
import { queryKeys } from '@/shared/lib/queryKeys';
import { MobileCondominiumSheet } from '@/shared/components/layout/MobileCondominiumSheet';

function userInitial(name?: string | null) {
  if (!name?.trim()) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0]![0] ?? ''}${parts[parts.length - 1]![0] ?? ''}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function firstName(name?: string | null) {
  return name?.trim().split(/\s+/)[0] ?? '';
}

interface HeaderProps {
  onOpenCommandPalette?: () => void;
}

export function Header({ onOpenCommandPalette }: HeaderProps) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const condominium = useAuthStore((s) => s.activeCondominium);
  const { data: unreadData } = useQuery({
    queryKey: [...queryKeys.notifications.unreadCount(), condominium?.id ?? null],
    queryFn: () => notificationsService.unreadCount(condominium?.id ?? null),
    // Polling defensivo de 60s caso o WebSocket caia ou esteja indisponível
    // — quando o socket está vivo, o `invalidateQueries` do hook real-time
    // refresca o badge imediatamente.
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    enabled: Boolean(condominium?.id),
  });
  const unread = unreadData?.unread ?? 0;

  return (
    <motion.header
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
      className="sticky top-0 z-30 mx-3 mt-[max(0.75rem,env(safe-area-inset-top,0px))] flex min-w-0 items-center justify-between gap-2 rounded-ds-lg border border-ds-stroke-subtle bg-ds-elevated/95 px-3 py-2 shadow-ds-md backdrop-blur-xl dark:border-transparent dark:bg-white/[0.05] ds-sm:mx-4 ds-sm:gap-3 ds-sm:px-4 ds-sm:py-2.5 ds-md:px-5"
    >
      <div className="flex min-w-0 flex-1 items-center gap-2 ds-sm:gap-2.5">
        {/* Search trigger */}
        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="group flex min-w-0 flex-1 items-center gap-2 rounded-ds-md bg-[var(--ds-input-well-bg)] px-2.5 py-2 text-left text-ds-sm text-ds-subtle transition hover:bg-[var(--ds-input-well-bg-hover)] ds-sm:gap-2.5 ds-sm:px-3 ds-lg:max-w-md"
          aria-label="Abrir busca rápida"
        >
          <Search className="h-3.5 w-3.5 shrink-0 text-ds-subtle group-hover:text-brand-700 dark:group-hover:text-brand-300" strokeWidth={2} aria-hidden />
          <span className="min-w-0 flex-1 truncate">
            {condominium ? `Buscar em ${condominium.name}…` : 'Buscar…'}
          </span>
          <kbd className="hidden shrink-0 rounded-ds-sm border border-ds-stroke bg-ds-surface px-1.5 py-0.5 text-[11px] font-semibold text-ds-subtle dark:border-transparent dark:bg-white/[0.06] ds-sm:inline">
            ⌘K
          </kbd>
        </button>

        <div className="shrink-0 ds-lg:hidden">
          <MobileCondominiumSheet onOpenCommandPalette={onOpenCommandPalette} />
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          aria-label="Notificações"
          onClick={() => navigate('/notifications')}
          className="relative flex h-10 w-10 items-center justify-center rounded-ds-md bg-ds-surface text-ds-dim transition hover:bg-ds-elevated hover:text-ds-body dark:bg-white/[0.03] dark:hover:bg-white/[0.08] ds-sm:h-11 ds-sm:w-11"
        >
          <Bell className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          {unread > 0 ? (
            <span className="absolute -right-1 -top-1 rounded-ds-pill bg-ds-danger px-1 py-0.5 text-[11px] font-bold leading-none text-ds-on-primary ring-2 ring-ds-deep">
              {unread > 99 ? '99+' : unread}
            </span>
          ) : null}
        </button>

        <div
          className="flex min-w-0 items-center gap-2 rounded-ds-md bg-ds-surface py-1.5 pl-1.5 pr-2 transition hover:bg-ds-elevated dark:bg-white/[0.03] dark:hover:bg-white/[0.08] ds-sm:gap-2.5 ds-sm:pr-3"
          title={user?.name ?? 'Usuário'}
        >
          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-ds-lg bg-gradient-to-br from-brand-300 to-brand-600 text-[11px] font-bold text-ds-on-primary shadow-ds-sm"
            aria-hidden
          >
            {userInitial(user?.name)}
          </div>
          <span className="hidden truncate text-ds-sm font-medium text-ds-body ds-md:block">
            {firstName(user?.name) || 'Visitante'}
          </span>
        </div>
      </div>
    </motion.header>
  );
}
