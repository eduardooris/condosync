import { motion, useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Building2,
  Clock,
  LogOut,
  Mail,
  RefreshCcw,
} from 'lucide-react';
import { queryKeys } from '@/shared/lib/queryKeys';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/shared/components/ui/Button';
import { useAuthStore } from '@/shared/stores/auth.store';

export function NoCondominiumPage() {
  const reduce = useReducedMotion();
  const logout = useAuthStore((s) => s.logout);
  const queryClient = useQueryClient();
  const canCreate = useAuthStore((s) => s.canCreateCondominium);
  const userName = useAuthStore((s) => s.user?.name?.split(' ')[0]);
  const pendingMemberships = useAuthStore((s) => s.pendingMemberships);
  const hasPending = pendingMemberships.length > 0;

  return (
    <main className="ds-page relative flex min-h-screen min-w-0 flex-col items-center justify-center overflow-hidden px-5 py-12">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="ds-blob absolute -left-32 top-10 h-72 w-72 rounded-full bg-brand-400/15 blur-3xl" />
        <div className="ds-blob absolute -right-32 bottom-10 h-80 w-80 rounded-full bg-brand-600/15 blur-3xl" />
      </div>

      <motion.div
        initial={reduce ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative z-10 w-full max-w-lg"
      >
        <div className="ds-surface-elevated p-8 text-center ds-md:p-10">
          <motion.div
            initial={reduce ? false : { scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 220, damping: 20, delay: 0.05 }}
            className={`mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-ds-2xl shadow-lg ${
              hasPending
                ? 'bg-gradient-to-br from-amber-300 to-amber-600 shadow-amber-500/30'
                : 'bg-gradient-to-br from-brand-300 to-brand-600 shadow-brand-500/30'
            }`}
          >
            {hasPending ? (
              <Clock className="h-7 w-7 text-white" aria-hidden />
            ) : (
              <Building2 className="h-7 w-7 text-white" aria-hidden />
            )}
          </motion.div>
          <p
            className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${
              hasPending ? 'text-amber-800 dark:text-amber-300' : 'text-brand-800 dark:text-brand-300'
            }`}
          >
            {hasPending
              ? 'Aguardando aprovação'
              : canCreate
                ? 'Tudo pronto para começar'
                : 'Conta sem condomínio'}
          </p>
          <h1 className="mt-2 text-ds-2xl font-bold tracking-tight text-ds-body">
            {userName ? `Olá, ${userName}!` : 'Olá!'}
          </h1>

          {hasPending ? (
            <>
              <p className="mx-auto mt-3 max-w-md text-ds-sm leading-relaxed text-ds-dim">
                Sua solicitação para entrar{' '}
                {pendingMemberships.length === 1 ? 'no condomínio' : 'nos condomínios'}{' '}
                abaixo está sendo analisada por um administrador. Você receberá
                acesso assim que for aprovada.
              </p>
              <ul className="mx-auto mt-5 grid gap-2 text-left">
                {pendingMemberships.map((m) => (
                  <li
                    key={m.condominiumId}
                    className="flex items-center gap-3 rounded-ds-lg border border-ds-stroke-subtle bg-ds-surface px-4 py-3 dark:bg-white/[0.03]"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-ds-md bg-amber-500/15 text-amber-800 dark:text-amber-300">
                      <Building2 className="h-4 w-4" aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-ds-sm font-semibold text-ds-body">
                        {m.condominiumName}
                      </p>
                      <p className="text-ds-xs text-ds-subtle">
                        Aguardando aprovação
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="mx-auto mt-3 max-w-md text-ds-sm leading-relaxed text-ds-dim">
              {canCreate
                ? 'Você ainda não tem nenhum condomínio configurado. Vamos criar seu primeiro condomínio em poucos passos.'
                : 'Sua conta ainda não está vinculada a nenhum condomínio. Peça para o síndico te incluir como morador para liberar o acesso.'}
            </p>
          )}

          <div className="mt-7 grid gap-3 ds-sm:grid-cols-2">
            {hasPending ? null : canCreate ? (
              <Link to="/setup">
                <Button variant="gradient" fullWidth>
                  Criar condomínio
                </Button>
              </Link>
            ) : (
              <a href="mailto:suporte@condosync.com">
                <Button variant="gradient" fullWidth>
                  <Mail className="h-4 w-4" aria-hidden />
                  Falar com o síndico
                </Button>
              </a>
            )}
            <Button
              variant={hasPending ? 'gradient' : 'secondary'}
              fullWidth
              onClick={() =>
                queryClient.invalidateQueries({ queryKey: queryKeys.condominiums.root() })
              }
              className={hasPending ? 'ds-sm:col-span-2' : undefined}
            >
              <RefreshCcw className="h-4 w-4" aria-hidden />
              Atualizar
            </Button>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className="mt-6 text-ds-subtle hover:text-ds-body"
          >
            <LogOut className="h-3 w-3" aria-hidden />
            Sair desta conta
          </Button>
        </div>
      </motion.div>
    </main>
  );
}
