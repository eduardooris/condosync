import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  AlertTriangle,
  Bell,
  BellOff,
  CheckCheck,
  ChevronRight,
  ClipboardList,
  FileText,
  Megaphone,
  Receipt,
  UserPlus,
  Vote,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { PageHeader } from '@/shared/components/ui/PageHeader';
import { Spinner } from '@/shared/components/ui/Spinner';
import { EmptyState } from '@/shared/components/ui/EmptyState';
import { Button } from '@/shared/components/ui/Button';
import { useNotificationsPage } from '@/domains/notifications/hooks/useNotificationsPage';
import {
  type AppNotification,
  type NotificationType,
} from '@/domains/notifications/services/notifications.service';
import { cn } from '@/shared/utils/cn';

const TYPE_STYLE: Record<
  NotificationType,
  { icon: LucideIcon; tone: string; label: string }
> = {
  CHARGE_CREATED: {
    icon: Receipt,
    tone: 'bg-brand-500/15 text-brand-700 ring-brand-500/30 dark:text-brand-300',
    label: 'Cobrança',
  },
  CHARGE_OVERDUE: {
    icon: AlertTriangle,
    tone: 'bg-rose-500/15 text-rose-700 ring-rose-500/30 dark:text-rose-300',
    label: 'Em atraso',
  },
  CHARGE_PAID: {
    icon: CheckCheck,
    tone: 'bg-emerald-500/15 text-emerald-700 ring-emerald-500/30 dark:text-emerald-300',
    label: 'Pago',
  },
  POLL_CREATED: {
    icon: Vote,
    tone: 'bg-violet-500/15 text-violet-700 ring-violet-500/30 dark:text-violet-300',
    label: 'Enquete',
  },
  POLL_CLOSED: {
    icon: Vote,
    tone: 'bg-violet-500/15 text-violet-700 ring-violet-500/30 dark:text-violet-300',
    label: 'Enquete',
  },
  OCCURRENCE_STATUS: {
    icon: ClipboardList,
    tone: 'bg-amber-500/15 text-amber-700 ring-amber-500/30 dark:text-amber-300',
    label: 'Ocorrência',
  },
  BULLETIN_NEW: {
    icon: Megaphone,
    tone: 'bg-sky-500/15 text-sky-700 ring-sky-500/30 dark:text-sky-300',
    label: 'Mural',
  },
  DOCUMENT_NEW: {
    icon: FileText,
    tone: 'bg-indigo-500/15 text-indigo-700 ring-indigo-500/30 dark:text-indigo-300',
    label: 'Documento',
  },
  BALANCE_NEGATIVE: {
    icon: Wallet,
    tone: 'bg-rose-500/15 text-rose-700 ring-rose-500/30 dark:text-rose-300',
    label: 'Saldo',
  },
  MEMBER_PENDING_APPROVAL: {
    icon: UserPlus,
    tone: 'bg-amber-500/15 text-amber-700 ring-amber-500/30 dark:text-amber-300',
    label: 'Aprovação',
  },
};

type Bucket = { label: string; items: AppNotification[] };

/**
 * Agrupa em "Hoje / Ontem / Esta semana / Mais antigas" — âncora temporal
 * útil quando o usuário tem várias páginas de histórico.
 */
function groupByDate(items: AppNotification[]): Bucket[] {
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - 6);

  const today: AppNotification[] = [];
  const yesterday: AppNotification[] = [];
  const thisWeek: AppNotification[] = [];
  const older: AppNotification[] = [];

  for (const n of items) {
    const t = new Date(n.createdAt).getTime();
    if (t >= startOfToday.getTime()) today.push(n);
    else if (t >= startOfYesterday.getTime()) yesterday.push(n);
    else if (t >= startOfWeek.getTime()) thisWeek.push(n);
    else older.push(n);
  }

  return [
    today.length > 0 && { label: 'Hoje', items: today },
    yesterday.length > 0 && { label: 'Ontem', items: yesterday },
    thisWeek.length > 0 && { label: 'Esta semana', items: thisWeek },
    older.length > 0 && { label: 'Mais antigas', items: older },
  ].filter(Boolean) as Bucket[];
}

function formatRelativeTime(iso: string): string {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'agora há pouco';
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `há ${diffH} h`;
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(d);
}

export function NotificationsPage() {
  const navigate = useNavigate();
  const [onlyUnread, setOnlyUnread] = useState(false);
  const {
    notificationsQuery,
    markReadMutation,
    markAllReadMutation,
  } = useNotificationsPage(onlyUnread);

  const items = useMemo(
    () => notificationsQuery.data?.pages.flatMap((p) => p.items) ?? [],
    [notificationsQuery.data],
  );
  const buckets = useMemo(() => groupByDate(items), [items]);
  const unreadCount = items.filter((n) => !n.readAt).length;

  const handleOpen = (n: AppNotification) => {
    if (!n.readAt) {
      markReadMutation.mutate(n.id);
    }
    if (n.deeplink) {
      navigate(n.deeplink);
    }
  };

  if (notificationsQuery.isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="ds-page mx-auto max-w-3xl space-y-5">
      <PageHeader
        title="Notificações"
        description="Cobranças, mural, enquetes e demais eventos do condomínio em ordem cronológica."
        actions={
          <>
            <Button
              variant={onlyUnread ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setOnlyUnread((v) => !v)}
              aria-pressed={onlyUnread}
            >
              {onlyUnread ? (
                <Bell className="h-3.5 w-3.5" />
              ) : (
                <BellOff className="h-3.5 w-3.5" />
              )}
              {onlyUnread ? 'Mostrando não lidas' : 'Só não lidas'}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={markAllReadMutation.isPending || unreadCount === 0}
              onClick={() =>
                markAllReadMutation.mutate(undefined, {
                  onSuccess: (res) =>
                    toast.success(
                      res.updated === 0
                        ? 'Nada para marcar — já estava tudo lido.'
                        : `${res.updated} notificação(ões) marcada(s) como lida(s).`,
                    ),
                  onError: () =>
                    toast.error('Não foi possível marcar como lidas.'),
                })
              }
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Marcar todas como lidas
            </Button>
          </>
        }
      />

      {items.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="Nenhuma notificação"
          description={
            onlyUnread
              ? 'Você não possui notificações pendentes neste condomínio.'
              : 'Quando houver cobranças, comunicados, enquetes ou outros eventos, eles aparecem aqui.'
          }
        />
      ) : (
        <div className="space-y-6">
          {buckets.map((bucket) => (
            <section key={bucket.label} className="space-y-2">
              <h2 className="px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-ds-subtle">
                {bucket.label}
              </h2>
              <ul className="space-y-2">
                {bucket.items.map((n) => (
                  <NotificationRow
                    key={n.id}
                    n={n}
                    onOpen={() => handleOpen(n)}
                    onMarkRead={() => markReadMutation.mutate(n.id)}
                    markPending={markReadMutation.isPending}
                  />
                ))}
              </ul>
            </section>
          ))}

          {notificationsQuery.hasNextPage ? (
            <div className="flex justify-center pt-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={notificationsQuery.isFetchingNextPage}
                onClick={() => notificationsQuery.fetchNextPage()}
              >
                {notificationsQuery.isFetchingNextPage
                  ? 'Carregando…'
                  : 'Carregar mais antigas'}
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function NotificationRow({
  n,
  onOpen,
  onMarkRead,
  markPending,
}: {
  n: AppNotification;
  onOpen: () => void;
  onMarkRead: () => void;
  markPending: boolean;
}) {
  const style =
    TYPE_STYLE[n.type] ?? {
      icon: Bell,
      tone: 'bg-ds-surface text-ds-body ring-ds-stroke/40',
      label: 'Aviso',
    };
  const Icon = style.icon;
  const clickable = Boolean(n.deeplink);

  const content = (
    <div
      className={cn(
        'group flex items-start gap-3 rounded-ds-2xl border p-4 transition',
        n.readAt
          ? 'border-ds-stroke/30 bg-ds-surface/30 hover:bg-ds-surface/60'
          : 'border-brand-500/30 bg-brand-500/[0.06] hover:bg-brand-500/[0.10]',
      )}
    >
      <span
        className={cn(
          'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-ds-lg ring-1',
          style.tone,
        )}
        aria-hidden
      >
        <Icon className="h-4 w-4" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="inline-flex rounded-ds-pill bg-ds-surface px-1.5 py-0.5 text-[11px] font-semibold text-ds-dim">
            {style.label}
          </span>
          <p className="truncate text-ds-sm font-semibold text-ds-body">
            {n.title}
          </p>
          {!n.readAt ? (
            <span
              className="ml-auto inline-block h-2 w-2 shrink-0 rounded-full bg-brand-500"
              aria-label="Não lida"
            />
          ) : null}
        </div>
        <p className="mt-1 line-clamp-3 text-ds-sm text-ds-dim">{n.body}</p>
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-[11px] text-ds-subtle">
            {formatRelativeTime(n.createdAt)}
          </span>
          {!n.readAt ? (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onMarkRead();
              }}
              disabled={markPending}
              className="rounded-ds-md px-2 py-1 text-[11px] font-semibold text-ds-action transition hover:bg-ds-action/10 disabled:opacity-50"
            >
              Marcar como lida
            </button>
          ) : null}
        </div>
      </div>

      {clickable ? (
        <ChevronRight
          className="mt-1 h-4 w-4 shrink-0 text-ds-subtle transition group-hover:translate-x-0.5 group-hover:text-ds-body"
          aria-hidden
        />
      ) : null}
    </div>
  );

  if (!clickable) {
    return <li>{content}</li>;
  }
  return (
    <li>
      <Link
        to={n.deeplink ?? '#'}
        onClick={onOpen}
        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-focus"
      >
        {content}
      </Link>
    </li>
  );
}
