import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Building2, CreditCard, Users } from 'lucide-react';
import { masterService } from '@/services/master.service';
import { StatusBadge } from '@/components/StatusBadge';
import { cn } from '@/lib/cn';
import type { CondominiumDetail } from '@/lib/types';

type Tab = 'overview' | 'charges' | 'payment' | 'members';

export function CondominiumDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>('overview');

  const condoQuery = useQuery({
    queryKey: ['master', 'condominium', id],
    queryFn: () => masterService.getCondominium(id!),
    enabled: !!id,
  });

  const chargesQuery = useQuery({
    queryKey: ['master', 'charges', { condominiumId: id }],
    queryFn: () =>
      masterService.listCharges({ condominiumId: id!, limit: 50 }),
    enabled: !!id && tab === 'charges',
  });

  if (condoQuery.isLoading) return <div className="p-6 text-fg-dim">Carregando…</div>;
  if (!condoQuery.data) return <div className="p-6 text-fg-dim">Condomínio não encontrado.</div>;
  const c = condoQuery.data;

  return (
    <div className="p-6 space-y-5">
      <Link
        to="/condominios"
        className="inline-flex items-center gap-1 text-sm text-fg-dim hover:text-fg"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Voltar
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-md bg-bg-elevated flex items-center justify-center">
            <Building2 className="h-5 w-5 text-fg-dim" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{c.name}</h1>
            <p className="text-xs text-fg-subtle font-mono mt-0.5">{c.id}</p>
            {c.cnpj ? (
              <p className="text-xs text-fg-dim mt-0.5">CNPJ/CPF: {c.cnpj}</p>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {c.archivedAt ? <StatusBadge value="ARQUIVADO" tone="warning" /> : null}
          {c.paymentAccount ? (
            <Link
              to={`/pagamentos/${c.paymentAccount.id}`}
              className="inline-flex h-8 items-center gap-1.5 rounded border border-border bg-bg-elevated px-3 text-xs font-medium text-fg-dim hover:text-fg"
            >
              <CreditCard className="h-3.5 w-3.5" />
              Conta digital
            </Link>
          ) : null}
        </div>
      </header>

      {/* KPIs */}
      <section className="grid grid-cols-2 gap-3 ds-md:grid-cols-4 md:grid-cols-4">
        <Kpi label="Unidades" value={c.metrics.totalUnits} sub={`${c.metrics.occupiedUnits} ocupadas`} />
        <Kpi label="Membros" value={c.members.length} sub={`${countAdmins(c.members)} admin(s)`} />
        <Kpi label="Cobranças total" value={c.metrics.chargesTotal} sub={`${c.metrics.chargesPaid} pagas`} />
        <Kpi
          label="Atrasadas"
          value={c.metrics.chargesOverdue}
          tone={c.metrics.chargesOverdue > 0 ? 'danger' : undefined}
        />
      </section>

      {/* Tabs */}
      <nav className="flex gap-1 border-b border-border">
        {(
          [
            ['overview', 'Visão geral'],
            ['payment', 'Pagamento'],
            ['charges', 'Cobranças'],
            ['members', `Membros (${c.members.length})`],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={cn(
              'h-9 px-3 text-sm font-medium border-b-2 -mb-px transition',
              tab === k
                ? 'border-accent text-fg'
                : 'border-transparent text-fg-dim hover:text-fg',
            )}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === 'overview' ? (
        <section className="space-y-3">
          <DescList
            items={[
              ['Taxa mensal', `R$ ${c.monthlyFeeAmount}`],
              ['Geração de boletos', c.billingGenerationDay ? `Dia ${c.billingGenerationDay}` : '—'],
              ['Vencimento', c.billingDueDay ? `Dia ${c.billingDueDay}` : '—'],
              ['Pix manual', c.pixKeyType ?? '—'],
              ['WhatsApp admin', c.adminContactPhone ?? '—'],
              ['Criado em', new Date(c.createdAt).toLocaleString('pt-BR')],
            ]}
          />
        </section>
      ) : null}

      {tab === 'payment' ? (
        <section>
          {c.paymentAccount ? (
            <div className="rounded-lg border border-border bg-bg-surface p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="font-medium">{c.paymentAccount.holderLegalName}</p>
                <StatusBadge value={c.paymentAccount.status} />
              </div>
              <p className="text-xs text-fg-dim">
                {c.paymentAccount.holderType} ·{' '}
                <span className="font-mono">{c.paymentAccount.asaasAccountId}</span>
              </p>
              <Link
                to={`/pagamentos/${c.paymentAccount.id}`}
                className="inline-block text-sm text-accent hover:underline"
              >
                Abrir detalhe + ações de debug →
              </Link>
            </div>
          ) : (
            <p className="text-sm text-fg-dim">
              Este condomínio ainda não configurou a conta digital de recebimento.
            </p>
          )}
        </section>
      ) : null}

      {tab === 'charges' ? (
        <section className="rounded-lg border border-border overflow-hidden">
          <table className="ds-table">
            <thead>
              <tr>
                <th>Competência</th>
                <th>Unidade</th>
                <th>Valor</th>
                <th>Status</th>
                <th>Pago em</th>
                <th>Asaas ID</th>
              </tr>
            </thead>
            <tbody>
              {chargesQuery.isLoading ? (
                <tr><td colSpan={6} className="text-center py-6 text-fg-dim">Carregando…</td></tr>
              ) : (chargesQuery.data ?? []).length === 0 ? (
                <tr><td colSpan={6} className="text-center py-6 text-fg-dim">Nenhuma cobrança.</td></tr>
              ) : (
                (chargesQuery.data ?? []).map((ch) => (
                  <tr key={ch.id}>
                    <td>{ch.billingMonth}</td>
                    <td>{ch.unitLabel ?? '—'}</td>
                    <td className="tabular-nums">R$ {ch.amount}</td>
                    <td><StatusBadge value={ch.status} /></td>
                    <td className="text-xs text-fg-dim">
                      {ch.paidAt ? new Date(ch.paidAt).toLocaleString('pt-BR') : '—'}
                    </td>
                    <td className="font-mono text-xs">{ch.asaasPaymentId?.slice(0, 16) ?? '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      ) : null}

      {tab === 'members' ? (
        <section className="rounded-lg border border-border overflow-hidden">
          <table className="ds-table">
            <thead>
              <tr>
                <th>Usuário</th>
                <th>Role</th>
                <th>Status</th>
                <th>Unidade</th>
                <th>Entrou em</th>
                <th className="w-[60px]"></th>
              </tr>
            </thead>
            <tbody>
              {c.members.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-6 text-fg-dim">Nenhum membro.</td></tr>
              ) : (
                c.members.map((m) => (
                  <tr key={m.userId}>
                    <td>
                      <div>{m.fullName ?? '—'}</div>
                      <div className="text-xs text-fg-subtle">{m.email}</div>
                    </td>
                    <td><StatusBadge value={m.role} tone={m.role === 'ADMIN' ? 'info' : 'muted'} /></td>
                    <td><StatusBadge value={m.status} /></td>
                    <td className="font-mono text-xs">{m.unitId?.slice(0, 8) ?? '—'}</td>
                    <td className="text-xs text-fg-dim">{new Date(m.joinedAt).toLocaleDateString('pt-BR')}</td>
                    <td>
                      <Link
                        to={`/usuarios/${m.userId}`}
                        className="text-accent hover:underline text-sm"
                      >
                        <Users className="inline h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      ) : null}
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: number;
  sub?: string;
  tone?: 'danger';
}) {
  return (
    <div className="rounded-lg border border-border bg-bg-surface p-3">
      <p className="text-xs uppercase tracking-wider text-fg-subtle">{label}</p>
      <p className={cn(
        'mt-0.5 text-xl font-semibold tabular-nums',
        tone === 'danger' ? 'text-danger' : 'text-fg',
      )}>
        {value}
      </p>
      {sub ? <p className="text-xs text-fg-subtle mt-0.5">{sub}</p> : null}
    </div>
  );
}

function DescList({ items }: { items: Array<[string, string]> }) {
  return (
    <dl className="rounded-lg border border-border bg-bg-surface divide-y divide-border">
      {items.map(([k, v]) => (
        <div key={k} className="flex justify-between px-4 py-2.5 text-sm">
          <dt className="text-fg-dim">{k}</dt>
          <dd className="text-fg">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function countAdmins(members: CondominiumDetail['members']): number {
  return members.filter((m) => m.role === 'ADMIN' || m.role === 'SUB_ADMIN').length;
}
