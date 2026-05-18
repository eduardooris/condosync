import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ArrowLeft, RefreshCw, Webhook, Zap, ExternalLink } from 'lucide-react';
import { masterService } from '@/services/master.service';
import { StatusBadge } from '@/components/StatusBadge';
import { extractApiError } from '@/lib/http';

export function PaymentAccountDetailPage() {
  const { accountId } = useParams<{ accountId: string }>();
  const qc = useQueryClient();
  const [confirmingPix, setConfirmingPix] = useState<string | null>(null);

  const accountQuery = useQuery({
    queryKey: ['master', 'payment-account', accountId],
    queryFn: () => masterService.getPaymentAccount(accountId!),
    enabled: !!accountId,
  });

  const condoId = accountQuery.data?.condominiumId;

  const chargesQuery = useQuery({
    queryKey: ['master', 'charges', { condominiumId: condoId }],
    queryFn: () => masterService.listCharges({ condominiumId: condoId!, limit: 30 }),
    enabled: !!condoId,
  });

  const webhooksAsaasQuery = useQuery({
    queryKey: ['master', 'asaas-webhooks', condoId],
    queryFn: () => masterService.listAsaasWebhooks(condoId!),
    enabled: !!condoId,
  });

  const refreshWebhookMut = useMutation({
    mutationFn: () => masterService.refreshWebhook(condoId!),
    onSuccess: (r) => {
      toast.success(`Webhook recriado: ${r.webhookId.slice(0, 8)}…`);
      void qc.invalidateQueries({ queryKey: ['master', 'asaas-webhooks', condoId] });
    },
    onError: (e) => toast.error(extractApiError(e)),
  });

  const forceActiveMut = useMutation({
    mutationFn: () => masterService.forceActive(condoId!),
    onSuccess: (r) => {
      toast.success(`Status forçado: ${r.status}`);
      void qc.invalidateQueries({ queryKey: ['master', 'payment-account', accountId] });
      void qc.invalidateQueries({ queryKey: ['master', 'payment-accounts'] });
    },
    onError: (e) => toast.error(extractApiError(e)),
  });

  const simulatePixMut = useMutation({
    mutationFn: (chargeId: string) => masterService.simulatePix(condoId!, chargeId),
    onSuccess: () => {
      toast.success('Simulação Pix enviada. Aguarde webhook.');
      void qc.invalidateQueries({ queryKey: ['master', 'charges'] });
    },
    onError: (e) => toast.error(extractApiError(e)),
    onSettled: () => setConfirmingPix(null),
  });

  if (accountQuery.isLoading) {
    return <div className="p-6 text-fg-dim">Carregando…</div>;
  }
  if (!accountQuery.data) {
    return <div className="p-6 text-fg-dim">Subconta não encontrada.</div>;
  }
  const a = accountQuery.data;

  return (
    <div className="p-6 space-y-5">
      <Link to="/pagamentos" className="inline-flex items-center gap-1 text-sm text-fg-dim hover:text-fg">
        <ArrowLeft className="h-3.5 w-3.5" />
        Voltar
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {a.condominiumName ?? '—'}
          </h1>
          <p className="text-sm text-fg-dim mt-1">
            {a.holderLegalName} · {a.holderEmail} · {a.holderType}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <StatusBadge value={a.status} />
            <span className="text-xs text-fg-subtle font-mono">{a.asaasAccountId}</span>
          </div>
        </div>
        {a.rejectReason ? (
          <div className="max-w-sm rounded border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
            <strong>Recusada:</strong> {a.rejectReason}
          </div>
        ) : null}
      </header>

      <section className="grid grid-cols-3 gap-3">
        <Stat label="Cobranças total" value={a.metrics.totalCharges} />
        <Stat label="Pagas" value={a.metrics.paidCharges} tone="success" />
        <Stat label="Pendentes" value={a.metrics.pendingCharges} tone="warning" />
      </section>

      <section className="rounded-lg border border-border bg-bg-surface p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-fg-subtle">
          Ações da subconta
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <ActionButton
            onClick={() => refreshWebhookMut.mutate()}
            loading={refreshWebhookMut.isPending}
            icon={<Webhook className="h-3.5 w-3.5" />}
          >
            Re-registrar webhook
          </ActionButton>
          {a.status !== 'ACTIVE' ? (
            <ActionButton
              onClick={() => forceActiveMut.mutate()}
              loading={forceActiveMut.isPending}
              icon={<Zap className="h-3.5 w-3.5" />}
              tone="warning"
            >
              Forçar ACTIVE (sandbox)
            </ActionButton>
          ) : null}
          {a.onboardingUrl ? (
            <a
              href={a.onboardingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded border border-border bg-bg-elevated px-3 text-xs font-medium text-fg-dim transition hover:text-fg hover:border-border-strong"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Abrir onboarding
            </a>
          ) : null}
        </div>

        {webhooksAsaasQuery.data ? (
          <div className="mt-4 rounded border border-border bg-bg p-3 text-xs">
            <p className="text-fg-subtle mb-1">URL esperada:</p>
            <p className="font-mono break-all">{webhooksAsaasQuery.data.expectedUrl}</p>
            <p className="mt-2 text-fg-subtle">
              {webhooksAsaasQuery.data.count} webhook(s) registrado(s) na Asaas
            </p>
            {webhooksAsaasQuery.data.webhooks.map((w) => (
              <div key={w.id} className="mt-2 rounded bg-bg-elevated p-2">
                <div className="flex items-center gap-2">
                  <StatusBadge
                    value={w.enabled && !w.interrupted ? 'OK' : 'BROKEN'}
                    tone={w.enabled && !w.interrupted ? 'success' : 'danger'}
                  />
                  <span className="font-mono break-all">{w.url}</span>
                </div>
                <p className="text-fg-subtle mt-1">{w.events.length} eventos</p>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-fg-subtle">
          Últimas cobranças
        </h2>
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="ds-table">
            <thead>
              <tr>
                <th>Competência</th>
                <th>Unidade</th>
                <th>Valor</th>
                <th>Status</th>
                <th>Asaas ID</th>
                <th>Último evento</th>
                <th className="w-[120px]">Ações</th>
              </tr>
            </thead>
            <tbody>
              {chargesQuery.isLoading ? (
                <tr><td colSpan={7} className="text-center py-6 text-fg-dim">Carregando…</td></tr>
              ) : (chargesQuery.data ?? []).length === 0 ? (
                <tr><td colSpan={7} className="text-center py-6 text-fg-dim">Nenhuma cobrança.</td></tr>
              ) : (
                (chargesQuery.data ?? []).map((c) => (
                  <tr key={c.id}>
                    <td>{c.billingMonth}</td>
                    <td>{c.unitLabel ?? '—'}</td>
                    <td className="tabular-nums">R$ {c.amount}</td>
                    <td><StatusBadge value={c.status} /></td>
                    <td className="font-mono text-xs">{c.asaasPaymentId?.slice(0, 18) ?? '—'}</td>
                    <td className="text-xs text-fg-dim">{c.asaasLastEvent ?? '—'}</td>
                    <td>
                      {c.status === 'PENDING' || c.status === 'OVERDUE' ? (
                        <button
                          type="button"
                          onClick={() => {
                            setConfirmingPix(c.id);
                            simulatePixMut.mutate(c.id);
                          }}
                          disabled={confirmingPix === c.id && simulatePixMut.isPending}
                          className="inline-flex h-7 items-center gap-1 rounded bg-accent/15 px-2 text-xs font-medium text-accent hover:bg-accent/25 disabled:opacity-50"
                        >
                          {confirmingPix === c.id && simulatePixMut.isPending
                            ? 'Aguarde…'
                            : 'Simular Pix'}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: 'success' | 'warning';
}) {
  return (
    <div className="rounded-lg border border-border bg-bg-surface p-3">
      <p className="text-xs uppercase tracking-wider text-fg-subtle">{label}</p>
      <p
        className={
          'mt-0.5 text-xl font-semibold tabular-nums ' +
          (tone === 'success' ? 'text-success' : tone === 'warning' ? 'text-warning' : 'text-fg')
        }
      >
        {value}
      </p>
    </div>
  );
}

function ActionButton({
  onClick,
  loading,
  icon,
  tone,
  children,
}: {
  onClick: () => void;
  loading: boolean;
  icon: React.ReactNode;
  tone?: 'warning';
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={
        'inline-flex h-8 items-center gap-1.5 rounded border px-3 text-xs font-medium transition disabled:opacity-50 ' +
        (tone === 'warning'
          ? 'border-warning/30 bg-warning/10 text-warning hover:bg-warning/20'
          : 'border-border bg-bg-elevated text-fg-dim hover:text-fg hover:border-border-strong')
      }
    >
      {loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : icon}
      {children}
    </button>
  );
}
