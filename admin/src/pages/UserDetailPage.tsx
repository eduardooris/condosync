import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Building2, Mail, Phone } from 'lucide-react';
import { masterService } from '@/services/master.service';
import { StatusBadge } from '@/components/StatusBadge';

export function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: user, isLoading } = useQuery({
    queryKey: ['master', 'user', id],
    queryFn: () => masterService.getUser(id!),
    enabled: !!id,
  });

  if (isLoading) return <div className="p-6 text-fg-dim">Carregando…</div>;
  if (!user) return <div className="p-6 text-fg-dim">Usuário não encontrado.</div>;

  return (
    <div className="p-6 space-y-5">
      <Link to="/usuarios" className="inline-flex items-center gap-1 text-sm text-fg-dim hover:text-fg">
        <ArrowLeft className="h-3.5 w-3.5" />
        Voltar
      </Link>

      <header>
        <h1 className="text-xl font-semibold tracking-tight">{user.fullName ?? '—'}</h1>
        <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-fg-dim">
          <span className="inline-flex items-center gap-1">
            <Mail className="h-3.5 w-3.5" />
            {user.email}
          </span>
          {user.phoneWhatsapp ? (
            <span className="inline-flex items-center gap-1">
              <Phone className="h-3.5 w-3.5" />
              {user.phoneWhatsapp}
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-xs text-fg-subtle font-mono">{user.id}</p>
      </header>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-fg-subtle">
          Condomínios ({user.memberships.length})
        </h2>
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="ds-table">
            <thead>
              <tr>
                <th>Condomínio</th>
                <th>Role</th>
                <th>Status</th>
                <th>Unidade</th>
                <th>Entrou em</th>
                <th className="w-[60px]"></th>
              </tr>
            </thead>
            <tbody>
              {user.memberships.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-6 text-fg-dim">
                  Esse usuário não pertence a nenhum condomínio.
                </td></tr>
              ) : (
                user.memberships.map((m) => (
                  <tr key={m.condominiumId}>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded bg-bg-elevated flex items-center justify-center">
                          <Building2 className="h-3 w-3 text-fg-subtle" />
                        </div>
                        <span>{m.condominiumName ?? '—'}</span>
                      </div>
                    </td>
                    <td><StatusBadge value={m.role} tone={m.role === 'ADMIN' ? 'info' : 'muted'} /></td>
                    <td><StatusBadge value={m.status} /></td>
                    <td className="font-mono text-xs">{m.unitId?.slice(0, 8) ?? '—'}</td>
                    <td className="text-xs text-fg-dim">{new Date(m.joinedAt).toLocaleDateString('pt-BR')}</td>
                    <td>
                      <Link
                        to={`/condominios/${m.condominiumId}`}
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
      </section>
    </div>
  );
}
