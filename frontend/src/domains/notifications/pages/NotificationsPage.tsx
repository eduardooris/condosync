import { useState } from 'react';
import toast from 'react-hot-toast';
import { Bell, BellOff, CheckCheck, CheckCircle2 } from 'lucide-react';
import { PageHeader } from '@/shared/components/ui/PageHeader';
import { Spinner } from '@/shared/components/ui/Spinner';
import { EmptyState } from '@/shared/components/ui/EmptyState';
import { GlassCard } from '@/shared/components/ui/GlassCard';
import { Button } from '@/shared/components/ui/Button';
import { useNotificationsPage } from '@/domains/notifications/hooks/useNotificationsPage';
import { cn } from '@/shared/utils/cn';

export function NotificationsPage() {
  const [onlyUnread, setOnlyUnread] = useState(false);
  const { notificationsQuery, markReadMutation, markAllReadMutation } = useNotificationsPage(onlyUnread);
  const list = notificationsQuery.data ?? [];
  const unreadCount = list.filter((n) => !n.readAt).length;

  if (notificationsQuery.isLoading) return <Spinner />;

  return (
    <div className="ds-page mx-auto max-w-4xl space-y-5">
      <PageHeader
        title="Notificações"
        description="Acompanhe cobranças, enquetes, documentos e eventos operacionais do condomínio em um só lugar."
        actions={
          <>
            <Button
              variant={onlyUnread ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setOnlyUnread((v) => !v)}
            >
              {onlyUnread ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
              {onlyUnread ? 'Mostrando não lidas' : 'Mostrar só não lidas'}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                markAllReadMutation.mutate(undefined, {
                  onSuccess: (res) => toast.success(`${res.updated} notificação(ões) marcada(s) como lida(s).`),
                  onError: () => toast.error('Não foi possível marcar todas como lidas.'),
                })
              }
              disabled={markAllReadMutation.isPending || unreadCount === 0}
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Marcar todas como lidas
            </Button>
          </>
        }
      />

      {list.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="Nenhuma notificação"
          description={
            onlyUnread
              ? 'Você não possui notificações pendentes no momento.'
              : 'Quando houver eventos importantes, eles aparecerão aqui.'
          }
        />
      ) : (
        <div className="space-y-3">
          {list.map((n) => (
            <GlassCard
              key={n.id}
              className={cn(
                'space-y-2 border',
                n.readAt
                  ? 'border-ds-stroke/30'
                  : 'border-brand-500/30 bg-brand-500/5',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-ds-sm font-semibold text-ds-body">{n.title}</p>
                  <p className="mt-1 text-ds-xs text-ds-dim">{n.body}</p>
                </div>
                {!n.readAt ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={markReadMutation.isPending}
                    onClick={() =>
                      markReadMutation.mutate(n.id, {
                        onError: () => toast.error('Não foi possível marcar como lida.'),
                      })
                    }
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Marcar lida
                  </Button>
                ) : (
                  <span className="rounded-ds-md bg-ds-success/15 px-2 py-1 text-[11px] font-semibold text-ds-success">
                    Lida
                  </span>
                )}
              </div>
              <p className="text-[11px] text-ds-subtle">
                {new Intl.DateTimeFormat('pt-BR', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                }).format(new Date(n.createdAt))}
              </p>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
