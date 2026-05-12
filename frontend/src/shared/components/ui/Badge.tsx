import { cn } from '@/shared/utils/cn';

/**
 * Sistema de tons semânticos. Use SEMPRE estes ao representar estado/status:
 * - success: ativo, ok, completo, pago, ocupada
 * - warning: pendente, atenção, incompleto
 * - danger:  atrasado, crítico, erro
 * - neutral: vago, inativo, encerrado, isento
 * - info:    informativo, em análise
 */
export type BadgeTone = 'success' | 'warning' | 'danger' | 'neutral' | 'info';

const toneMap: Record<BadgeTone, { classes: string; dot: string }> = {
  success: {
    classes:
      'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/25',
    dot: 'bg-emerald-500 dark:bg-emerald-400',
  },
  warning: {
    classes:
      'bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/25',
    dot: 'bg-amber-500 dark:bg-amber-400',
  },
  danger: {
    classes:
      'bg-rose-500/15 text-rose-700 dark:text-rose-300 ring-1 ring-rose-500/25',
    dot: 'bg-rose-500 dark:bg-rose-400',
  },
  neutral: {
    classes:
      'bg-slate-500/15 text-slate-700 dark:text-slate-300 ring-1 ring-slate-500/20',
    dot: 'bg-slate-500 dark:bg-slate-400',
  },
  info: {
    classes:
      'bg-sky-500/15 text-sky-700 dark:text-sky-300 ring-1 ring-sky-500/25',
    dot: 'bg-sky-500 dark:bg-sky-400',
  },
};

type StatusKey = 'pending' | 'paid' | 'overdue' | 'exempt' | 'canceled';

const statusToTone: Record<StatusKey, { label: string; tone: BadgeTone }> = {
  pending: { label: 'Pendente', tone: 'warning' },
  paid: { label: 'Pago', tone: 'success' },
  overdue: { label: 'Atrasado', tone: 'danger' },
  exempt: { label: 'Isento', tone: 'neutral' },
  canceled: { label: 'Cancelada', tone: 'neutral' },
};

export function Badge({
  label,
  status,
  tone,
  showDot = true,
  className,
}: {
  label?: string;
  /** Atalho semântico para status financeiro/cobrança. Tem precedência sobre `tone`. */
  status?: StatusKey;
  /** Tom semântico explícito. Use quando `status` não cobrir o caso. */
  tone?: BadgeTone;
  showDot?: boolean;
  className?: string;
}) {
  const resolvedTone: BadgeTone = status
    ? statusToTone[status].tone
    : (tone ?? 'neutral');
  const resolvedLabel = label ?? (status ? statusToTone[status].label : '');
  const config = toneMap[resolvedTone];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-ds-pill px-2.5 py-1 text-[11px] font-semibold',
        config.classes,
        className,
      )}
    >
      {showDot && (
        <span
          className={cn('h-1.5 w-1.5 rounded-full', config.dot)}
          aria-hidden
        />
      )}
      {resolvedLabel}
    </span>
  );
}
