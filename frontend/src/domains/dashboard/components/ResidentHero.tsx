import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, CalendarDays, CheckCircle2, Receipt } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/shared/utils/cn';

interface ResidentHeroProps {
  saldoCondominio: number;
  condominiumName?: string;
  userName?: string;
}

function formatBrl(n: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
}

export function ResidentHero({ saldoCondominio, condominiumName, userName }: ResidentHeroProps) {
  const reduce = useReducedMotion();
  const greeting = userName?.split(' ')[0];
  const positive = saldoCondominio >= 0;

  return (
    <motion.section
      initial={reduce ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
      className="grid min-w-0 grid-cols-1 gap-4 ds-md:grid-cols-[2fr_1fr]"
      aria-label="Visão do morador"
    >
      <div className="relative overflow-hidden rounded-ds-xl border border-ds-stroke bg-gradient-to-br from-brand-50 via-white to-slate-100/90 p-6 ring-1 ring-black/[0.03] dark:border-transparent dark:from-brand-500/[0.14] dark:via-brand-600/[0.06] dark:to-brand-900/30 dark:ring-0 ds-md:p-8">
        <div className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-brand-400/20 blur-3xl" aria-hidden />

        <div className="relative">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-ds-secondary">
            {greeting ? `Olá, ${greeting}` : 'Olá'}
          </p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-ds-body ds-md:text-3xl">
            Sua próxima cobrança
          </h2>
          <p className="mt-1 text-ds-sm text-ds-secondary">Acompanhe pagamentos e consulte o histórico.</p>

          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              to="/charges"
              className="inline-flex items-center gap-1.5 rounded-ds-xl border border-ds-stroke bg-ds-elevated px-4 py-2.5 text-ds-sm font-semibold text-ds-body shadow-ds-sm transition hover:bg-ds-surface dark:border-white/10 dark:bg-white/[0.08] dark:text-white dark:shadow-none dark:hover:bg-white/[0.12]"
            >
              <Receipt className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
              Ver minhas cobranças
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
            <Link
              to="/expenses"
              className="inline-flex items-center gap-1.5 rounded-ds-md border border-ds-stroke bg-white/80 px-4 py-2.5 text-ds-sm font-semibold text-ds-body transition hover:bg-ds-surface dark:border-white/[0.08] dark:bg-white/[0.04] dark:hover:bg-white/[0.10]"
            >
              Transparência financeira
            </Link>
          </div>
        </div>
      </div>

      <div className={cn(
        'relative flex flex-col justify-between overflow-hidden rounded-ds-xl border border-ds-stroke p-5 shadow-ds-sm ring-1 ring-black/[0.03] dark:border-transparent dark:shadow-none dark:ring-0',
        positive
          ? 'bg-gradient-to-br from-emerald-50 to-slate-100/90 dark:from-emerald-500/[0.12] dark:to-brand-500/[0.06]'
          : 'bg-gradient-to-br from-amber-50 to-amber-100/80 dark:from-amber-500/[0.12] dark:to-amber-600/[0.06]',
      )}>
        <div>
          <div className="flex items-center gap-2">
            <span className={cn(
              'flex h-7 w-7 items-center justify-center rounded-ds-md ring-1',
              positive
                ? 'bg-emerald-200/80 text-emerald-900 ring-emerald-500/30 dark:bg-emerald-400/15 dark:text-emerald-300 dark:ring-emerald-400/30'
                : 'bg-amber-200/80 text-amber-900 ring-amber-500/30 dark:bg-amber-400/15 dark:text-amber-300 dark:ring-amber-400/30',
            )}>
              {positive ? <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden /> : <CalendarDays className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />}
            </span>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-ds-secondary">
              Caixa do {condominiumName ?? 'condomínio'}
            </p>
          </div>
          <p className="mt-3 text-3xl font-extrabold tracking-tight text-ds-body">{formatBrl(saldoCondominio)}</p>
          <p className="mt-1 text-ds-sm text-ds-secondary">Saldo público para todos os moradores.</p>
        </div>
      </div>
    </motion.section>
  );
}
