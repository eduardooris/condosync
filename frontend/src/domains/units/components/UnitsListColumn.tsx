import { useMemo, useState } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import { Input } from '@/shared/components/ui/Input';
import type { Unit } from '@/shared/types/api';
import type { UnitOnboardingChecklistItem } from '@/domains/units/services/units.service';
import { cn } from '@/shared/utils/cn';
import { UnitListItem } from './UnitListItem';

type StatusFilter = 'all' | 'OCCUPIED' | 'VACANT' | 'ONBOARDING';

interface UnitsListColumnProps {
  units: Unit[];
  checklistByUnitId: Map<string, UnitOnboardingChecklistItem>;
  selectedUnitId: string | null;
  onSelect: (unit: Unit) => void;
  /** Pintado mais discreto e usado para descrever um estado vazio contextual. */
  emptyState?: React.ReactNode;
}

/**
 * Coluna lateral (desktop) e tela completa (mobile) da lista de unidades.
 * Inclui busca, filtros por status/onboarding e agrupamento por bloco
 * colapsável. Não controla criação — só seleção.
 */
export function UnitsListColumn({
  units,
  checklistByUnitId,
  selectedUnitId,
  onSelect,
  emptyState,
}: UnitsListColumnProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [collapsedBlocks, setCollapsedBlocks] = useState<Set<string>>(new Set());

  const counts = useMemo(() => {
    const occupied = units.filter((u) => u.status === 'OCCUPIED').length;
    const vacant = units.filter((u) => u.status === 'VACANT').length;
    const onboardingIncomplete = units.filter(
      (u) => !(checklistByUnitId.get(u.id)?.isReady ?? false),
    ).length;
    return { total: units.length, occupied, vacant, onboardingIncomplete };
  }, [units, checklistByUnitId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return units.filter((unit) => {
      if (statusFilter === 'OCCUPIED' && unit.status !== 'OCCUPIED') return false;
      if (statusFilter === 'VACANT' && unit.status !== 'VACANT') return false;
      if (statusFilter === 'ONBOARDING') {
        const ck = checklistByUnitId.get(unit.id);
        if (ck?.isReady) return false;
      }
      if (q) {
        const blob = `${unit.block} ${unit.number}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [units, search, statusFilter, checklistByUnitId]);

  const groupedByBlock = useMemo(() => {
    const groups = new Map<string, Unit[]>();
    for (const unit of filtered) {
      const arr = groups.get(unit.block) ?? [];
      arr.push(unit);
      groups.set(unit.block, arr);
    }
    return Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b, 'pt-BR', { numeric: true }))
      .map(([block, blockUnits]) => ({
        block,
        units: blockUnits.sort((a, b) =>
          a.number.localeCompare(b.number, 'pt-BR', { numeric: true }),
        ),
      }));
  }, [filtered]);

  const toggleBlock = (block: string) =>
    setCollapsedBlocks((prev) => {
      const next = new Set(prev);
      if (next.has(block)) next.delete(block);
      else next.add(block);
      return next;
    });

  const chips: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: `Todas · ${counts.total}` },
    { value: 'OCCUPIED', label: `Ocupadas · ${counts.occupied}` },
    { value: 'VACANT', label: `Vagas · ${counts.vacant}` },
    { value: 'ONBOARDING', label: `Onboarding · ${counts.onboardingIncomplete}` },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="space-y-3 px-1 pb-3">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ds-subtle"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar bloco ou número"
            className="pl-9 pr-9"
            aria-label="Buscar unidade"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-ds-md p-1 text-ds-subtle hover:bg-ds-elevated hover:text-ds-body"
              aria-label="Limpar busca"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <button
              key={chip.value}
              type="button"
              onClick={() => setStatusFilter(chip.value)}
              className={cn(
                'rounded-ds-pill px-2.5 py-1 text-[11px] font-semibold transition',
                statusFilter === chip.value
                  ? 'bg-brand-500/20 text-brand-700 ring-1 ring-brand-500/40 dark:text-brand-300'
                  : 'bg-ds-surface text-ds-dim ring-1 ring-ds-stroke hover:bg-ds-elevated dark:bg-white/[0.03] dark:hover:bg-white/[0.06]',
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-1 pb-2">
        {units.length === 0 ? (
          emptyState ?? (
            <p className="rounded-ds-xl border border-dashed border-ds-stroke/60 bg-ds-surface/20 px-4 py-8 text-center text-ds-sm text-ds-dim">
              Nenhuma unidade cadastrada.
            </p>
          )
        ) : filtered.length === 0 ? (
          <p className="rounded-ds-xl border border-dashed border-ds-stroke/60 bg-ds-surface/20 px-4 py-6 text-center text-ds-xs text-ds-dim">
            Nenhuma unidade corresponde aos filtros.
          </p>
        ) : (
          <div className="space-y-3">
            {groupedByBlock.map(({ block, units: blockUnits }) => {
              const isCollapsed = collapsedBlocks.has(block);
              return (
                <div key={block} className="space-y-1">
                  <button
                    type="button"
                    onClick={() => toggleBlock(block)}
                    className="flex w-full items-center gap-2 px-2 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-ds-subtle transition hover:text-ds-body"
                    aria-expanded={!isCollapsed}
                  >
                    <ChevronDown
                      className={cn(
                        'h-3 w-3 shrink-0 transition',
                        isCollapsed && '-rotate-90',
                      )}
                      aria-hidden
                    />
                    Bloco {block}
                    <span className="font-normal text-ds-dim">· {blockUnits.length}</span>
                  </button>
                  {!isCollapsed ? (
                    <div className="space-y-1">
                      {blockUnits.map((unit) => (
                        <UnitListItem
                          key={unit.id}
                          unit={unit}
                          checklist={checklistByUnitId.get(unit.id) ?? null}
                          selected={selectedUnitId === unit.id}
                          onSelect={() => onSelect(unit)}
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
