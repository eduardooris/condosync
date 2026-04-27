import { motion, useReducedMotion } from 'framer-motion';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/shared/utils/cn';

const gradients: Record<string, { bg: string; glow: string }> = {
  blue: { bg: 'from-brand-300 to-brand-600', glow: 'rgba(85, 145, 235, 0.30)' },
  emerald: { bg: 'from-emerald-400 to-emerald-700', glow: 'rgba(46, 200, 134, 0.26)' },
  violet: { bg: 'from-violet-400 to-indigo-700', glow: 'rgba(139, 92, 246, 0.26)' },
  rose: { bg: 'from-rose-400 to-rose-700', glow: 'rgba(240, 80, 80, 0.26)' },
  amber: { bg: 'from-amber-400 to-orange-600', glow: 'rgba(240, 184, 64, 0.26)' },
};

export type KpiGradient = keyof typeof gradients;

export function KpiCard({
  title,
  value,
  hint,
  icon,
  gradient = 'blue',
  trend,
  className,
  delayClass = '',
}: {
  title: string;
  value: string;
  hint?: string;
  icon: ReactNode;
  gradient?: KpiGradient;
  trend?: 'up' | 'down';
  className?: string;
  delayClass?: string;
}) {
  const reduce = useReducedMotion();
  const g = gradients[gradient] ?? gradients.blue!;

  const card = (
    <div
      className={cn(
        'group relative overflow-hidden rounded-ds-xl border border-ds-stroke',
        'bg-ds-surface shadow-ds-md backdrop-blur-sm',
        'transition duration-300 hover:bg-ds-elevated hover:-translate-y-0.5',
        'dark:border-transparent',
        className,
      )}
    >
      {/* Ambient glow orb */}
      <div
        className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-50 blur-2xl transition-opacity duration-500 group-hover:opacity-80"
        style={{ background: g.glow }}
        aria-hidden
      />

      <div className="relative flex flex-col gap-3 p-4 ds-sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <div
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-ds-xl bg-gradient-to-br text-ds-on-primary shadow-lg',
              g.bg,
            )}
            style={{ boxShadow: `0 6px 20px ${g.glow}` }}
          >
            {icon}
          </div>
          {trend ? (
            <div
              className={cn(
                'flex items-center gap-0.5 rounded-ds-pill px-2 py-0.5 text-ds-xs font-bold',
                trend === 'up'
                  ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-400'
                  : 'bg-rose-100 text-rose-900 dark:bg-rose-500/15 dark:text-rose-400',
              )}
            >
              {trend === 'up' ? (
                <ArrowUpRight className="h-3 w-3" aria-hidden />
              ) : (
                <ArrowDownRight className="h-3 w-3" aria-hidden />
              )}
            </div>
          ) : null}
        </div>

        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-ds-secondary">
            {title}
          </p>
          <p className="mt-1 text-[22px] font-extrabold tabular-nums leading-none tracking-tight text-ds-body ds-sm:text-2xl">
            {value}
          </p>
          {hint ? (
            <p className="mt-1.5 line-clamp-2 text-[11px] leading-snug text-ds-secondary">{hint}</p>
          ) : null}
        </div>
      </div>
    </div>
  );

  if (reduce) {
    return <div className={delayClass}>{card}</div>;
  }

  return (
    <motion.div
      className={delayClass}
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
      whileHover={{ y: -3 }}
    >
      {card}
    </motion.div>
  );
}
