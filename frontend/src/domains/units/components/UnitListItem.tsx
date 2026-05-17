import { ChevronRight } from 'lucide-react';
import type { Unit } from '@/shared/types/api';
import type { UnitOnboardingChecklistItem } from '@/domains/units/services/units.service';
import { cn } from '@/shared/utils/cn';

interface UnitListItemProps {
  unit: Unit;
  checklist: UnitOnboardingChecklistItem | null;
  selected: boolean;
  onSelect: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  OCCUPIED: 'Ocupada',
  VACANT: 'Vaga',
};

/**
 * Item de unidade na coluna lista. Densidade alta, info-dense:
 * - chip do número/bloco como avatar à esquerda
 * - status, contagem de moradores e indicador de readiness do onboarding
 * - chevron visível no hover (desktop)
 */
export function UnitListItem({ unit, checklist, selected, onSelect }: UnitListItemProps) {
  const isReady = checklist?.isReady ?? false;
  const hasResidents = checklist?.hasResidents ?? false;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected ? 'true' : undefined}
      className={cn(
        'group flex w-full items-center gap-3 rounded-ds-xl border px-3 py-2.5 text-left transition',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-focus',
        selected
          ? 'border-brand-500/40 bg-brand-500/[0.08] text-ds-body shadow-ds-sm'
          : 'border-transparent text-ds-body hover:border-ds-stroke/50 hover:bg-ds-surface/60',
      )}
    >
      <div
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-ds-lg text-[11px] font-bold tabular-nums',
          'bg-gradient-to-br ring-1 ring-inset',
          selected
            ? 'from-brand-400/30 to-brand-600/20 text-brand-100 ring-brand-400/40'
            : 'from-ds-surface to-ds-surface/40 text-ds-body ring-ds-stroke/40',
        )}
        aria-hidden
      >
        {unit.number || '·'}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <p className="truncate text-ds-sm font-semibold">
            {unit.block ? `Bloco ${unit.block}` : 'Unidade'}{' '}
            <span className="text-ds-dim">· {unit.number}</span>
          </p>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-ds-dim">
          <span
            className={cn(
              'inline-flex items-center gap-1',
              unit.status === 'OCCUPIED' ? 'text-emerald-600 dark:text-emerald-400' : 'text-ds-subtle',
            )}
          >
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                unit.status === 'OCCUPIED' ? 'bg-emerald-500' : 'bg-ds-subtle',
              )}
              aria-hidden
            />
            {STATUS_LABELS[unit.status] ?? unit.status}
          </span>
          {!hasResidents ? (
            <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden />
              Sem morador
            </span>
          ) : !isReady ? (
            <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden />
              Onboarding {checklist ? `${checklist.score}/5` : '—'}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
              Pronta
            </span>
          )}
        </div>
      </div>

      <ChevronRight
        className={cn(
          'h-4 w-4 shrink-0 text-ds-subtle transition',
          selected ? 'text-brand-300' : 'opacity-0 group-hover:opacity-100',
        )}
        aria-hidden
      />
    </button>
  );
}
