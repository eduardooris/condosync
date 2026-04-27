import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { condominiumsService } from '@/domains/condominiums/services/condominiums.service';
import { useAuthStore } from '@/shared/stores/auth.store';
import { canAccessCondominiumAdminRoutes } from '@/shared/utils/roles';
import { cn } from '@/shared/utils/cn';
import { queryKeys } from '@/shared/lib/queryKeys';
import { CondominiumPickerContent } from '@/shared/components/layout/CondominiumPickerContent';

interface CondoSwitcherProps {
  onOpenCommandPalette?: () => void;
}

function condoInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function CondoSwitcher({ onOpenCommandPalette }: CondoSwitcherProps) {
  const reduce = useReducedMotion();
  const role = useAuthStore((s) => s.role);
  const active = useAuthStore((s) => s.activeCondominium);
  const setActive = useAuthStore((s) => s.setActiveCondominium);
  const showAdmin = canAccessCondominiumAdminRoutes(role);

  const { data: condominiums } = useQuery({
    queryKey: queryKeys.condominiums.mine(),
    queryFn: condominiumsService.listMine,
  });

  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  const list = condominiums ?? [];
  const initials = active ? condoInitials(active.name) : '·';

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex w-full items-center gap-2.5 rounded-ds-xl border border-ds-stroke-subtle bg-ds-surface px-2.5 py-2 text-left transition dark:bg-white/[0.03]',
          'hover:border-brand-400/30 hover:bg-ds-elevated dark:hover:bg-white/[0.06]',
          open && 'border-brand-400/40 bg-ds-elevated dark:bg-white/[0.06]',
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-ds-lg bg-gradient-to-br from-brand-300 to-brand-600 text-[11px] font-bold text-white shadow-md shadow-brand-500/30">
          {initials}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-ds-sm font-semibold text-ds-body">
            {active?.name ?? 'Selecionar condomínio'}
          </span>
          <span className="block text-[10px] font-medium uppercase tracking-widest text-ds-subtle dark:text-brand-300/60">
            {list.length} {list.length === 1 ? 'condomínio' : 'condomínios'}
          </span>
        </span>
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 shrink-0 text-ds-subtle transition-transform',
            open && 'rotate-180 text-brand-700 dark:text-brand-300',
          )}
          aria-hidden
        />
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={reduce ? false : { opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 origin-top overflow-hidden rounded-ds-xl border border-ds-stroke-strong bg-[var(--ds-floating-panel-bg)] shadow-2xl backdrop-blur-xl"
          >
            <CondominiumPickerContent
              condominiums={list}
              active={active}
              showAdmin={showAdmin}
              variant="popover"
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
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
