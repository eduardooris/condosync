import {
  CreditCard,
  Mail,
  MoreHorizontal,
  Pencil,
  Phone,
  ShieldCheck,
  Trash2,
  UserRound,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@radix-ui/react-dropdown-menu';
import type { Resident } from '@/shared/types/api';
import { cn } from '@/shared/utils/cn';

const AVATAR_GRADIENTS = [
  'from-violet-500 to-fuchsia-500',
  'from-sky-500 to-cyan-400',
  'from-amber-500 to-orange-500',
  'from-emerald-500 to-teal-400',
  'from-rose-500 to-pink-500',
  'from-indigo-500 to-blue-500',
];

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

function pickGradient(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
}

interface ResidentRowProps {
  resident: Resident;
  canEdit: boolean;
  /** Quando true, mostra spinner inline no botão "Definir responsável". */
  isMutating?: boolean;
  onEdit: () => void;
  onMakeResponsible: () => void;
  onRemove: () => void;
}

/**
 * Linha de morador na lista da unidade. Dense layout: avatar, nome+badges,
 * contato em uma linha secundária, ações num menu drop-down ao final.
 */
export function ResidentRow({
  resident,
  canEdit,
  isMutating = false,
  onEdit,
  onMakeResponsible,
  onRemove,
}: ResidentRowProps) {
  const hasAppAccess = Boolean((resident as { userId?: string | null }).userId);

  return (
    <li
      className={cn(
        'group flex flex-wrap items-center gap-3 rounded-ds-xl border border-ds-stroke/40 bg-ds-surface/30 p-3',
        'transition hover:border-ds-stroke hover:bg-ds-surface/60',
        isMutating && 'animate-pulse',
      )}
    >
      <div
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white shadow-ds-sm',
          'bg-gradient-to-br',
          pickGradient(resident.id),
        )}
        aria-hidden
      >
        {getInitials(resident.fullName)}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="truncate text-ds-sm font-semibold text-ds-body">
            {resident.fullName}
          </p>
          {resident.isFinancialResponsible ? (
            <span className="inline-flex items-center gap-1 rounded-ds-md bg-emerald-500/15 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
              <ShieldCheck className="h-3 w-3" aria-hidden />
              Responsável
            </span>
          ) : null}
          {hasAppAccess ? (
            <span className="rounded-ds-md bg-brand-500/15 px-1.5 py-0.5 text-[11px] font-semibold text-brand-700 dark:text-brand-300">
              App ativo
            </span>
          ) : (
            <span className="rounded-ds-md bg-ds-surface px-1.5 py-0.5 text-[11px] font-semibold text-ds-subtle">
              Sem app
            </span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-ds-dim">
          <span className="inline-flex items-center gap-1">
            <CreditCard className="h-3 w-3" aria-hidden />
            {resident.cpf}
          </span>
          {resident.phoneWhatsapp ? (
            <span className="inline-flex items-center gap-1">
              <Phone className="h-3 w-3" aria-hidden />
              {resident.phoneWhatsapp}
            </span>
          ) : null}
          {resident.email ? (
            <span className="inline-flex items-center gap-1 truncate">
              <Mail className="h-3 w-3 shrink-0" aria-hidden />
              <span className="truncate">{resident.email}</span>
            </span>
          ) : null}
        </div>
      </div>

      {canEdit ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="rounded-ds-md p-2 text-ds-subtle transition hover:bg-ds-surface hover:text-ds-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-focus"
              aria-label={`Ações para ${resident.fullName}`}
            >
              <MoreHorizontal className="h-4 w-4" aria-hidden />
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
              Editar dados
            </DropdownMenuItem>
            {!resident.isFinancialResponsible ? (
              <DropdownMenuItem
                className="flex cursor-pointer items-center gap-2 rounded-ds-md px-2 py-1.5 text-ds-body outline-none transition hover:bg-ds-surface data-[highlighted]:bg-ds-surface"
                onSelect={() => onMakeResponsible()}
                disabled={isMutating}
              >
                <UserRound className="h-3.5 w-3.5" aria-hidden />
                Definir como responsável
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator className="my-1 h-px bg-ds-stroke/60" />
            <DropdownMenuItem
              className="flex cursor-pointer items-center gap-2 rounded-ds-md px-2 py-1.5 text-ds-danger outline-none transition hover:bg-ds-danger/10 data-[highlighted]:bg-ds-danger/10"
              onSelect={() => onRemove()}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              Remover morador
            </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenuPortal>
        </DropdownMenu>
      ) : null}
    </li>
  );
}
