import { Building2, ChevronRight } from 'lucide-react';
import type { PortariaUnit } from '@/shared/types/intercom';
import { cn } from '@/shared/utils/cn';

type Props = {
  unit: PortariaUnit;
  onSelect: (unitId: string) => void;
  disabled?: boolean;
};

export function PortariaUnitCard({ unit, onSelect, disabled }: Props) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSelect(unit.id)}
      className={cn(
        'ds-surface-elevated ds-card-hover group flex w-full items-center gap-4 rounded-ds-2xl p-4 text-left transition',
        'hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400',
        disabled && 'pointer-events-none opacity-50',
      )}
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-500/20 text-brand-400">
        <Building2 className="h-6 w-6" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-ds-base font-semibold text-ds-body">{unit.label}</p>
        <p className="text-ds-xs text-ds-dim">
          Bloco {unit.block} · {unit.number}
        </p>
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-ds-dim transition group-hover:translate-x-0.5 group-hover:text-brand-400" />
    </button>
  );
}
