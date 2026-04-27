import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Building2, ChevronDown } from 'lucide-react';
import { condominiumsService } from '@/domains/condominiums/services/condominiums.service';
import { useAuthStore } from '@/shared/stores/auth.store';
import { canAccessCondominiumAdminRoutes } from '@/shared/utils/roles';
import { queryKeys } from '@/shared/lib/queryKeys';
import { cn } from '@/shared/utils/cn';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/Dialog';
import { CondominiumPickerContent } from '@/shared/components/layout/CondominiumPickerContent';

interface MobileCondominiumSheetProps {
  onOpenCommandPalette?: () => void;
}

const chipClassName = cn(
  'flex max-w-[min(11rem,42vw)] shrink-0 items-center gap-1.5 rounded-ds-md border px-2 py-1.5 text-left ds-sm:max-w-[min(14rem,38vw)] ds-sm:gap-2 ds-sm:px-2.5 ds-sm:py-2',
);

export function MobileCondominiumSheet({ onOpenCommandPalette }: MobileCondominiumSheetProps) {
  const [open, setOpen] = useState(false);
  const active = useAuthStore((s) => s.activeCondominium);
  const setActive = useAuthStore((s) => s.setActiveCondominium);
  const role = useAuthStore((s) => s.role);
  const showAdmin = canAccessCondominiumAdminRoutes(role);

  const { data: condominiums } = useQuery({
    queryKey: queryKeys.condominiums.mine(),
    queryFn: condominiumsService.listMine,
  });

  const list = condominiums ?? [];
  if (list.length === 0) return null;

  const multi = list.length > 1;
  const label = active?.name ?? 'Condomínio';

  const chipInner = (
    <>
      <Building2
        className={cn('h-3.5 w-3.5 shrink-0 text-brand-700 dark:text-brand-300', multi && 'ds-sm:h-4 ds-sm:w-4')}
        strokeWidth={2}
        aria-hidden
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[10px] font-semibold uppercase tracking-wide text-ds-subtle">Condomínio</span>
        <span className="block truncate text-ds-xs font-semibold leading-tight text-ds-body ds-sm:text-ds-sm">{label}</span>
      </span>
      {multi ? (
        <ChevronDown
          className={cn('h-3.5 w-3.5 shrink-0 text-ds-subtle transition-transform', open && 'rotate-180 text-brand-700 dark:text-brand-300')}
          aria-hidden
        />
      ) : null}
    </>
  );

  if (!multi) {
    return (
      <div
        className={cn(chipClassName, 'pointer-events-none border-transparent bg-transparent px-1 py-1.5 opacity-90 dark:opacity-80')}
        aria-label={`Condomínio ativo: ${label}`}
      >
        {chipInner}
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          chipClassName,
          'border-ds-stroke-subtle bg-ds-surface transition active:scale-[0.98] dark:border-white/[0.08] dark:bg-white/[0.04]',
        )}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Trocar condomínio. Atual: ${label}`}
      >
        {chipInner}
      </button>

      <DialogContent
        className={cn(
          'fixed inset-x-0 bottom-0 left-0 right-auto top-auto z-50 max-h-[min(88dvh,32rem)] w-full max-w-none translate-x-0 translate-y-0 rounded-none rounded-t-2xl border-x-0 border-b-0 p-0 pb-[env(safe-area-inset-bottom,0px)] shadow-2xl',
          'data-[state=open]:slide-in-from-bottom-[6%] data-[state=open]:zoom-in-100',
          'data-[state=closed]:slide-out-to-bottom-[4%]',
        )}
      >
        <div className="flex justify-center pb-1 pt-3" aria-hidden>
          <span className="h-1 w-10 rounded-full bg-ds-stroke-strong/80 dark:bg-white/20" />
        </div>
        <DialogHeader className="space-y-1 px-4 pb-2 pt-1 text-left">
          <DialogTitle className="text-ds-lg">Trocar condomínio</DialogTitle>
          <DialogDescription className="text-ds-sm">
            Escolha onde você quer trabalhar. Menus e dados mudam conforme o condomínio.
          </DialogDescription>
        </DialogHeader>
        <CondominiumPickerContent
          condominiums={list}
          active={active}
          showAdmin={showAdmin}
          variant="sheet"
          onDismiss={() => setOpen(false)}
          onSelect={(condo) => {
            setActive({
              id: condo.id,
              name: condo.name,
              role: condo.role,
              unitId: condo.unitId,
            });
            setOpen(false);
          }}
          onOpenCommandPalette={() => {
            setOpen(false);
            onOpenCommandPalette?.();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
