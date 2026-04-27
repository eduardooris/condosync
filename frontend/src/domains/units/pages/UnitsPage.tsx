import { useState } from 'react';
import { Home, Pencil, Plus } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import { Button } from '@/shared/components/ui/Button';
import { DialogFooter, FormDialog } from '@/shared/components/ui/Dialog';
import { EmptyState } from '@/shared/components/ui/EmptyState';
import { FormField } from '@/shared/components/ui/FormField';
import { GlassCard } from '@/shared/components/ui/GlassCard';
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
import { useUnits, useUnitsOnboardingChecklist } from '@/domains/units/hooks/useUnits';
import { useUnitsPage } from '@/domains/units/hooks/useUnitsPage';
import { unitFormSchema, type UnitFormInput } from '@/domains/units/schemas/unit.schema';
import { useAuthStore } from '@/shared/stores/auth.store';
import { canManageCondominiumStructure } from '@/shared/utils/roles';

const UNIT_TYPES = [
  { value: 'APARTMENT', label: 'Apartamento' },
  { value: 'HOUSE', label: 'Casa' },
  { value: 'COMMERCIAL', label: 'Comercial' },
] as const;

const UNIT_STATUSES = [
  { value: 'OCCUPIED', label: 'Ocupada' },
  { value: 'VACANT', label: 'Vaga' },
] as const;

const TYPE_LABELS: Record<string, string> = Object.fromEntries(
  UNIT_TYPES.map(({ value, label }) => [value, label]),
);

const STATUS_LABELS: Record<string, string> = Object.fromEntries(
  UNIT_STATUSES.map(({ value, label }) => [value, label]),
);

export function UnitsPage() {
  const condo = useAuthStore((state) => state.activeCondominium);
  const role = useAuthStore((state) => state.role);
  const canCreate = canManageCondominiumStructure(role);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);

  const form = useForm<UnitFormInput>({
    resolver: zodResolver(unitFormSchema),
    defaultValues: { block: '', number: '', type: 'APARTMENT', status: 'VACANT' },
  });
  const editForm = useForm<UnitFormInput>({
    resolver: zodResolver(unitFormSchema),
    defaultValues: { block: '', number: '', type: 'APARTMENT', status: 'VACANT' },
  });

  const { data, isLoading } = useUnits(condo?.id);
  const { data: onboardingChecklist = [] } = useUnitsOnboardingChecklist(condo?.id);
  const { createMutation, updateMutation } = useUnitsPage(condo?.id, editingUnitId);

  if (!condo?.id) {
    return <p className="ds-page text-ds-sm text-ds-dim">Selecione um condomínio no topo da página.</p>;
  }

  if (isLoading) return <Spinner />;

  const list = data ?? [];
  const checklistByUnitId = new Map(
    onboardingChecklist.map((item) => [item.unitId, item]),
  );

  return (
    <div className="ds-page space-y-6">
      <PageHeader
        title="Unidades"
        description="Blocos e apartamentos do condomínio. A lista é visível a todos os moradores."
        actions={
          canCreate ? (
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              Nova unidade
            </Button>
          ) : undefined
        }
      />

      {canCreate && (
        <FormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          title="Cadastrar unidade"
          description="Preencha os dados da nova unidade."
        >
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit((payload) =>
              createMutation.mutate(payload, {
                onSuccess: () => {
                  toast.success('Unidade cadastrada com sucesso!');
                  form.reset();
                  setDialogOpen(false);
                },
                onError: () => {
                  toast.error('Erro ao cadastrar unidade. Tente novamente.');
                },
              }),
            )}
          >
            <div className="grid grid-cols-1 gap-4 ds-sm:grid-cols-2">
              <FormField label="Bloco" htmlFor="unit-block" required>
                <Input
                  id="unit-block"
                  placeholder="Ex: A"
                  {...form.register('block', { required: true })}
                />
              </FormField>

              <FormField label="Número" htmlFor="unit-number" required>
                <Input
                  id="unit-number"
                  placeholder="Ex: 101"
                  {...form.register('number', { required: true })}
                />
              </FormField>
            </div>

            <FormField label="Tipo" htmlFor="unit-type">
              <Controller
                control={form.control}
                name="type"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="unit-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {UNIT_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>

            <FormField label="Status" htmlFor="unit-status">
              <Controller
                control={form.control}
                name="status"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="unit-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {UNIT_STATUSES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>

            <DialogFooter>
              <Button
                variant="secondary"
                onClick={() => setDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Salvando…' : 'Cadastrar'}
              </Button>
            </DialogFooter>
          </form>
        </FormDialog>
      )}
      {canCreate && (
        <FormDialog
          open={Boolean(editingUnitId)}
          onOpenChange={(open) => {
            if (!open) {
              setEditingUnitId(null);
              editForm.reset();
            }
          }}
          title="Editar unidade"
          description="Atualize bloco, número, tipo e status."
        >
          <form
            className="space-y-4"
            onSubmit={editForm.handleSubmit((payload) =>
              updateMutation.mutate(payload, {
                onSuccess: () => {
                  toast.success('Unidade atualizada com sucesso!');
                  setEditingUnitId(null);
                  editForm.reset();
                },
                onError: () => {
                  toast.error('Erro ao atualizar unidade. Verifique se há morador na unidade para status "vaga".');
                },
              }),
            )}
          >
            <div className="grid grid-cols-1 gap-4 ds-sm:grid-cols-2">
              <FormField label="Bloco" htmlFor="edit-unit-block" required>
                <Input
                  id="edit-unit-block"
                  {...editForm.register('block', { required: true })}
                />
              </FormField>
              <FormField label="Número" htmlFor="edit-unit-number" required>
                <Input
                  id="edit-unit-number"
                  {...editForm.register('number', { required: true })}
                />
              </FormField>
            </div>
            <FormField label="Tipo" htmlFor="edit-unit-type">
              <Controller
                control={editForm.control}
                name="type"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="edit-unit-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {UNIT_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
            <FormField label="Status" htmlFor="edit-unit-status">
              <Controller
                control={editForm.control}
                name="status"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="edit-unit-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {UNIT_STATUSES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
            <DialogFooter>
              <Button
                variant="secondary"
                type="button"
                onClick={() => {
                  setEditingUnitId(null);
                  editForm.reset();
                }}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Salvando…' : 'Salvar alterações'}
              </Button>
            </DialogFooter>
          </form>
        </FormDialog>
      )}

      {list.length === 0 ? (
        <EmptyState
          icon={Home}
          title="Nenhuma unidade cadastrada"
          description="Enquanto não houver unidades, moradores, cobranças por unidade e várias outras funções ficam bloqueadas ou incompletas."
          suggestion={
            canCreate
              ? 'Clique em "Nova unidade" ou abra o Setup Assistant para cadastrar blocos e apartamentos em lote (CSV ou gerador).'
              : 'Peça a um administrador (síndico ou subadmin no sistema) para cadastrar as unidades do seu condomínio.'
          }
          action={canCreate ? { to: '/setup', label: 'Abrir setup assistant' } : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 ds-sm:grid-cols-2 ds-lg:grid-cols-3">
          {list.map((unit) => (
            <GlassCard key={unit.id} className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-ds-xl bg-gradient-to-br from-brand-400/20 to-brand-600/10 text-brand-700 ring-1 ring-brand-400/20 dark:text-brand-300">
                <Home className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-ds-md font-semibold text-ds-body">
                  {unit.block} — {unit.number}
                </h3>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="inline-flex items-center rounded-full bg-ds-info/10 px-2.5 py-0.5 text-ds-xs font-medium text-ds-info ring-1 ring-inset ring-ds-info/20">
                    {TYPE_LABELS[unit.type] ?? unit.type}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-ds-success/10 px-2.5 py-0.5 text-ds-xs font-medium text-ds-success ring-1 ring-inset ring-ds-success/20">
                    {STATUS_LABELS[unit.status] ?? unit.status}
                  </span>
                </div>
                {(() => {
                  const checklist = checklistByUnitId.get(unit.id);
                  if (!checklist) return null;
                  return (
                    <div className="mt-3 rounded-ds-xl border border-ds-border/60 bg-ds-surface/20 p-3">
                      <p className="text-ds-xs font-semibold text-ds-body">
                        Checklist de onboarding ({checklist.score}/5)
                      </p>
                      <p className="mt-1 text-[11px] text-ds-dim">
                        {checklist.isReady
                          ? 'Unidade pronta para operação.'
                          : 'Unidade ainda com pendências para operação.'}
                      </p>
                      <ul className="mt-2 space-y-1 text-[11px] text-ds-dim">
                        <li>{checklist.hasResidents ? 'OK' : 'Pendente'} · Morador cadastrado</li>
                        <li>
                          {checklist.hasFinancialResponsible ? 'OK' : 'Pendente'} · Responsável
                          financeiro definido
                        </li>
                        <li>{checklist.hasActiveAppAccess ? 'OK' : 'Pendente'} · Acesso ao app ativo</li>
                        <li>
                          {checklist.hasPendingInvitation || checklist.hasActiveAppAccess
                            ? 'OK'
                            : 'Pendente'}{' '}
                          · Convite de acesso em andamento
                        </li>
                        <li>{checklist.hasCurrentMonthCharge ? 'OK' : 'Pendente'} · Cobrança do mês</li>
                      </ul>
                    </div>
                  );
                })()}
                {canCreate ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-3 px-0 text-brand-700 hover:text-brand-600 dark:text-brand-300 dark:hover:text-brand-200"
                    onClick={() => {
                      setEditingUnitId(unit.id);
                      editForm.reset({
                        block: unit.block,
                        number: unit.number,
                        type: unit.type as UnitFormInput['type'],
                        status: unit.status as UnitFormInput['status'],
                      });
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Editar unidade
                  </Button>
                ) : null}
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
