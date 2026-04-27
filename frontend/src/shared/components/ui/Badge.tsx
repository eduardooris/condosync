import { cn } from '@/shared/utils/cn';

type StatusKey = 'pending' | 'paid' | 'overdue' | 'exempt' | 'canceled';

const statusMap: Record<StatusKey, { label: string; classes: string; dot: string }> = {
  pending: {
    label: 'Pendente',
    classes: 'bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/25',
    dot: 'bg-amber-400',
  },
  paid: {
    label: 'Pago',
    classes: 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/25',
    dot: 'bg-emerald-400',
  },
  overdue: {
    label: 'Atrasado',
    classes: 'bg-rose-500/15 text-rose-400 ring-1 ring-rose-500/25',
    dot: 'bg-rose-400',
  },
  exempt: {
    label: 'Isento',
    classes: 'bg-slate-500/15 text-slate-400 ring-1 ring-slate-500/20',
    dot: 'bg-slate-400',
  },
  canceled: {
    label: 'Cancelada',
    classes: 'bg-zinc-600/20 text-zinc-300 ring-1 ring-zinc-500/25',
    dot: 'bg-zinc-400',
  },
};

export function Badge({
  label,
  status = 'pending',
  showDot = true,
}: {
  label?: string;
  status?: StatusKey;
  showDot?: boolean;
}) {
  const config = statusMap[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-ds-pill px-2.5 py-1 text-[11px] font-semibold',
        config.classes,
      )}
    >
      {showDot && (
        <span
          className={cn('h-1.5 w-1.5 rounded-full', config.dot)}
          aria-hidden
        />
      )}
      {label ?? config.label}
    </span>
  );
}
