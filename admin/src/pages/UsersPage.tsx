import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Search, User as UserIcon } from 'lucide-react';
import { masterService } from '@/services/master.service';

export function UsersPage() {
  const [search, setSearch] = useState('');
  const { data = [], isLoading } = useQuery({
    queryKey: ['master', 'users', { search }],
    queryFn: () => masterService.listUsers({ search: search.trim() || undefined, limit: 100 }),
  });

  return (
    <div className="p-6 space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Usuários</h1>
          <p className="text-sm text-fg-dim mt-1">
            Busca por email ou nome. Útil quando o suporte recebe contato com
            base no email do síndico/morador.
          </p>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-fg-subtle" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Email ou nome…"
            className="h-9 w-72 rounded border border-border bg-bg-surface pl-8 pr-3 text-sm placeholder:text-fg-subtle focus:border-accent focus:outline-none"
          />
        </div>
      </header>

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="ds-table">
          <thead>
            <tr>
              <th>Usuário</th>
              <th>WhatsApp</th>
              <th className="text-right">Condomínios</th>
              <th>Criado em</th>
              <th className="w-[60px]"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="text-center py-8 text-fg-dim">Carregando…</td></tr>
            ) : data.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-8 text-fg-dim">
                {search ? 'Nada bate com a busca.' : 'Use a busca acima.'}
              </td></tr>
            ) : (
              data.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-bg-elevated flex items-center justify-center shrink-0">
                        <UserIcon className="h-3.5 w-3.5 text-fg-subtle" />
                      </div>
                      <div>
                        <div className="font-medium">{u.fullName ?? '—'}</div>
                        <div className="text-xs text-fg-dim">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="font-mono text-xs">{u.phoneWhatsapp ?? '—'}</td>
                  <td className="text-right tabular-nums">{u.condominiumCount}</td>
                  <td className="text-xs text-fg-dim">
                    {new Date(u.createdAt).toLocaleDateString('pt-BR')}
                  </td>
                  <td>
                    <Link
                      to={`/usuarios/${u.id}`}
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
