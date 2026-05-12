import { useState } from 'react';
import {
  ChevronDown,
  CreditCard,
  Home,
  Link2,
  Mail,
  Pencil,
  Phone,
  Plus,
  ShieldCheck,
  Trash2,
  UserPlus,
  UserRound,
} from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import { Button } from '@/shared/components/ui/Button';
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog';
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
import { ResidentOnboardingDialog } from '@/domains/residents/components/ResidentOnboardingDialog';
import { residentsService } from '@/domains/residents/services/residents.service';
import {
  editResidentFormSchema,
  type EditResidentFormInput,
} from '@/domains/residents/schemas/resident.schema';
import { GenerateResidentInviteDialog } from '@/domains/invitations/components/GenerateResidentInviteDialog';
import { queryKeys } from '@/shared/lib/queryKeys';
import { useAuthStore } from '@/shared/stores/auth.store';
import { canManageCondominiumStructure } from '@/shared/utils/roles';
import { cn } from '@/shared/utils/cn';
import type { Resident, Unit } from '@/shared/types/api';

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

export function UnitsPage() {
  const condo = useAuthStore((state) => state.activeCondominium);
  const role = useAuthStore((state) => state.role);
  const canCreate = canManageCondominiumStructure(role);

  const [createUnitOpen, setCreateUnitOpen] = useState(false);
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [expandedUnitId, setExpandedUnitId] = useState<string | null>(null);
  const [addResidentForUnit, setAddResidentForUnit] = useState<Unit | null>(null);

  const createForm = useForm<UnitFormInput>({
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
  const checklistByUnitId = new Map(onboardingChecklist.map((item) => [item.unitId, item]));

  return (
    <div className="ds-page space-y-6">
      <PageHeader
        title="Unidades & moradores"
        description="Cadastre os blocos/apartamentos e seus moradores. Use o link genérico para que os moradores se cadastrem sozinhos (com sua aprovação)."
        actions={
          canCreate ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setInviteOpen(true)}>
                <Link2 className="h-4 w-4" aria-hidden />
                Gerar link de cadastro
              </Button>
              <Button onClick={() => setCreateUnitOpen(true)}>
                <Plus className="h-4 w-4" aria-hidden />
                Nova unidade
              </Button>
            </div>
          ) : undefined
        }
      />

      {canCreate ? (
        <GenerateResidentInviteDialog
          open={inviteOpen}
          onOpenChange={setInviteOpen}
          condominiumId={condo.id}
        />
      ) : null}

      {canCreate ? (
        <FormDialog
          open={createUnitOpen}
          onOpenChange={setCreateUnitOpen}
          title="Cadastrar unidade"
          description="Preencha os dados da nova unidade."
        >
          <form
            className="space-y-4"
            onSubmit={createForm.handleSubmit((payload) =>
              createMutation.mutate(payload, {
                onSuccess: () => {
                  toast.success('Unidade cadastrada com sucesso!');
                  createForm.reset();
                  setCreateUnitOpen(false);
                },
                onError: () => toast.error('Erro ao cadastrar unidade. Tente novamente.'),
              }),
            )}
          >
            <div className="grid grid-cols-1 gap-4 ds-sm:grid-cols-2">
              <FormField label="Bloco" htmlFor="unit-block" required>
                <Input id="unit-block" placeholder="Ex: A" {...createForm.register('block', { required: true })} />
              </FormField>
              <FormField label="Número" htmlFor="unit-number" required>
                <Input id="unit-number" placeholder="Ex: 101" {...createForm.register('number', { required: true })} />
              </FormField>
            </div>
            <FormField label="Tipo" htmlFor="unit-type">
              <Controller
                control={createForm.control}
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
                control={createForm.control}
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
              <Button variant="secondary" onClick={() => setCreateUnitOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Salvando…' : 'Cadastrar'}
              </Button>
            </DialogFooter>
          </form>
        </FormDialog>
      ) : null}

      {canCreate ? (
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
                onError: () =>
                  toast.error('Erro ao atualizar unidade. Verifique se há morador na unidade para status "vaga".'),
              }),
            )}
          >
            <div className="grid grid-cols-1 gap-4 ds-sm:grid-cols-2">
              <FormField label="Bloco" htmlFor="edit-unit-block" required>
                <Input id="edit-unit-block" {...editForm.register('block', { required: true })} />
              </FormField>
              <FormField label="Número" htmlFor="edit-unit-number" required>
                <Input id="edit-unit-number" {...editForm.register('number', { required: true })} />
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
      ) : null}

      {canCreate && addResidentForUnit ? (
        <ResidentOnboardingDialog
          open={Boolean(addResidentForUnit)}
          onOpenChange={(open) => {
            if (!open) setAddResidentForUnit(null);
          }}
          condominiumId={condo.id}
          unit={addResidentForUnit}
        />
      ) : null}

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
        <div className="space-y-3">
          {list.map((unit) => (
            <UnitCard
              key={unit.id}
              condominiumId={condo.id!}
              unit={unit}
              checklist={checklistByUnitId.get(unit.id) ?? null}
              expanded={expandedUnitId === unit.id}
              canEdit={canCreate}
              onToggleExpand={() => setExpandedUnitId((prev) => (prev === unit.id ? null : unit.id))}
              onEditUnit={() => {
                setEditingUnitId(unit.id);
                editForm.reset({
                  block: unit.block,
                  number: unit.number,
                  type: unit.type as UnitFormInput['type'],
                  status: unit.status as UnitFormInput['status'],
                });
              }}
              onAddResident={() => setAddResidentForUnit(unit)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface UnitChecklist {
  score: number;
  isReady: boolean;
  hasResidents: boolean;
  hasFinancialResponsible: boolean;
  hasActiveAppAccess: boolean;
  hasPendingInvitation: boolean;
  hasCurrentMonthCharge: boolean;
}

interface UnitCardProps {
  condominiumId: string;
  unit: Unit;
  checklist: UnitChecklist | null;
  expanded: boolean;
  canEdit: boolean;
  onToggleExpand: () => void;
  onEditUnit: () => void;
  onAddResident: () => void;
}

function UnitCard({
  condominiumId,
  unit,
  checklist,
  expanded,
  canEdit,
  onToggleExpand,
  onEditUnit,
  onAddResident,
}: UnitCardProps) {
  return (
    <GlassCard className="overflow-hidden p-0">
      <button
        type="button"
        onClick={onToggleExpand}
        className="flex w-full items-start gap-4 px-4 py-4 text-left transition hover:bg-white/[0.03]"
        aria-expanded={expanded}
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-ds-xl bg-gradient-to-br from-brand-400/20 to-brand-600/10 text-brand-700 ring-1 ring-brand-400/20 dark:text-brand-300">
          <Home className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-ds-md font-semibold text-ds-body">
            {unit.block} — {unit.number}
          </h3>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <span className="inline-flex items-center rounded-full bg-ds-info/10 px-2.5 py-0.5 text-ds-xs font-medium text-ds-info ring-1 ring-inset ring-ds-info/20">
              {TYPE_LABELS[unit.type] ?? unit.type}
            </span>
            <span className="inline-flex items-center rounded-full bg-ds-success/10 px-2.5 py-0.5 text-ds-xs font-medium text-ds-success ring-1 ring-inset ring-ds-success/20">
              {STATUS_LABELS[unit.status] ?? unit.status}
            </span>
            {checklist ? (
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-2.5 py-0.5 text-ds-xs font-medium ring-1 ring-inset',
                  checklist.isReady
                    ? 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-300'
                    : 'bg-amber-500/10 text-amber-700 ring-amber-500/20 dark:text-amber-300',
                )}
              >
                Onboarding {checklist.score}/5
              </span>
            ) : null}
          </div>
        </div>
        <ChevronDown
          className={cn(
            'mt-2 h-4 w-4 shrink-0 text-ds-subtle transition',
            expanded && 'rotate-180 text-brand-700 dark:text-brand-300',
          )}
          aria-hidden
        />
      </button>

      {expanded ? (
        <div className="space-y-4 border-t border-ds-stroke/40 bg-white/[0.02] px-4 py-4">
          {checklist ? <UnitChecklistView checklist={checklist} /> : null}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-ds-sm font-semibold text-ds-body">Moradores</h4>
            {canEdit ? (
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={onEditUnit}>
                  <Pencil className="h-3.5 w-3.5" aria-hidden />
                  Editar unidade
                </Button>
                <Button variant="gradient" size="sm" onClick={onAddResident}>
                  <UserPlus className="h-3.5 w-3.5" aria-hidden />
                  Novo morador
                </Button>
              </div>
            ) : null}
          </div>

          <ResidentsForUnit condominiumId={condominiumId} unit={unit} canEdit={canEdit} />
        </div>
      ) : null}
    </GlassCard>
  );
}

function UnitChecklistView({ checklist }: { checklist: UnitChecklist }) {
  const items: { ok: boolean; label: string }[] = [
    { ok: checklist.hasResidents, label: 'Morador cadastrado' },
    { ok: checklist.hasFinancialResponsible, label: 'Responsável financeiro definido' },
    { ok: checklist.hasActiveAppAccess, label: 'Acesso ao app ativo' },
    {
      ok: checklist.hasPendingInvitation || checklist.hasActiveAppAccess,
      label: 'Convite de acesso em andamento',
    },
    { ok: checklist.hasCurrentMonthCharge, label: 'Cobrança do mês' },
  ];
  return (
    <div className="rounded-ds-xl border border-ds-border/60 bg-ds-surface/20 p-3">
      <p className="text-ds-xs font-semibold text-ds-body">
        Checklist de onboarding ({checklist.score}/5)
      </p>
      <ul className="mt-2 grid gap-1 text-[11px] text-ds-dim ds-sm:grid-cols-2">
        {items.map((item) => (
          <li key={item.label} className="flex items-center gap-1.5">
            <span
              className={cn(
                'inline-block h-1.5 w-1.5 rounded-full',
                item.ok ? 'bg-emerald-400' : 'bg-amber-400',
              )}
              aria-hidden
            />
            {item.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ResidentsForUnit({
  condominiumId,
  unit,
  canEdit,
}: {
  condominiumId: string;
  unit: Unit;
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.residents.byUnit(condominiumId, unit.id);
  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const [editingResidentId, setEditingResidentId] = useState<string | null>(null);
  const [residentToRemove, setResidentToRemove] = useState<{ id: string; fullName: string } | null>(null);

  const editForm = useForm<EditResidentFormInput>({ resolver: zodResolver(editResidentFormSchema) });

  const residentsQuery = useQuery({
    queryKey,
    queryFn: () => residentsService.list(condominiumId, unit.id),
  });

  const responsibleMutation = useMutation({
    mutationFn: (residentId: string) => residentsService.setResponsible(condominiumId, unit.id, residentId),
    onSuccess: invalidate,
  });
  const updateMutation = useMutation({
    mutationFn: (payload: EditResidentFormInput) =>
      residentsService.update(condominiumId, unit.id, editingResidentId!, payload),
    onSuccess: invalidate,
  });
  const removeMutation = useMutation({
    mutationFn: (residentId: string) => residentsService.remove(condominiumId, unit.id, residentId),
    onSuccess: invalidate,
  });

  if (residentsQuery.isLoading) return <Spinner />;
  const residents = residentsQuery.data ?? [];

  if (residents.length === 0) {
    return (
      <p className="rounded-ds-lg border border-dashed border-ds-stroke/60 px-3 py-4 text-center text-ds-xs text-ds-dim">
        Nenhum morador nesta unidade ainda. {canEdit ? 'Use "Novo morador" acima.' : ''}
      </p>
    );
  }

  return (
    <>
      {canEdit ? (
        <FormDialog
          open={Boolean(editingResidentId)}
          onOpenChange={(open) => {
            if (!open) {
              setEditingResidentId(null);
              editForm.reset();
            }
          }}
          title="Editar morador"
          description={`Unidade ${unit.block} - ${unit.number}`}
        >
          <form
            className="space-y-4"
            onSubmit={editForm.handleSubmit((payload) =>
              updateMutation.mutate(payload, {
                onSuccess: () => {
                  toast.success('Morador atualizado com sucesso!');
                  setEditingResidentId(null);
                  editForm.reset();
                },
                onError: () => toast.error('Erro ao atualizar morador. Tente novamente.'),
              }),
            )}
          >
            <FormField
              label="Nome completo"
              htmlFor="edit-fullName"
              required
              error={editForm.formState.errors.fullName?.message}
            >
              <Input
                id="edit-fullName"
                invalid={Boolean(editForm.formState.errors.fullName)}
                {...editForm.register('fullName')}
              />
            </FormField>
            <FormField
              label="CPF"
              htmlFor="edit-cpf"
              required
              hint="Apenas números, 11 dígitos"
              error={editForm.formState.errors.cpf?.message}
            >
              <Input id="edit-cpf" invalid={Boolean(editForm.formState.errors.cpf)} {...editForm.register('cpf')} />
            </FormField>
            <FormField
              label="WhatsApp"
              htmlFor="edit-phoneWhatsapp"
              hint="Informe DDD + número (ex.: 85991712228)"
              error={editForm.formState.errors.phoneWhatsapp?.message}
            >
              <Input
                id="edit-phoneWhatsapp"
                invalid={Boolean(editForm.formState.errors.phoneWhatsapp)}
                {...editForm.register('phoneWhatsapp')}
              />
            </FormField>
            <FormField label="E-mail" htmlFor="edit-email" error={editForm.formState.errors.email?.message}>
              <Input
                id="edit-email"
                type="email"
                invalid={Boolean(editForm.formState.errors.email)}
                {...editForm.register('email')}
              />
            </FormField>
            <DialogFooter>
              <Button
                variant="secondary"
                type="button"
                onClick={() => {
                  setEditingResidentId(null);
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
      ) : null}

      <ConfirmDialog
        open={Boolean(residentToRemove)}
        onOpenChange={(open) => {
          if (!open) setResidentToRemove(null);
        }}
        title="Confirmar exclusão de morador"
        description={residentToRemove ? `Deseja remover ${residentToRemove.fullName} desta unidade?` : ''}
        confirmLabel="Excluir morador"
        confirmDisabled={removeMutation.isPending}
        onConfirm={() => {
          if (!residentToRemove) return;
          removeMutation.mutate(residentToRemove.id, {
            onSuccess: () => toast.success('Morador removido com sucesso.'),
            onError: (err) => {
              const message =
                err && typeof err === 'object' && 'response' in err
                  ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
                  : null;
              toast.error(message || 'Não foi possível remover o morador.');
            },
            onSettled: () => setResidentToRemove(null),
          });
        }}
      />

      <ul className="space-y-2">
        {residents.map((resident) => (
          <ResidentRow
            key={resident.id}
            resident={resident}
            canEdit={canEdit}
            isResponsibleMutating={responsibleMutation.isPending}
            onEdit={() => {
              setEditingResidentId(resident.id);
              editForm.reset({
                fullName: resident.fullName,
                cpf: resident.cpf.replace(/\D/g, ''),
                phoneWhatsapp: resident.phoneWhatsapp?.replace(/\D/g, '') ?? '',
                email: resident.email ?? '',
              });
            }}
            onMakeResponsible={() =>
              responsibleMutation.mutate(resident.id, {
                onSuccess: () => toast.success('Responsável financeiro atualizado!'),
                onError: () => toast.error('Erro ao definir responsável. Tente novamente.'),
              })
            }
            onRemove={() => setResidentToRemove({ id: resident.id, fullName: resident.fullName })}
          />
        ))}
      </ul>
    </>
  );
}

function ResidentRow({
  resident,
  canEdit,
  isResponsibleMutating,
  onEdit,
  onMakeResponsible,
  onRemove,
}: {
  resident: Resident;
  canEdit: boolean;
  isResponsibleMutating: boolean;
  onEdit: () => void;
  onMakeResponsible: () => void;
  onRemove: () => void;
}) {
  const hasAppAccess = Boolean((resident as { userId?: string | null }).userId);

  return (
    <li className="flex flex-wrap items-start gap-3 rounded-ds-xl border border-ds-stroke/40 bg-white/[0.02] p-3">
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-xs font-bold text-white ${pickGradient(resident.id)}`}
      >
        {getInitials(resident.fullName)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-ds-sm font-semibold text-ds-body">{resident.fullName}</p>
          {resident.isFinancialResponsible ? (
            <span className="inline-flex items-center gap-1 rounded-ds-md bg-ds-success/15 px-1.5 py-0.5 text-[10px] font-semibold text-ds-success">
              <ShieldCheck className="h-3 w-3" aria-hidden />
              Responsável
            </span>
          ) : null}
          {hasAppAccess ? (
            <span className="rounded-ds-md bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-brand-200">
              App ativo
            </span>
          ) : (
            <span className="rounded-ds-md bg-slate-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-slate-300">
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
            <span className="inline-flex items-center gap-1">
              <Mail className="h-3 w-3" aria-hidden />
              {resident.email}
            </span>
          ) : null}
        </div>
      </div>
      {canEdit ? (
        <div className="ml-auto flex flex-wrap items-center gap-1">
          <Button size="sm" variant="ghost" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" aria-hidden />
            Editar
          </Button>
          {!resident.isFinancialResponsible ? (
            <Button size="sm" variant="ghost" disabled={isResponsibleMutating} onClick={onMakeResponsible}>
              <UserRound className="h-3.5 w-3.5" aria-hidden />
              Definir responsável
            </Button>
          ) : null}
          <Button size="sm" variant="ghost" onClick={onRemove}>
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
            Excluir
          </Button>
        </div>
      ) : null}
    </li>
  );
}
