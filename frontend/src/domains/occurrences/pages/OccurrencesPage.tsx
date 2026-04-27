import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ClipboardList, Building2, Plus, Clock, CheckCircle, Search } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import { Button } from '@/shared/components/ui/Button';
import { DialogFooter, FormDialog } from '@/shared/components/ui/Dialog';
import { EmptyState } from '@/shared/components/ui/EmptyState';
import { FormField } from '@/shared/components/ui/FormField';
import { Input } from '@/shared/components/ui/Input';
import { PageHeader } from '@/shared/components/ui/PageHeader';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/Select';
import { Spinner } from '@/shared/components/ui/Spinner';
import { Textarea } from '@/shared/components/ui/Textarea';
import { useOccurrencesPage } from '@/domains/occurrences/hooks/useOccurrencesPage';
import {
  occurrenceFormSchema,
  type OccurrenceFormValues,
} from '@/domains/occurrences/schemas/occurrences.schema';
import {
  formatUnitBlockNumber,
  useUnitsForCurrentMember,
} from '@/domains/units/hooks/useUnits';
import { useAuthStore } from '@/shared/stores/auth.store';
import { canAccessCondominiumAdminRoutes } from '@/shared/utils/roles';
import { cn } from '@/shared/utils/cn';

type StatusTab = 'all' | 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED';

const statusConfig = {
  OPEN: {
    label: 'Aberta',
    classes: 'bg-amber-500/15 text-amber-400 ring-1 ring-amber-400/25',
    dot: 'bg-amber-400',
    border: 'border-l-amber-400',
  },
  UNDER_REVIEW: {
    label: 'Em análise',
    classes: 'bg-brand-400/15 text-brand-800 ring-1 ring-brand-400/25 dark:text-brand-300',
    dot: 'bg-brand-600 dark:bg-brand-300',
    border: 'border-l-brand-400',
  },
  RESOLVED: {
    label: 'Resolvida',
    classes: 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-400/25',
    dot: 'bg-emerald-400',
    border: 'border-l-emerald-500',
  },
} as const;

const statusTabs: { key: StatusTab; label: string }[] = [
  { key: 'all', label: 'Todas' },
  { key: 'OPEN', label: 'Abertas' },
  { key: 'UNDER_REVIEW', label: 'Em análise' },
  { key: 'RESOLVED', label: 'Resolvidas' },
];

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  show: (i: number) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.25, delay: i * 0.06, ease: [0.25, 0.1, 0.25, 1] as const },
  }),
  exit: { opacity: 0, scale: 0.97, transition: { duration: 0.18 } },
};

function OccStatusBadge({ status }: { status: string }) {
  const cfg = statusConfig[status as keyof typeof statusConfig];
  if (!cfg) return <span className="text-ds-xs text-ds-dim">{status}</span>;
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-ds-pill px-2.5 py-1 text-[11px] font-bold', cfg.classes)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dot)} aria-hidden />
      {cfg.label}
    </span>
  );
}

export function OccurrencesPage() {
  const condo = useAuthStore((state) => state.activeCondominium);
  const role = useAuthStore((state) => state.role);
  const canModerate = role === 'ADMIN' || role === 'SUB_ADMIN';
  const [activeTab, setActiveTab] = useState<StatusTab>('all');
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const form = useForm<OccurrenceFormValues>({
    resolver: zodResolver(occurrenceFormSchema),
    defaultValues: { unitId: '', title: '', category: '', description: '', isAnonymous: false },
  });

  const { units: unitList, isLoading: loadingUnits } = useUnitsForCurrentMember(condo?.id);
  const { occurrencesQuery, createMutation, statusMutation } = useOccurrencesPage(condo?.id);

  if (!condo?.id) {
    return <p className="ds-page text-ds-sm text-ds-dim">Selecione um condomínio.</p>;
  }
  if (loadingUnits || occurrencesQuery.isLoading) return <Spinner />;

  const hasUnits = unitList.length > 0;
  const canOpenUnitsSettings = canAccessCondominiumAdminRoutes(role);

  let occList = occurrencesQuery.data ?? [];
  if (activeTab !== 'all') occList = occList.filter((o) => o.status === activeTab);
  if (search.trim()) {
    const q = search.toLowerCase();
    occList = occList.filter(
      (o) => o.title?.toLowerCase().includes(q) || o.category?.toLowerCase().includes(q),
    );
  }

  const counts = {
    all: (occurrencesQuery.data ?? []).length,
    OPEN: (occurrencesQuery.data ?? []).filter((o) => o.status === 'OPEN').length,
    UNDER_REVIEW: (occurrencesQuery.data ?? []).filter((o) => o.status === 'UNDER_REVIEW').length,
    RESOLVED: (occurrencesQuery.data ?? []).filter((o) => o.status === 'RESOLVED').length,
  };

  return (
    <div className="ds-page mx-auto max-w-4xl space-y-5">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <PageHeader
          title="Ocorrências"
          description={`${counts.all} ocorrência${counts.all !== 1 ? 's' : ''}`}
          actions={
            hasUnits ? (
              <Button variant="gradient" size="sm" onClick={() => setDialogOpen(true)}>
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Nova ocorrência
              </Button>
            ) : undefined
          }
        />
      </motion.div>

      {hasUnits && (
        <FormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          title="Nova ocorrência"
          description="Preencha os dados para registrar uma nova ocorrência."
        >
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit((v) =>
              createMutation.mutate(v, {
                onSuccess: () => {
                  toast.success('Ocorrência registrada com sucesso!');
                  form.reset();
                  setDialogOpen(false);
                },
                onError: () => {
                  toast.error('Erro ao registrar ocorrência. Tente novamente.');
                },
              }),
            )}
          >
            <FormField label="Unidade" htmlFor="occ-unit" required>
              <Controller
                control={form.control}
                name="unitId"
                rules={{ required: true }}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="occ-unit">
                      <SelectValue placeholder="Selecione a unidade…" />
                    </SelectTrigger>
                    <SelectContent>
                      {unitList.map((unit) => (
                        <SelectItem key={unit.id} value={unit.id}>
                          {formatUnitBlockNumber(unit)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>

            <div className="grid grid-cols-1 gap-4 ds-sm:grid-cols-2">
              <FormField label="Título" htmlFor="occ-title" required>
                <Input
                  id="occ-title"
                  placeholder="Ex: Vazamento no hall"
                  {...form.register('title', { required: true })}
                />
              </FormField>

              <FormField label="Categoria" htmlFor="occ-category" required>
                <Input
                  id="occ-category"
                  placeholder="Ex: Manutenção"
                  {...form.register('category', { required: true })}
                />
              </FormField>
            </div>

            <FormField label="Descrição" htmlFor="occ-description" required>
              <Textarea
                id="occ-description"
                placeholder="Descreva a ocorrência com detalhes…"
                {...form.register('description', { required: true })}
              />
            </FormField>

            <label className="flex cursor-pointer items-center gap-2 text-ds-sm text-ds-dim">
              <input
                type="checkbox"
                className="h-4 w-4 rounded-ds-sm border-ds-stroke bg-ds-elevated text-ds-action focus:ring-2 focus:ring-ds-focus"
                {...form.register('isAnonymous')}
              />
              Ocultar minha identidade para outros moradores
            </label>

            <DialogFooter>
              <Button variant="secondary" type="button" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" variant="gradient" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Registrando…' : 'Registrar ocorrência'}
              </Button>
            </DialogFooter>
          </form>
        </FormDialog>
      )}

      {!hasUnits && (
        <EmptyState
          icon={Building2}
          title={
            canOpenUnitsSettings
              ? 'Cadastre unidades para registrar ocorrências'
              : 'Unidade não vinculada ao seu acesso'
          }
          description="Cada ocorrência fica vinculada a uma unidade — vazamento, barulho, portaria, etc."
          suggestion={
            canOpenUnitsSettings
              ? 'Crie ao menos uma unidade. Depois, moradores e síndico poderão abrir chamados.'
              : 'Peça ao síndico para conferir seu cadastro de morador e a unidade vinculada ao seu usuário.'
          }
          action={canOpenUnitsSettings ? { to: '/units', label: 'Cadastrar unidades' } : undefined}
        />
      )}

      {hasUnits && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1" style={{ minWidth: 160 }}>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ds-subtle" aria-hidden />
              <Input
                type="search"
                placeholder="Buscar…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 w-full rounded-ds-md bg-[var(--ds-input-well-bg)] pl-9 pr-4 text-ds-sm text-ds-body placeholder:text-ds-subtle backdrop-blur-sm transition hover:bg-[var(--ds-input-well-bg-hover)] focus:outline-none focus:ring-2 focus:ring-amber-400/40"
              />
            </div>

            <div className="flex items-center gap-1 rounded-ds-md bg-[var(--ds-filter-track-bg)] p-1 backdrop-blur-sm">
              {statusTabs.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveTab(key)}
                  className={cn(
                    'relative rounded-ds-lg px-3 py-1 text-ds-xs font-semibold transition-all duration-200',
                    activeTab === key ? 'text-amber-950 dark:text-white' : 'text-ds-dim hover:text-ds-body',
                  )}
                >
                  {activeTab === key && (
                    <motion.div
                      layoutId="occ-tab-bg"
                      className="absolute inset-0 rounded-ds-lg bg-gradient-to-r from-amber-500/50 to-orange-600/30 dark:from-amber-400/35 dark:to-orange-500/20"
                      transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                    />
                  )}
                  <span className="relative">
                    {label}
                    {counts[key] > 0 && (
                      <span className="ml-1.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-black/10 px-1 text-[9px] font-bold dark:bg-white/10">
                        {counts[key]}
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {(occurrencesQuery.data ?? []).length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="Nenhuma ocorrência registrada"
              description="Quando houver demandas, elas aparecem nesta lista com título, categoria e situação."
              suggestion="Registre a primeira ocorrência usando o botão acima."
            />
          ) : occList.length === 0 ? (
            <div className="rounded-ds-2xl border border-dashed border-ds-stroke/60 bg-ds-surface px-6 py-10 text-center dark:bg-white/[0.03]">
              <p className="text-ds-sm text-ds-dim">Nenhuma ocorrência para este filtro.</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setActiveTab('all');
                  setSearch('');
                }}
                className="mt-3 text-amber-400 hover:text-amber-300"
              >
                Limpar filtros
              </Button>
            </div>
          ) : (
            <motion.div
              className="grid gap-3 ds-md:grid-cols-2"
              variants={{ show: { transition: { staggerChildren: 0.06 } } }}
              initial="hidden"
              animate="show"
            >
              <AnimatePresence mode="popLayout">
                {occList.map((item, i) => {
                  const statusKey = (item.status ?? 'OPEN') as keyof typeof statusConfig;
                  const cfg = statusConfig[statusKey] ?? statusConfig.OPEN;

                  return (
                    <motion.div
                      key={item.id}
                      custom={i}
                      variants={cardVariants}
                      layout
                      exit="exit"
                    >
                      <div
                        className={cn(
                          'flex flex-col gap-3 overflow-hidden rounded-ds-2xl border border-ds-stroke/60 border-l-[3px]',
                          'bg-ds-surface p-4 shadow-ds-sm backdrop-blur-sm dark:bg-white/[0.04]',
                          'transition hover:border-ds-stroke hover:-translate-y-0.5',
                          cfg.border,
                        )}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <OccStatusBadge status={item.status ?? 'OPEN'} />
                            <h3 className="mt-1.5 text-ds-sm font-bold leading-snug text-ds-body">
                              {item.title}
                            </h3>
                            <p className="mt-0.5 flex items-center gap-1 text-[11px] text-ds-subtle">
                              <Clock className="h-3 w-3" aria-hidden />
                              {item.category}
                            </p>
                          </div>
                        </div>

                        {canModerate && item.status !== 'RESOLVED' && (
                          <div className="flex gap-2 border-t border-ds-stroke/30 pt-2.5">
                            {item.status !== 'UNDER_REVIEW' && (
                              <Button
                                size="sm"
                                variant="secondary"
                                className="flex-1"
                                onClick={() => statusMutation.mutate({ id: item.id, status: 'UNDER_REVIEW' })}
                                disabled={statusMutation.isPending}
                              >
                                <Clock className="h-3 w-3" aria-hidden />
                                Em análise
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="secondary"
                              className="flex-1"
                              onClick={() => statusMutation.mutate({ id: item.id, status: 'RESOLVED' })}
                              disabled={statusMutation.isPending}
                            >
                              <CheckCircle className="h-3 w-3 text-emerald-400" aria-hidden />
                              Resolver
                            </Button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}
