import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { BrandMark } from '@/shared/components/ui/BrandMark';
import { Button } from '@/shared/components/ui/Button';
import { cn } from '@/shared/utils/cn';
import { STEP_ORDER, stepIndex, type SetupStep } from '@/domains/setup/store/setup.store';

interface SetupShellProps {
  step: SetupStep;
  title: string;
  eyebrow?: string;
  description?: string;
  children: ReactNode;
  primaryLabel?: string;
  primaryDisabled?: boolean;
  primaryLoading?: boolean;
  onPrimary?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  onBack?: () => void;
  hideProgress?: boolean;
  hidePrimary?: boolean;
}

const STEP_LABELS: Record<SetupStep, string> = {
  welcome: 'Boas-vindas',
  identity: 'Identidade',
  financial: 'Financeiro',
  payments: 'Pagamentos',
  units: 'Unidades',
  done: 'Pronto',
};

export function SetupShell({
  step,
  title,
  eyebrow,
  description,
  children,
  primaryLabel = 'Continuar',
  primaryDisabled,
  primaryLoading,
  onPrimary,
  secondaryLabel,
  onSecondary,
  onBack,
  hideProgress,
  hidePrimary,
}: SetupShellProps) {
  const reduce = useReducedMotion();
  const totalSteps = STEP_ORDER.length;
  const current = stepIndex(step) + 1;
  const progress = (current / totalSteps) * 100;

  return (
    <div className="ds-page relative flex min-h-screen min-w-0 flex-col overflow-hidden bg-ds-deep text-ds-body">
      {/* Ambient background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="ds-blob absolute -left-32 top-0 h-[36rem] w-[36rem] rounded-full bg-brand-400/12 blur-[120px]" />
        <div className="ds-blob absolute -right-40 top-1/3 h-[40rem] w-[40rem] rounded-full bg-brand-600/15 blur-[120px]" />
        <div className="ds-blob absolute bottom-[-20%] left-1/4 h-[32rem] w-[32rem] rounded-full bg-brand-500/10 blur-[120px]" />
      </div>

      {/* Top bar */}
      <header className="relative z-10 flex items-center justify-between gap-3 px-5 pt-5 ds-md:px-10 ds-md:pt-7">
        <div className="flex items-center gap-2.5">
          <BrandMark size="sm" rounded="lg" />
          <div className="leading-tight">
            <p className="text-[15px] font-bold tracking-tight text-ds-body">CondoSync</p>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-ds-dim dark:text-brand-300/70">
              Configuração inicial
            </p>
          </div>
        </div>
        {onBack ? (
          <Button
            variant="outline"
            size="sm"
            onClick={onBack}
            className="border-ds-stroke/50 bg-ds-surface text-ds-dim hover:border-brand-400/40 hover:text-ds-body dark:bg-white/[0.04]"
          >
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            Voltar
          </Button>
        ) : (
          <span aria-hidden className="block h-8 w-8" />
        )}
      </header>

      {/* Progress */}
      {!hideProgress ? (
        <div className="relative z-10 mt-6 px-5 ds-md:mt-8 ds-md:px-10">
          <div className="mx-auto flex max-w-3xl items-center gap-3">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-ds-dim dark:text-brand-300/60">
              Passo {current} de {totalSteps}
            </span>
            <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-ds-surface dark:bg-white/[0.05]">
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-brand-300 to-brand-500"
                initial={false}
                animate={{ width: `${progress}%` }}
                transition={{ duration: reduce ? 0 : 0.45, ease: [0.25, 0.1, 0.25, 1] }}
              />
            </div>
            <span className="text-[11px] font-semibold uppercase tracking-widest text-ds-dim dark:text-brand-300/60">
              {STEP_LABELS[step]}
            </span>
          </div>
        </div>
      ) : null}

      {/* Body */}
      <main className="relative z-10 flex min-w-0 flex-1 items-center justify-center px-5 py-10 ds-md:px-10">
        <motion.div
          key={step}
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: [0.25, 0.1, 0.25, 1] }}
          className={cn('mx-auto w-full min-w-0 max-w-2xl', step === 'welcome' && 'max-w-3xl')}
        >
          {eyebrow ? (
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-800 dark:text-brand-300">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="text-ds-2xl font-bold tracking-tight text-ds-body ds-md:text-ds-display">{title}</h1>
          {description ? (
            <p className="mt-3 max-w-2xl text-ds-md leading-relaxed text-ds-dim">
              {description}
            </p>
          ) : null}
          <div className="mt-8">{children}</div>
        </motion.div>
      </main>

      {/* Footer actions */}
      {!hidePrimary || secondaryLabel ? (
        <footer className="relative z-10 border-t border-ds-stroke-subtle bg-[var(--ds-setup-footer-bg)] px-5 py-4 backdrop-blur-xl ds-md:px-10 ds-md:py-5">
          <div className="mx-auto flex max-w-2xl flex-col-reverse items-stretch gap-2 ds-sm:flex-row ds-sm:items-center ds-sm:justify-end">
            {secondaryLabel ? (
              <Button variant="ghost" onClick={onSecondary} type="button">
                {secondaryLabel}
              </Button>
            ) : null}
            {!hidePrimary ? (
              <Button
                variant="gradient"
                onClick={onPrimary}
                disabled={primaryDisabled || primaryLoading}
                type="button"
                className="min-w-[10rem]"
              >
                {primaryLoading ? 'Carregando…' : primaryLabel}
                {!primaryLoading && <ArrowRight className="h-4 w-4" strokeWidth={2.25} aria-hidden />}
              </Button>
            ) : null}
          </div>
        </footer>
      ) : null}
    </div>
  );
}
