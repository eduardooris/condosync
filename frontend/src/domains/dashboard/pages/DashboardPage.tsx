import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import {
  Sparkles, TrendingUp, TrendingDown,
  Building2, AlertCircle, ArrowRight, Receipt, BarChart2, ClipboardList, UserPlus,
} from 'lucide-react';
import { DashboardRevenueChart } from '@/domains/dashboard/components/DashboardRevenueChart';
import { AdminHero } from '@/domains/dashboard/components/AdminHero';
import { ResidentHero } from '@/domains/dashboard/components/ResidentHero';
import { KpiCard } from '@/shared/components/ui/KpiCard';
import { Spinner } from '@/shared/components/ui/Spinner';
import { PageSkeleton } from '@/shared/components/ui/Skeleton';
import { useAuthStore } from '@/shared/stores/auth.store';
import { useDashboardPage } from '@/domains/dashboard/hooks/useDashboardPage';
import { canAccessCondominiumAdminRoutes } from '@/shared/utils/roles';
import { cn } from '@/shared/utils/cn';
import { membersService } from '@/domains/condominiums/services/members.service';
import { queryKeys } from '@/shared/lib/queryKeys';

function formatBrl(n: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

const adminQuickActions = [
  { to: '/charges', label: 'Cobranças', icon: Receipt, color: 'from-brand-400/25 to-brand-600/15 hover:from-brand-400/35 hover:to-brand-600/20' },
  { to: '/polls', label: 'Enquetes', icon: BarChart2, color: 'from-violet-400/25 to-violet-600/15 hover:from-violet-400/35 hover:to-violet-600/20' },
  { to: '/occurrences', label: 'Ocorrências', icon: ClipboardList, color: 'from-amber-400/25 to-orange-600/15 hover:from-amber-400/35 hover:to-orange-600/20' },
];

export function DashboardPage() {
  const condominium = useAuthStore((state) => state.activeCondominium);
  const role = useAuthStore((state) => state.role);
  const user = useAuthStore((state) => state.user);
  const isAdmin = canAccessCondominiumAdminRoutes(role);

  const { summaryQuery, chartQuery } = useDashboardPage(condominium?.id);
  const data = summaryQuery.data;
  const chart = chartQuery.data;
  const isLoading = summaryQuery.isLoading;
  const chartLoading = chartQuery.isLoading;

  const pendingMembersQuery = useQuery({
    queryKey: queryKeys.members.pending(condominium?.id),
    queryFn: () => membersService.listPending(condominium!.id),
    enabled: isAdmin && Boolean(condominium?.id),
    staleTime: 30_000,
  });
  const pendingMembers = pendingMembersQuery.data ?? [];

  const kpi = useMemo(() => {
    const receitas = data?.totalReceitasPagas ?? 0;
    const despesas = data?.totalDespesasAprovadas ?? 0;
    return {
      saldo: data?.saldoAtual ?? 0,
      receitas,
      despesas,
      resultado: receitas - despesas,
      inadimplencia: data?.inadimplenciaUnidades ?? 0,
    };
  }, [data]);

  if (isLoading) return <PageSkeleton />;

  const now = new Date();
  const dataLonga = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(now);

  const isEmpty = kpi.saldo === 0 && kpi.receitas === 0 && kpi.despesas === 0;

  return (
    <div className="ds-page mx-auto max-w-7xl space-y-4 ds-sm:space-y-5 ds-md:space-y-6">
      {/* Greeting strip */}
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
        className="flex flex-wrap items-end justify-between gap-3"
      >
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-widest text-ds-secondary">
            {(() => {
              const first = (user?.name?.trim() ?? '').split(/\s+/).find(Boolean);
              return first ? `${greeting()}, ${first}` : greeting();
            })()}
          </span>
          <p className="mt-0.5 text-ds-sm text-ds-secondary">{dataLonga}</p>
        </div>

        {isAdmin ? (
          <div className="flex flex-wrap gap-2">
            {adminQuickActions.map(({ to, label, icon: Icon, color }) => (
              <Link
                key={to}
                to={to}
                className={cn(
                  'flex items-center gap-2 rounded-ds-xl px-3 py-2 text-ds-xs font-semibold text-ds-body shadow-ds-sm transition hover:shadow-ds-md',
                  `bg-gradient-to-br ${color}`,
                  'hover:-translate-y-0.5',
                )}
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                {label}
                <ArrowRight className="h-3 w-3 text-ds-dim" aria-hidden />
              </Link>
            ))}
          </div>
        ) : null}
      </motion.header>

      {/* Pending member approvals banner (admin only) */}
      {isAdmin && pendingMembers.length > 0 && condominium?.id ? (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Link
            to={`/condominiums/${condominium.id}?section=team`}
            className="group flex items-start gap-3 rounded-ds-2xl border-l-[3px] border-l-brand-400 bg-brand-50/90 px-4 py-3.5 text-ds-sm leading-relaxed text-ds-secondary shadow-ds-card transition hover:-translate-y-0.5 hover:bg-brand-100/70 hover:shadow-ds-elev dark:bg-brand-500/[0.10] dark:text-ds-dim dark:hover:bg-brand-500/[0.16]"
          >
            <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-500/15 text-brand-700 ring-1 ring-brand-500/30 dark:text-brand-300">
              <UserPlus className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="font-semibold text-ds-body">
                {pendingMembers.length === 1
                  ? '1 morador aguardando aprovação'
                  : `${pendingMembers.length} moradores aguardando aprovação`}
              </span>
              <span className="ml-1 text-ds-dim">
                — revise e defina unidade/papel em Equipe.
              </span>
            </span>
            <ArrowRight
              className="mt-1 h-3.5 w-3.5 shrink-0 text-ds-dim transition group-hover:translate-x-0.5 group-hover:text-ds-body"
              aria-hidden
            />
          </Link>
        </motion.div>
      ) : null}

      {/* Hero by role */}
      {isAdmin ? (
        <AdminHero
          saldo={kpi.saldo}
          inadimplenciaUnidades={kpi.inadimplencia}
          receitas={kpi.receitas}
          despesas={kpi.despesas}
          condominiumName={condominium?.name}
        />
      ) : (
        <ResidentHero
          saldoCondominio={kpi.saldo}
          condominiumName={condominium?.name}
          userName={user?.name}
        />
      )}

      {/* Zero-data banner */}
      {isEmpty ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          className="flex items-start gap-3 rounded-ds-2xl border-l-[3px] border-l-ds-warning/80 bg-amber-50/90 px-4 py-3.5 text-ds-sm leading-relaxed text-ds-secondary shadow-ds-card dark:bg-amber-500/[0.08] dark:text-ds-dim"
          role="status"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-ds-warning" aria-hidden />
          <span>
            <span className="font-semibold text-ds-body">Resumo financeiro ainda zerado.</span>{' '}
            {isAdmin ? (
              <>
                Comece pelo{' '}
                <Link className="font-semibold text-ds-action underline-offset-2 hover:underline" to="/setup">
                  setup do condomínio
                </Link>{' '}
                ou registre a primeira{' '}
                <Link className="font-semibold text-ds-action underline-offset-2 hover:underline" to="/charges">
                  cobrança
                </Link>
                .
              </>
            ) : (
              <>Aguarde a configuração inicial pelo síndico.</>
            )}
          </span>
        </motion.div>
      ) : null}

      {/* Secondary KPIs (admin only) — sem duplicar números do hero */}
      {isAdmin ? (
        <div className="grid min-w-0 grid-cols-1 gap-3 ds-sm:grid-cols-3">
          <KpiCard
            title="Receitas pagas (mês)"
            value={formatBrl(kpi.receitas)}
            hint="Total quitado neste mês"
            icon={<TrendingUp className="h-4 w-4" strokeWidth={1.75} />}
            gradient="emerald"
          />
          <KpiCard
            title="Despesas (mês)"
            value={formatBrl(kpi.despesas)}
            hint="Aprovadas neste mês"
            icon={<TrendingDown className="h-4 w-4" strokeWidth={1.75} />}
            gradient="rose"
          />
          <KpiCard
            title="Inadimplência"
            value={String(kpi.inadimplencia)}
            hint={kpi.inadimplencia === 1 ? 'unidade em atraso' : 'unidades em atraso'}
            icon={<Building2 className="h-4 w-4" strokeWidth={1.75} />}
            gradient="amber"
            trend={kpi.inadimplencia === 0 ? 'up' : 'down'}
          />
        </div>
      ) : null}

      {/* Revenue chart */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
      >
        {chartLoading ? (
          <div className="flex items-center gap-2 rounded-ds-2xl bg-ds-surface px-5 py-8 text-ds-sm text-ds-secondary shadow-ds-card dark:bg-white/[0.03] dark:text-ds-dim">
            <Spinner />
            <span>Carregando série histórica…</span>
          </div>
        ) : (
          <DashboardRevenueChart data={chart} />
        )}
      </motion.div>

      {/* Footer hint for residents */}
      {!isAdmin ? (
        <p className="flex flex-wrap items-center gap-1.5 text-ds-xs text-ds-secondary">
          <Sparkles className="h-3 w-3 shrink-0 text-ds-action" aria-hidden />
          Visualize o extrato completo em{' '}
          <Link to="/expenses" className="font-semibold text-ds-action underline-offset-2 hover:underline">
            Despesas
          </Link>
          .
        </p>
      ) : null}
    </div>
  );
}
