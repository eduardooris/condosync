import { Building2, Check, Plus, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { MyCondominium } from '@/domains/condominiums/services/condominiums.service';
import type { CondominiumContext } from '@/shared/types/auth.types';
import type { UserRole } from '@/shared/types/auth.types';
import { cn } from '@/shared/utils/cn';

function condoInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

const ROLE_HINT: Record<UserRole, string> = {
  ADMIN: 'Administrador',
  SUB_ADMIN: 'Síndico',
  RESPONSIBLE: 'Resp. financeiro',
  RESIDENT: 'Morador',
};

export function CondominiumPickerContent({
  condominiums,
  active,
  onSelect,
  onOpenCommandPalette,
  onDismiss,
  showAdmin,
  variant = 'popover',
}: {
  condominiums: MyCondominium[];
  active: CondominiumContext | null;
  onSelect: (condo: MyCondominium) => void;
  onOpenCommandPalette?: () => void;
  /** Chamado antes de navegar (ex.: fechar sheet ou dropdown). */
  onDismiss?: () => void;
  showAdmin: boolean;
  /** `sheet` = áreas de toque maiores (mobile). */
  variant?: 'popover' | 'sheet';
}) {
  const navigate = useNavigate();
  const isSheet = variant === 'sheet';
  const rowPad = isSheet ? 'px-4 py-3.5 min-h-[3.25rem]' : 'px-3 py-2.5';

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={() => {
          onOpenCommandPalette?.();
        }}
        className={cn(
          'flex w-full items-center gap-3 border-b border-ds-stroke-subtle text-left text-ds-sm text-ds-dim transition active:bg-ds-surface dark:active:bg-white/[0.06]',
          rowPad,
        )}
      >
        <Search className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
        <span className="flex-1 font-medium">Buscar no app</span>
        <kbd className="hidden rounded-ds-sm border border-ds-stroke bg-ds-surface px-1.5 py-0.5 text-[11px] font-semibold text-ds-subtle dark:border-transparent dark:bg-white/[0.06] ds-sm:inline">
          ⌘K
        </kbd>
      </button>

      <ul className={cn('overflow-y-auto overscroll-contain py-1', isSheet ? 'max-h-[min(52dvh,22rem)]' : 'max-h-64')} role="listbox">
        {condominiums.length === 0 ? (
          <li className="px-4 py-4 text-center text-ds-sm text-ds-subtle">Nenhum condomínio vinculado.</li>
        ) : (
          condominiums.map((condo) => {
            const isActive = condo.id === active?.id;
            return (
              <li key={condo.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  onClick={() => onSelect(condo)}
                  className={cn(
                    'flex w-full items-center gap-3 text-left transition active:bg-ds-surface dark:active:bg-white/[0.06]',
                    rowPad,
                    isActive
                      ? 'bg-brand-500/15 text-ds-body ring-1 ring-inset ring-brand-400/25 dark:bg-brand-500/10'
                      : 'text-ds-body hover:bg-ds-surface/80 dark:hover:bg-white/[0.04]',
                  )}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-ds-lg bg-gradient-to-br from-brand-300/40 to-brand-600/20 text-xs font-bold text-brand-900 dark:text-brand-100">
                    {condoInitials(condo.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-ds-sm font-semibold leading-snug">{condo.name}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="truncate text-[11px] text-ds-subtle">{condo.cnpj}</span>
                      <span className="rounded-ds-pill bg-ds-surface px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-ds-dim ring-1 ring-ds-stroke/80 dark:bg-white/[0.06] dark:ring-white/10">
                        {ROLE_HINT[condo.role] ?? condo.role}
                      </span>
                    </span>
                  </span>
                  {isActive ? (
                    <Check className="h-5 w-5 shrink-0 text-brand-600 dark:text-brand-300" strokeWidth={2.25} aria-hidden />
                  ) : null}
                </button>
              </li>
            );
          })
        )}
      </ul>

      {showAdmin ? (
        <button
          type="button"
          onClick={() => {
            onDismiss?.();
            navigate('/setup');
          }}
          className={cn(
            'flex w-full items-center gap-3 border-t border-ds-stroke-subtle text-left text-ds-sm font-semibold text-brand-700 transition active:bg-brand-400/10 dark:text-brand-300 dark:active:bg-brand-500/10',
            rowPad,
          )}
        >
          <Plus className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
          Adicionar condomínio
        </button>
      ) : (
        <div className={cn('flex items-center gap-2 border-t border-ds-stroke-subtle text-[11px] text-ds-subtle', rowPad)}>
          <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Apenas o síndico pode cadastrar novos condomínios.
        </div>
      )}
    </div>
  );
}
