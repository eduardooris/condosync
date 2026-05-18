import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Search, Building2 } from 'lucide-react';
import { masterService } from '@/services/master.service';
import { StatusBadge } from '@/components/StatusBadge';

export function CondominiumsPage() {
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  const { data = [], isLoading } = useQuery({
    queryKey: ['master', 'condominiums', { search, showArchived }],
    queryFn: () =>
      masterService.listCondominiums({
        search: search.trim() || undefined,
        archived: showArchived ? 'include' : undefined,
      }),
  });

  return (
    <div className="p-6 space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Condomínios</h1>
          <p className="text-sm text-fg-dim mt-1">
            Todos os condomínios do produto. Clica em um pra ver tudo (cobranças,
            pagamento, moradores) em uma página só.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-fg-dim">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="rounded border-border bg-bg-surface"
            />
            Incluir arquivados
          </label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-fg-subtle" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nome ou CNPJ…"
              className="h-9 w-64 rounded border border-border bg-bg-surface pl-8 pr-3 text-sm placeholder:text-fg-subtle focus:border-accent focus:outline-none"
            />
          </div>
        </div>
      </header>

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="ds-table">
          <thead>
            <tr>
              <th>Condomínio</th>
              <th>CNPJ/CPF</th>
              <th className="text-right">Unidades</th>
              <th className="text-right">Membros</th>
              <th>Taxa mensal</th>
              <th>Conta digital</th>
              <th className="w-[80px]"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="text-center py-8 text-fg-dim">Carregando…</td></tr>
            ) : data.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8 text-fg-dim">
                {search ? 'Nada bate com a busca.' : 'Nenhum condomínio cadastrado.'}
              </td></tr>
            ) : (
              data.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded bg-bg-elevated flex items-center justify-center shrink-0">
                        <Building2 className="h-3.5 w-3.5 text-fg-subtle" />
                      </div>
                      <div>
                        <div className="font-medium">{c.name}</div>
                        {c.archivedAt ? (
                          <span className="text-xs text-warning">Arquivado</span>
                        ) : (
                          <span className="text-xs text-fg-subtle font-mono">
                            {c.id.slice(0, 8)}…
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="font-mono text-xs">{c.cnpj ?? '—'}</td>
                  <td className="text-right tabular-nums">{c.unitCount}</td>
                  <td className="text-right tabular-nums">{c.memberCount}</td>
                  <td className="tabular-nums">R$ {c.monthlyFeeAmount}</td>
                  <td>
                    {c.paymentAccountStatus ? (
                      <StatusBadge value={c.paymentAccountStatus} />
                    ) : (
                      <span className="text-xs text-fg-subtle">não configurada</span>
                    )}
                  </td>
                  <td>
                    <Link
                      to={`/condominios/${c.id}`}
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
