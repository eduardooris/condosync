import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { RefreshCw } from 'lucide-react';
import { masterService } from '@/services/master.service';
import { StatusBadge } from '@/components/StatusBadge';
import { extractApiError } from '@/lib/http';
import type { WebhookEventDetail } from '@/lib/types';

type StatusFilter = 'all' | 'processed' | 'failed' | 'pending';

export function WebhooksPage() {
  const [status, setStatus] = useState<StatusFilter>('all');
  const [selected, setSelected] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data = [], isLoading, refetch } = useQuery({
    queryKey: ['master', 'webhook-events', { status }],
    queryFn: () =>
      masterService.listWebhookEvents({
        status: status === 'all' ? undefined : status,
        limit: 100,
      }),
  });

  const detailQuery = useQuery({
    queryKey: ['master', 'webhook-event', selected],
    queryFn: () => masterService.getWebhookEvent(selected!),
    enabled: !!selected,
  });

  const reprocessMut = useMutation({
    mutationFn: (id: string) => masterService.reprocessWebhookEvent(id),
    onSuccess: () => {
      toast.success('Evento re-enfileirado.');
      void qc.invalidateQueries({ queryKey: ['master', 'webhook-events'] });
      void qc.invalidateQueries({ queryKey: ['master', 'webhook-event'] });
    },
    onError: (e) => toast.error(extractApiError(e)),
  });

  return (
    <div className="p-6 space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Webhooks</h1>
          <p className="text-sm text-fg-dim mt-1">
            Eventos recebidos do Asaas. Use o filtro <strong>Falhas</strong> pra
            identificar problemas e reprocessar.
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          className="inline-flex h-8 items-center gap-1.5 rounded border border-border bg-bg-elevated px-3 text-xs font-medium text-fg-dim hover:text-fg"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Atualizar
        </button>
      </header>

      <div className="flex gap-2">
        {(['all', 'processed', 'failed', 'pending'] as StatusFilter[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className={
              'h-8 rounded px-3 text-xs font-medium transition ' +
              (status === s
                ? 'bg-accent text-white'
                : 'bg-bg-surface text-fg-dim hover:bg-bg-elevated hover:text-fg border border-border')
            }
          >
            {s === 'all' ? 'Todos' : s === 'processed' ? 'Processados' : s === 'failed' ? 'Falhas' : 'Pendentes'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-[1fr_360px] gap-4">
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="ds-table">
            <thead>
              <tr>
                <th>Recebido</th>
                <th>Evento</th>
                <th>Pagamento</th>
                <th>Status</th>
                <th>Erro</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} className="text-center py-6 text-fg-dim">Carregando…</td></tr>
              ) : data.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-6 text-fg-dim">Nenhum evento.</td></tr>
              ) : (
                data.map((e) => (
                  <tr
                    key={e.id}
                    onClick={() => setSelected(e.id)}
                    className={
                      'cursor-pointer ' +
                      (selected === e.id ? 'bg-bg-elevated' : '')
                    }
                  >
                    <td className="text-xs text-fg-dim whitespace-nowrap">
                      {new Date(e.receivedAt).toLocaleString('pt-BR')}
                    </td>
                    <td className="font-mono text-xs">{e.event}</td>
                    <td className="font-mono text-xs">
                      {e.payloadPreview.id?.slice(0, 16) ?? '—'}
                    </td>
                    <td>
                      <StatusBadge
                        value={e.processedAt ? 'OK' : e.processingError ? 'FAIL' : 'PENDING'}
                        tone={e.processedAt ? 'success' : e.processingError ? 'danger' : 'warning'}
                      />
                    </td>
                    <td className="text-xs text-danger max-w-[280px] truncate">
                      {e.processingError ?? ''}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <aside className="rounded-lg border border-border bg-bg-surface p-4 sticky top-4 h-fit max-h-[80vh] overflow-y-auto">
          {!selected ? (
            <p className="text-sm text-fg-dim">Clique numa linha pra ver o payload.</p>
          ) : detailQuery.isLoading ? (
            <p className="text-sm text-fg-dim">Carregando…</p>
          ) : detailQuery.data ? (
            <WebhookEventDetailPanel
              event={detailQuery.data}
              onReprocess={() => reprocessMut.mutate(detailQuery.data!.id)}
              reprocessing={reprocessMut.isPending}
            />
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function WebhookEventDetailPanel({
  event,
  onReprocess,
  reprocessing,
}: {
  event: WebhookEventDetail;
  onReprocess: () => void;
  reprocessing: boolean;
}) {
  return (
    <div className="space-y-3 text-xs">
      <header>
        <h2 className="text-sm font-semibold">{event.event}</h2>
        <p className="text-fg-subtle mt-0.5">
          {new Date(event.receivedAt).toLocaleString('pt-BR')}
        </p>
      </header>

      {event.processingError ? (
        <div className="rounded border border-danger/30 bg-danger/10 p-2 text-danger">
          <p className="font-semibold">Erro:</p>
          <p className="font-mono break-all">{event.processingError}</p>
        </div>
      ) : event.processedAt ? (
        <div className="rounded border border-success/30 bg-success/10 p-2 text-success">
          Processado em {new Date(event.processedAt).toLocaleString('pt-BR')}
        </div>
      ) : (
        <div className="rounded border border-warning/30 bg-warning/10 p-2 text-warning">
          Aguardando processamento.
        </div>
      )}

      <button
        type="button"
        onClick={onReprocess}
        disabled={reprocessing}
        className="w-full inline-flex items-center justify-center gap-1.5 h-8 rounded bg-accent text-white text-xs font-medium hover:bg-accent-strong disabled:opacity-50"
      >
        {reprocessing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : null}
        Reprocessar
      </button>

      <div>
        <p className="text-fg-subtle mb-1">Payload raw:</p>
        <pre className="rounded bg-bg p-2 font-mono text-[11px] overflow-x-auto max-h-[400px] overflow-y-auto">
          {JSON.stringify(event.payloadRaw, null, 2)}
        </pre>
      </div>
    </div>
  );
}
