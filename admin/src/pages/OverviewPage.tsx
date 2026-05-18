import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Building2, CreditCard, Receipt, Users, Webhook } from 'lucide-react';
import { masterService } from '@/services/master.service';
import { cn } from '@/lib/cn';

export function OverviewPage() {
  const { data: condos = [] } = useQuery({
    queryKey: ['master', 'condominiums'],
    queryFn: () => masterService.listCondominiums({}),
  });
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
  const totalMembers = condos.reduce((sum, c) => sum + c.memberCount, 0);
  const totalUnits = condos.reduce((sum, c) => sum + c.unitCount, 0);

  return (
    <div className="p-6 space-y-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Visão geral</h1>
        <p className="text-sm text-fg-dim mt-1">
          Snapshot do produto. Use os menus à esquerda pra drill-down.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Kpi
          to="/condominios"
          icon={Building2}
          label="Condomínios"
          value={condos.length}
        />
        <Kpi
          to="/usuarios"
          icon={Users}
          label="Usuários (membros)"
          value={totalMembers}
          sub={`${totalUnits} unidades`}
        />
        <Kpi
          to="/pagamentos"
          icon={CreditCard}
          label="Subcontas ativas"
          value={accountsByStatus.ACTIVE ?? 0}
          sub={`${accounts.length} total`}
        />
        <Kpi
          to="/cobrancas"
          icon={Receipt}
          label="Subcontas pendentes"
          value={
            (accountsByStatus.PENDING_DOCS ?? 0) +
            (accountsByStatus.PENDING_REVIEW ?? 0) +
            (accountsByStatus.DRAFT ?? 0)
          }
        />
        <Kpi
          to="/webhooks"
          icon={Webhook}
          label="Webhooks com erro"
          value={webhooksFailed}
          tone={webhooksFailed > 0 ? 'danger' : undefined}
          sub={`últimos ${webhooks.length}`}
        />
      </section>

      {webhooksFailed > 0 ? (
        <div className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          ⚠ Há {webhooksFailed} eventos com erro nos últimos 100.{' '}
          <Link to="/webhooks?status=failed" className="font-semibold underline">
            Investigar
          </Link>
        </div>
      ) : null}

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-fg-subtle">
          Condomínios recentes
        </h2>
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="ds-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th className="text-right">Unidades</th>
                <th className="text-right">Membros</th>
                <th>Conta</th>
                <th>Criado</th>
                <th className="w-[60px]"></th>
              </tr>
            </thead>
            <tbody>
              {condos.slice(0, 5).map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td className="text-right tabular-nums">{c.unitCount}</td>
                  <td className="text-right tabular-nums">{c.memberCount}</td>
                  <td className="text-xs">{c.paymentAccountStatus ?? '—'}</td>
                  <td className="text-xs text-fg-dim">
                    {new Date(c.createdAt).toLocaleDateString('pt-BR')}
                  </td>
                  <td>
                    <Link
                      to={`/condominios/${c.id}`}
                      className="text-accent hover:underline text-sm"
                    >
                      →
                    </Link>
                  </td>
                </tr>
              ))}
              {condos.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-6 text-fg-dim">
                  Nenhum condomínio cadastrado ainda.
                </td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Kpi({
  to,
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  sub?: string;
  tone?: 'danger';
}) {
  return (
    <Link
      to={to}
      className="rounded-lg border border-border bg-bg-surface p-4 transition hover:border-border-strong hover:bg-bg-elevated"
    >
      <div className="flex items-center gap-2 text-fg-subtle">
        <Icon className="h-3.5 w-3.5" />
        <p className="text-xs uppercase tracking-wider">{label}</p>
      </div>
      <p
        className={cn(
          'mt-1 text-2xl font-semibold tabular-nums',
          tone === 'danger' ? 'text-danger' : 'text-fg',
        )}
      >
        {value}
      </p>
      {sub ? <p className="text-xs text-fg-subtle mt-0.5">{sub}</p> : null}
    </Link>
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
