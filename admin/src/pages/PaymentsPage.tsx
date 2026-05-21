import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { RefreshCw, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { masterService } from '@/services/master.service';
import { StatusBadge } from '@/components/StatusBadge';
import { extractApiError } from '@/lib/http';

export function PaymentsPage() {
  const [search, setSearch] = useState('');
  const { data = [], isLoading } = useQuery({
    queryKey: ['master', 'payment-accounts'],
    queryFn: masterService.listPaymentAccounts,
  });

  const refreshAllMut = useMutation({
    mutationFn: () => masterService.refreshAllAsaasWebhooks(),
    onSuccess: ({ checked, refreshed }) => {
      if (refreshed === 0) {
        toast.success(
          `Tudo em dia: ${checked} subconta${checked !== 1 ? 's' : ''} verificada${checked !== 1 ? 's' : ''}, nenhuma precisava atualizar.`,
        );
      } else {
        toast.success(
          `${refreshed} de ${checked} subcontas atualizadas no Asaas.`,
        );
      }
    },
    onError: (e) => toast.error(extractApiError(e)),
  });

  const filtered = data.filter((a) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      a.condominiumName?.toLowerCase().includes(q) ||
      a.holderLegalName.toLowerCase().includes(q) ||
      a.holderEmail.toLowerCase().includes(q) ||
      a.asaasAccountId.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-6 space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Pagamentos</h1>
          <p className="text-sm text-fg-dim mt-1">
            Subcontas Asaas de todos os condomínios. Clique numa linha pra ver
            ações de debug (refresh webhook, simular Pix, etc).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => refreshAllMut.mutate()}
            disabled={refreshAllMut.isPending}
            title="Verifica todas as subcontas ATIVAS e re-registra os webhooks que não têm os eventos mais recentes (idempotente)."
            className="inline-flex h-9 items-center gap-2 rounded border border-border bg-bg-surface px-3 text-sm font-medium text-fg hover:bg-bg-elevated disabled:opacity-60"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${refreshAllMut.isPending ? 'animate-spin' : ''}`}
            />
            {refreshAllMut.isPending
              ? 'Atualizando…'
              : 'Atualizar webhooks (todas)'}
          </button>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-fg-subtle" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Condomínio, titular, email…"
              className="h-9 w-72 rounded border border-border bg-bg-surface pl-8 pr-3 text-sm placeholder:text-fg-subtle focus:border-accent focus:outline-none"
            />
          </div>
        </div>
      </header>

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="ds-table">
          <thead>
            <tr>
              <th>Condomínio</th>
              <th>Titular</th>
              <th>Tipo</th>
              <th>Status</th>
              <th>Subconta</th>
              <th>Última sync</th>
              <th className="w-[60px]"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="text-center py-8 text-fg-dim">
                  Carregando…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-8 text-fg-dim">
                  {search ? 'Nada bate com a busca.' : 'Nenhuma subconta criada ainda.'}
                </td>
              </tr>
            ) : (
              filtered.map((a) => (
                <tr key={a.id}>
                  <td>
                    <div className="font-medium">{a.condominiumName ?? '—'}</div>
                    <div className="text-xs text-fg-subtle font-mono">{a.condominiumId.slice(0, 8)}…</div>
                  </td>
                  <td>
                    <div>{a.holderLegalName}</div>
                    <div className="text-xs text-fg-subtle">{a.holderEmail}</div>
                  </td>
                  <td>
                    <span className="font-mono text-xs">{a.holderType}</span>
                  </td>
                  <td>
                    <StatusBadge value={a.status} />
                  </td>
                  <td>
                    <span className="font-mono text-xs">{a.asaasAccountId.slice(0, 16)}…</span>
                  </td>
                  <td className="text-fg-dim text-xs">
                    {a.lastStatusCheckAt
                      ? new Date(a.lastStatusCheckAt).toLocaleString('pt-BR')
                      : '—'}
                  </td>
                  <td>
                    <Link
                      to={`/pagamentos/${a.id}`}
                      className="text-accent hover:underline text-sm"
                    >
                      Abrir →
                    </Link>
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
