import { Building2, Home, MoreHorizontal, Pencil } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuTrigger,
} from '@radix-ui/react-dropdown-menu';
import { Badge } from '@/shared/components/ui/Badge';
import { Button } from '@/shared/components/ui/Button';
import type { Unit } from '@/shared/types/api';
import type { UnitOnboardingChecklistItem } from '@/domains/units/services/units.service';
import { cn } from '@/shared/utils/cn';
import { ResidentsSection } from './ResidentsSection';

const TYPE_LABELS: Record<string, string> = {
  APARTMENT: 'Apartamento',
  HOUSE: 'Casa',
  COMMERCIAL: 'Comercial',
  STUDIO: 'Studio',
};

const STATUS_LABELS: Record<string, string> = {
  OCCUPIED: 'Ocupada',
  VACANT: 'Vaga',
  UNDER_MAINTENANCE: 'Em manutenção',
};

interface UnitDetailPanelProps {
  condominiumId: string;
  unit: Unit;
  checklist: UnitOnboardingChecklistItem | null;
  canEdit: boolean;
  onEdit: () => void;
  /** Botão "voltar" só aparece em mobile (rota dedicada). */
  onBack?: () => void;
}

export function UnitDetailPanel({
  condominiumId,
  unit,
  checklist,
  canEdit,
  onEdit,
  onBack,
}: UnitDetailPanelProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-ds-stroke/40 pb-4">
        <div className="flex min-w-0 items-start gap-3">
          {onBack ? (
            <Button variant="ghost" size="sm" onClick={onBack} aria-label="Voltar à lista">
              ←
            </Button>
          ) : null}
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-ds-xl bg-gradient-to-br from-brand-400/25 to-brand-600/15 text-brand-700 ring-1 ring-brand-400/30 dark:text-brand-300">
            <Home className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-ds-subtle">
              Unidade
            </p>
            <h2 className="truncate text-ds-xl font-bold text-ds-body">
              {unit.block ? `Bloco ${unit.block}` : 'Unidade'}
              <span className="ml-2 text-ds-dim">· {unit.number || '—'}</span>
            </h2>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge tone="info" showDot={false} label={TYPE_LABELS[unit.type] ?? unit.type} />
              <Badge
                tone={unit.status === 'OCCUPIED' ? 'success' : 'neutral'}
                label={STATUS_LABELS[unit.status] ?? unit.status}
              />
              {checklist ? (
                <Badge
                  tone={checklist.isReady ? 'success' : 'warning'}
                  label={`Onboarding ${checklist.score}/5`}
                />
              ) : null}
            </div>
          </div>
        </div>

        {canEdit ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex h-9 items-center gap-1.5 rounded-ds-md border border-ds-stroke px-3 text-ds-xs font-semibold text-ds-body transition hover:bg-ds-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-focus"
                aria-label="Mais ações"
              >
                <MoreHorizontal className="h-4 w-4" aria-hidden />
                <span>Ações</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuPortal>
              <DropdownMenuContent
                sideOffset={4}
                align="end"
                className="z-50 min-w-[200px] rounded-ds-lg border border-ds-stroke bg-[var(--ds-popover-bg)] p-1 text-ds-sm shadow-ds-elev"
              >
                <DropdownMenuItem
                  className="flex cursor-pointer items-center gap-2 rounded-ds-md px-2 py-1.5 text-ds-body outline-none transition hover:bg-ds-surface data-[highlighted]:bg-ds-surface"
                  onSelect={() => onEdit()}
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden />
                  Editar unidade
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenuPortal>
          </DropdownMenu>
        ) : null}
      </header>

      {checklist ? <UnitChecklistBanner checklist={checklist} /> : null}

      <div className="min-h-0 flex-1 overflow-y-auto pt-4">
        <ResidentsSection condominiumId={condominiumId} unit={unit} canEdit={canEdit} />
      </div>
    </div>
  );
}

function UnitChecklistBanner({ checklist }: { checklist: UnitOnboardingChecklistItem }) {
  if (checklist.isReady) return null;

  const items: { ok: boolean; label: string }[] = [
    { ok: checklist.hasResidents, label: 'Morador cadastrado' },
    { ok: checklist.hasFinancialResponsible, label: 'Responsável financeiro' },
    { ok: checklist.hasActiveAppAccess, label: 'Acesso ao app ativo' },
    {
      ok: checklist.hasPendingInvitation || checklist.hasActiveAppAccess,
      label: 'Convite enviado',
    },
    { ok: checklist.hasCurrentMonthCharge, label: 'Cobrança do mês' },
  ];

  return (
    <div className="mt-4 rounded-ds-xl border border-amber-500/20 bg-amber-500/[0.06] p-3">
      <div className="flex items-center gap-2">
        <Building2 className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" aria-hidden />
        <p className="text-ds-xs font-semibold text-ds-body">
          Onboarding pendente · {checklist.score}/5
        </p>
      </div>
      <ul className="mt-2 grid gap-1 text-[11px] text-ds-dim ds-sm:grid-cols-2">
        {items.map((item) => (
          <li key={item.label} className="flex items-center gap-1.5">
            <span
              className={cn(
                'inline-block h-1.5 w-1.5 shrink-0 rounded-full',
                item.ok ? 'bg-emerald-500' : 'bg-amber-400',
              )}
              aria-hidden
            />
            <span className={item.ok ? 'line-through opacity-70' : ''}>{item.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
