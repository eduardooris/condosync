import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { masterService } from '@/services/master.service';
import { StatusBadge } from '@/components/StatusBadge';
import type { ChargeStatus } from '@/lib/types';

const STATUS_OPTIONS: Array<{ value: ChargeStatus | ''; label: string }> = [
  { value: '', label: 'Todos status' },
  { value: 'PENDING', label: 'Pendente' },
  { value: 'PAID', label: 'Paga' },
  { value: 'OVERDUE', label: 'Atrasada' },
  { value: 'EXEMPT', label: 'Isenta' },
  { value: 'CANCELED', label: 'Cancelada' },
];

export function ChargesPage() {
  const [status, setStatus] = useState<ChargeStatus | ''>('');
  const [search, setSearch] = useState('');

  const { data = [], isLoading } = useQuery({
    queryKey: ['master', 'charges', { status, search }],
    queryFn: () =>
      masterService.listCharges({
        status: status || undefined,
        search: search.trim() || undefined,
        limit: 100,
      }),
  });

  return (
    <div className="p-6 space-y-4">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Cobranças</h1>
        <p className="text-sm text-fg-dim mt-1">
          Cross-tenant — toda cobrança do produto. Útil quando síndico reporta
          algum problema específico.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as ChargeStatus | '')}
          className="h-9 rounded border border-border bg-bg-surface px-2 text-sm"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-fg-subtle" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="pay_id, descrição, UUID local…"
            className="h-9 w-full rounded border border-border bg-bg-surface pl-8 pr-3 text-sm placeholder:text-fg-subtle focus:border-accent focus:outline-none"
          />
        </div>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="ds-table">
          <thead>
            <tr>
              <th>Condomínio</th>
              <th>Unidade</th>
              <th>Competência</th>
              <th>Valor</th>
              <th>Status</th>
              <th>Pago em</th>
              <th>Forma</th>
              <th>Asaas ID</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={8} className="text-center py-6 text-fg-dim">Carregando…</td></tr>
            ) : data.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-6 text-fg-dim">Nada encontrado.</td></tr>
            ) : (
              data.map((c) => (
                <tr key={c.id}>
                  <td>{c.condominiumName ?? '—'}</td>
                  <td>{c.unitLabel ?? '—'}</td>
                  <td>{c.billingMonth}</td>
                  <td className="tabular-nums">R$ {c.amount}</td>
                  <td><StatusBadge value={c.status} /></td>
                  <td className="text-xs text-fg-dim">
                    {c.paidAt ? new Date(c.paidAt).toLocaleString('pt-BR') : '—'}
                  </td>
                  <td className="text-xs">
                    {c.paidMethod && c.paidMethod !== 'UNDEFINED' ? c.paidMethod : '—'}
                  </td>
                  <td className="font-mono text-xs">
                    {c.asaasPaymentId?.slice(0, 16) ?? '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
