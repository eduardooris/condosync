import { useQuery } from '@tanstack/react-query';
import { masterService } from '@/services/master.service';

export function OverviewPage() {
  const { data: accounts = [] } = useQuery({
    queryKey: ['master', 'payment-accounts'],
    queryFn: masterService.listPaymentAccounts,
  });
  const { data: webhooks = [] } = useQuery({
    queryKey: ['master', 'webhook-events', { limit: 100 }],
    queryFn: () => masterService.listWebhookEvents({ limit: 100 }),
  });

  const accountsByStatus = countBy(accounts, (a) => a.status);
  const webhooksFailed = webhooks.filter((w) => w.processingError).length;
  const webhooksProcessed = webhooks.filter((w) => w.processedAt).length;

  return (
    <div className="p-6 space-y-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Visão geral</h1>
        <p className="text-sm text-fg-dim mt-1">
          Status rápido do produto. Pra detalhe, use os menus à esquerda.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-3 ds-md:grid-cols-4 md:grid-cols-4">
        <KpiCard label="Subcontas ativas" value={accountsByStatus.ACTIVE ?? 0} />
        <KpiCard
          label="Subcontas pendentes"
          value={
            (accountsByStatus.PENDING_DOCS ?? 0) +
            (accountsByStatus.PENDING_REVIEW ?? 0) +
            (accountsByStatus.DRAFT ?? 0)
          }
        />
        <KpiCard
          label="Webhooks 100 últimos"
          value={`${webhooksProcessed}/${webhooks.length} OK`}
        />
        <KpiCard label="Webhooks com erro" value={webhooksFailed} tone={webhooksFailed > 0 ? 'danger' : undefined} />
      </section>

      {webhooksFailed > 0 ? (
        <p className="text-sm text-warning">
          Há {webhooksFailed} eventos de webhook com erro. Abra a aba <strong>Webhooks</strong> e reprocesse.
        </p>
      ) : null}
    </div>
  );
}

function KpiCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: 'danger';
}) {
  return (
    <div className="rounded-lg border border-border bg-bg-surface p-4">
      <p className="text-xs uppercase tracking-wider text-fg-subtle">{label}</p>
      <p
        className={
          'mt-1 text-2xl font-semibold tabular-nums ' +
          (tone === 'danger' ? 'text-danger' : 'text-fg')
        }
      >
        {value}
      </p>
    </div>
  );
}

function countBy<T, K extends string>(arr: T[], key: (item: T) => K): Record<K, number> {
  return arr.reduce<Record<K, number>>(
    (acc, item) => {
      const k = key(item);
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    },
    {} as Record<K, number>,
  );
}
