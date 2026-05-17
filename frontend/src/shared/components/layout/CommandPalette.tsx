import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  ArrowRight,
  BarChart2,
  Building2,
  ClipboardList,
  FileText,
  FolderOpen,
  LayoutDashboard,
  Newspaper,
  Plus,
  Receipt,
  Search,
  Settings,
} from 'lucide-react';
import { queryKeys } from '@/shared/lib/queryKeys';
import { useNavigate } from 'react-router-dom';
import { condominiumsService } from '@/domains/condominiums/services/condominiums.service';
import { useAuthStore } from '@/shared/stores/auth.store';
import { canAccessCondominiumAdminRoutes } from '@/shared/utils/roles';
import { cn } from '@/shared/utils/cn';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

interface PaletteItem {
  id: string;
  label: string;
  hint?: string;
  group: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  onSelect: () => void;
}

const NAV_ITEMS: { to: string; label: string; icon: PaletteItem['icon']; admin?: boolean }[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/charges', label: 'Cobranças', icon: Receipt },
  { to: '/expenses', label: 'Despesas', icon: FileText },
  { to: '/bulletin', label: 'Mural de recados', icon: Newspaper },
  { to: '/documents', label: 'Documentos', icon: FolderOpen },
  { to: '/occurrences', label: 'Ocorrências', icon: ClipboardList },
  { to: '/polls', label: 'Enquetes', icon: BarChart2 },
  { to: '/units', label: 'Unidades & moradores', icon: Building2, admin: true },
  { to: '/settings', label: 'Configurações', icon: Settings },
];

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const reduce = useReducedMotion();

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[12vh]"
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          role="dialog"
          aria-modal="true"
          aria-label="Paleta de comandos"
        >
          <div
            className="absolute inset-0 bg-[var(--ds-scrim-bg)] backdrop-blur-md"
            onClick={onClose}
            aria-hidden
          />
          <PaletteContent onClose={onClose} />
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function PaletteContent({ onClose }: { onClose: () => void }) {
  const reduce = useReducedMotion();
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.role);
  const setActiveCondominium = useAuthStore((s) => s.setActiveCondominium);
  const activeCondoId = useAuthStore((s) => s.activeCondominium?.id);
  const showAdmin = canAccessCondominiumAdminRoutes(role);

  const { data: condominiums } = useQuery({
    queryKey: queryKeys.condominiums.mine(),
    queryFn: condominiumsService.listMine,
  });

  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);

  const items = useMemo<PaletteItem[]>(() => {
    const navItems: PaletteItem[] = NAV_ITEMS.filter((item) => !item.admin || showAdmin).map((item) => ({
      id: `nav-${item.to}`,
      label: item.label,
      group: 'Navegar',
      icon: item.icon,
      onSelect: () => {
        navigate(item.to);
        onClose();
      },
    }));

    const condoItems: PaletteItem[] = (condominiums ?? []).map((condo) => ({
      id: `condo-${condo.id}`,
      label: condo.name,
      hint: condo.id === activeCondoId ? 'ativo' : 'trocar para este condomínio',
      group: 'Condomínios',
      icon: Building2,
      onSelect: () => {
        setActiveCondominium({
          id: condo.id,
          name: condo.name,
          role: condo.role,
          unitId: condo.unitId,
        });
        navigate('/');
        onClose();
      },
    }));

    const actionItems: PaletteItem[] = showAdmin
      ? [
          {
            id: 'action-setup',
            label: 'Adicionar novo condomínio',
            hint: 'Iniciar setup assistant',
            group: 'Ações',
            icon: Plus,
            onSelect: () => {
              navigate('/setup');
              onClose();
            },
          },
        ]
      : [];

    const all = [...condoItems, ...navItems, ...actionItems];
    if (!query.trim()) return all;
    const q = query.toLowerCase();
    return all.filter((item) => item.label.toLowerCase().includes(q) || item.hint?.toLowerCase().includes(q));
  }, [condominiums, query, showAdmin, activeCondoId, navigate, onClose, setActiveCondominium]);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, items.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        items[activeIdx]?.onSelect();
      }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [items, activeIdx, onClose]);

  const grouped = useMemo(() => {
    const groups: Record<string, PaletteItem[]> = {};
    items.forEach((item) => {
      groups[item.group] = groups[item.group] ?? [];
      groups[item.group]!.push(item);
    });
    return groups;
  }, [items]);

  function handleQueryChange(value: string) {
    setQuery(value);
    setActiveIdx(0);
  }

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: -12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
      className="relative w-full max-w-xl overflow-hidden rounded-ds-2xl border border-ds-stroke-strong bg-[var(--ds-floating-panel-bg)] shadow-2xl backdrop-blur-xl"
    >
      <div className="flex items-center gap-3 border-b border-ds-stroke-subtle px-4 py-3">
        <Search className="h-4 w-4 text-ds-subtle" strokeWidth={2} aria-hidden />
        <input
          autoFocus
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          placeholder="Buscar condomínio, página ou ação…"
          className="flex-1 bg-transparent text-ds-md text-ds-body placeholder:text-ds-subtle focus:outline-none"
        />
        <kbd className="hidden rounded-ds-sm border border-ds-stroke bg-white/[0.04] px-1.5 py-0.5 text-[11px] font-semibold text-ds-subtle ds-sm:inline">
          Esc
        </kbd>
      </div>

      <div className="max-h-[50vh] overflow-y-auto p-2">
        {items.length === 0 ? (
          <div className="px-3 py-8 text-center text-ds-sm text-ds-subtle">Nenhum resultado</div>
        ) : (
          Object.entries(grouped).map(([group, groupItems]) => (
            <div key={group} className="mb-2 last:mb-0">
              <p className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-widest text-ds-dim dark:text-brand-300/70">
                {group}
              </p>
              <ul className="space-y-0.5">
                {groupItems.map((item) => {
                  const idx = items.indexOf(item);
                  const active = idx === activeIdx;
                  const Icon = item.icon;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onMouseEnter={() => setActiveIdx(idx)}
                        onClick={item.onSelect}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-ds-lg px-3 py-2 text-left transition',
                          active
                            ? 'bg-gradient-to-r from-brand-400/20 to-brand-500/5 text-brand-900 dark:text-white'
                            : 'text-ds-body hover:bg-ds-surface dark:hover:bg-white/[0.04]',
                        )}
                      >
                        <Icon
                          className={cn(
                            'h-4 w-4 shrink-0',
                            active ? 'text-brand-700 dark:text-brand-300' : 'text-brand-700/50 dark:text-brand-300/50',
                          )}
                          strokeWidth={active ? 2 : 1.75}
                          aria-hidden
                        />
                        <span className="flex-1 truncate text-ds-sm font-medium">{item.label}</span>
                        {item.hint ? <span className="text-ds-xs text-ds-subtle">{item.hint}</span> : null}
                        {active ? (
                          <ArrowRight className="h-3.5 w-3.5 text-brand-700 dark:text-brand-300" aria-hidden />
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </div>

      <div className="flex items-center justify-between border-t border-ds-stroke-subtle px-4 py-2 text-[11px] text-ds-subtle">
        <span>
          <kbd className="mr-1 rounded-ds-sm border border-ds-stroke bg-white/[0.04] px-1 py-0.5 font-semibold">↑↓</kbd>
          navegar
          <kbd className="mx-1 rounded-ds-sm border border-ds-stroke bg-white/[0.04] px-1 py-0.5 font-semibold">↵</kbd>
          selecionar
        </span>
        <span>
          <kbd className="rounded-ds-sm border border-ds-stroke bg-white/[0.04] px-1 py-0.5 font-semibold">⌘K</kbd> abrir
        </span>
      </div>
    </motion.div>
  );
}
