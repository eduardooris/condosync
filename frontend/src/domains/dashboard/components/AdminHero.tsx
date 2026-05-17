import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Building2,
  Sparkles,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/shared/utils/cn';

interface AdminHeroProps {
  saldo: number;
  inadimplenciaUnidades: number;
  receitas: number;
  despesas: number;
  condominiumName?: string;
}

function formatBrl(n: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
}

export function AdminHero({ saldo, inadimplenciaUnidades, receitas, despesas, condominiumName }: AdminHeroProps) {
  const reduce = useReducedMotion();
  const positive = saldo >= 0;
  const resultado = receitas - despesas;
  const alert = inadimplenciaUnidades > 0;

  return (
    <motion.section
      initial={reduce ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
      className="grid min-w-0 grid-cols-1 gap-3 ds-sm:gap-4 ds-md:grid-cols-[2fr_1fr]"
      aria-label="Visão geral financeira"
    >
      {/* Big saldo card */}
      <div className={cn(
        'relative overflow-hidden rounded-ds-3xl bg-gradient-to-br p-5 shadow-ds-elev ds-sm:p-6 ds-md:p-8',
        positive
          ? 'from-emerald-100/90 via-white to-slate-100/80 dark:from-emerald-500/[0.10] dark:via-brand-500/[0.05] dark:to-brand-900/30'
          : 'from-rose-100/90 via-white to-slate-100/80 dark:from-ds-danger/[0.10] dark:via-brand-500/[0.05] dark:to-brand-900/30',
      )}>
        <div className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-brand-400/20 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-brand-600/20 blur-3xl" aria-hidden />

        <div className="relative">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-ds-md bg-gradient-to-br from-brand-200/80 to-brand-500/30 ring-1 ring-brand-500/25 dark:from-brand-300/30 dark:to-brand-500/10 dark:ring-brand-400/30">
              <Wallet className="h-3.5 w-3.5 text-brand-700 dark:text-brand-300" strokeWidth={2} aria-hidden />
            </span>
            <p
              className="text-[11px] font-semibold uppercase tracking-widest text-ds-secondary"
              title="Receitas pagas menos despesas aprovadas, somando todos os meses."
            >
              Saldo acumulado{condominiumName ? ` · ${condominiumName}` : ''}
            </p>
          </div>

          <p
            className={cn(
              'mt-3 inline-flex items-center gap-2 text-[clamp(1.875rem,8vw,3.5rem)] font-extrabold leading-none tracking-tight tabular-nums ds-md:text-6xl',
              positive ? 'text-ds-body' : 'text-rose-700 dark:text-rose-300',
            )}
          >
            {positive ? (
              <ArrowUp className="h-6 w-6 shrink-0 text-emerald-600 dark:text-emerald-400 ds-md:h-9 ds-md:w-9" strokeWidth={2.4} aria-hidden />
            ) : (
              <ArrowDown className="h-6 w-6 shrink-0 text-rose-600 dark:text-rose-400 ds-md:h-9 ds-md:w-9" strokeWidth={2.4} aria-hidden />
            )}
            <span className="break-all">{formatBrl(saldo)}</span>
          </p>
          <p className="mt-1 text-ds-xs text-ds-secondary">
            Receitas pagas − despesas aprovadas, desde sempre.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-ds-sm">
            <span className="inline-flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300">
              <TrendingUp className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
              <span className="font-semibold">{formatBrl(receitas)}</span>
              <span className="text-ds-secondary">receitas no mês</span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-rose-800 dark:text-rose-300">
              <span className="font-semibold">−{formatBrl(despesas)}</span>
              <span className="text-ds-secondary">despesas no mês</span>
            </span>
            <span
              className={cn(
                'inline-flex items-center gap-1.5',
                resultado >= 0 ? 'text-brand-800 dark:text-brand-200' : 'text-amber-900 dark:text-amber-300',
              )}
              title="Receitas pagas menos despesas aprovadas neste mês."
            >
              <Sparkles className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
              <span className="font-semibold">{formatBrl(resultado)}</span>
              <span className="text-ds-secondary">resultado do mês</span>
            </span>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              to="/charges"
              className="inline-flex items-center gap-1.5 rounded-ds-xl bg-ds-elevated px-3.5 py-2 text-ds-sm font-semibold text-ds-body shadow-ds-sm transition hover:-translate-y-0.5 hover:bg-ds-surface hover:shadow-ds-md dark:bg-white/[0.08] dark:text-white dark:hover:bg-white/[0.14]"
            >
              Gerenciar cobranças
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
            <Link
              to="/expenses"
              className="inline-flex items-center gap-1.5 rounded-ds-xl bg-white/80 px-3.5 py-2 text-ds-sm font-semibold text-ds-body shadow-ds-sm transition hover:-translate-y-0.5 hover:bg-ds-surface hover:shadow-ds-md dark:bg-white/[0.04] dark:hover:bg-white/[0.10]"
            >
              Lançar despesa
            </Link>
          </div>
        </div>
      </div>

      {/* Inadimplência alert card */}
      <Link
        to="/charges"
        className={cn(
          'group relative flex flex-col justify-between overflow-hidden rounded-ds-2xl p-5 shadow-ds-card transition hover:-translate-y-0.5 hover:shadow-ds-elev',
          alert
            ? 'bg-gradient-to-br from-amber-50 to-amber-100/80 hover:from-amber-100 hover:to-amber-100 dark:from-amber-500/[0.14] dark:to-amber-600/[0.06] dark:hover:from-amber-500/[0.18] dark:hover:to-amber-600/[0.08]'
            : 'bg-gradient-to-br from-emerald-50 to-slate-100/90 hover:from-emerald-100/90 hover:to-slate-100 dark:from-emerald-500/[0.12] dark:to-brand-500/[0.06] dark:hover:from-emerald-500/[0.16] dark:hover:to-brand-500/[0.08]',
        )}
      >
        <div>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-ds-md ring-1',
                alert
                  ? 'bg-amber-200/80 text-amber-900 ring-amber-500/30 dark:bg-amber-400/15 dark:text-amber-300 dark:ring-amber-400/30'
                  : 'bg-emerald-200/80 text-emerald-900 ring-emerald-500/30 dark:bg-emerald-400/15 dark:text-emerald-300 dark:ring-emerald-400/30',
              )}
            >
              <Building2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            </span>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-ds-secondary">
              Inadimplência
            </p>
          </div>
          <p className="mt-3 text-4xl font-extrabold tracking-tight text-ds-body">
            {inadimplenciaUnidades}
          </p>
          <p className="mt-1 text-ds-sm text-ds-secondary">
            {inadimplenciaUnidades === 0
              ? 'Tudo em dia. 🎉'
              : `unidade${inadimplenciaUnidades === 1 ? '' : 's'} em atraso`}
          </p>
        </div>
        <span
          className={cn(
            'mt-3 inline-flex items-center gap-1 text-ds-xs font-semibold',
            alert ? 'text-amber-900 dark:text-amber-300' : 'text-emerald-800 dark:text-emerald-300',
          )}
        >
          Abrir cobranças
          <ArrowRight className="h-3 w-3 transition group-hover:translate-x-0.5" aria-hidden />
        </span>
      </Link>
    </motion.section>
  );
}
