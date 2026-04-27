import { UserRound, Home, Plus, Phone, Mail, CreditCard, ShieldCheck, Pencil, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import { Button } from '@/shared/components/ui/Button';
import { EmptyState } from '@/shared/components/ui/EmptyState';
import { FormDialog, DialogFooter } from '@/shared/components/ui/Dialog';
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog';
import { ResidentOnboardingDialog } from '@/domains/residents/components/ResidentOnboardingDialog';
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
import {
  editResidentFormSchema,
  type EditResidentFormInput,
} from '@/domains/residents/schemas/resident.schema';
import { useUnits } from '@/domains/units/hooks/useUnits';
import { useResidentsPage } from '@/domains/residents/hooks/useResidentsPage';
import { useAuthStore } from '@/shared/stores/auth.store';
import { canManageCondominiumStructure } from '@/shared/utils/roles';

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

export function ResidentsPage() {
  const condo = useAuthStore((state) => state.activeCondominium);
  const role = useAuthStore((state) => state.role);
  const canEdit = canManageCondominiumStructure(role);
  const [unitId, setUnitId] = useState<string>('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingResidentId, setEditingResidentId] = useState<string | null>(null);
  const [residentToRemove, setResidentToRemove] = useState<{
    id: string;
    fullName: string;
  } | null>(null);

  const editForm = useForm<EditResidentFormInput>({
    resolver: zodResolver(editResidentFormSchema),
  });

  const { data: units, isLoading: loadingUnits } = useUnits(condo?.id);

  const selectedUnit = useMemo(
    () => units?.find((unit) => unit.id === unitId) ?? units?.[0],
    [unitId, units],
  );

  const { residentsQuery, responsibleMutation, updateMutation, removeMutation } = useResidentsPage(
    condo?.id,
    selectedUnit?.id,
    editingResidentId,
  );
  if (!condo?.id) {
    return (
      <p className="ds-page text-ds-sm text-ds-dim">Selecione um condomínio no topo da página.</p>
    );
  }

  if (loadingUnits) return <Spinner />;

  const unitList = units ?? [];
  const hasUnits = unitList.length > 0;

  if (!hasUnits) {
    return (
      <div className="ds-page space-y-4">
        <PageHeader
          title="Moradores"
          description="Moradores são sempre vinculados a uma unidade."
        />
        <EmptyState
          icon={Home}
          title="Cadastre unidades antes dos moradores"
          description="Cada pessoa fica vinculada a um bloco/apartamento. Sem unidades, não há como listar quem mora onde."
          suggestion="Inclua blocos e apartamentos em Unidades (ou use o Setup Assistant) e volte a esta tela."
          action={{ to: '/units', label: 'Ir para unidades' }}
        />
      </div>
    );
  }

  if (residentsQuery.isLoading) return <Spinner />;

  const resList = residentsQuery.data ?? [];

  return (
    <div className="ds-page space-y-6">
      <PageHeader
        title="Moradores"
        description="Selecione a unidade e use &quot;Novo morador&quot; para cadastrar a pessoa e definir o responsável financeiro. O acesso ao app é feito pelo link genérico do condomínio."
        actions={
          canEdit && selectedUnit ? (
            <Button variant="gradient" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              Novo morador
            </Button>
          ) : undefined
        }
      />
      {canEdit && selectedUnit && (
        <ResidentOnboardingDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          condominiumId={condo.id}
          unit={selectedUnit}
        />
      )}
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
          description={`Unidade ${selectedUnit?.block} - ${selectedUnit?.number}`}
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
                onError: () => {
                  toast.error('Erro ao atualizar morador. Tente novamente.');
                },
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
              <Input
                id="edit-cpf"
                invalid={Boolean(editForm.formState.errors.cpf)}
                {...editForm.register('cpf')}
              />
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

            <FormField
              label="E-mail"
              htmlFor="edit-email"
              error={editForm.formState.errors.email?.message}
            >
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
        description={
          residentToRemove
            ? `Deseja remover ${residentToRemove.fullName} desta unidade?`
            : ''
        }
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
      <div className="w-full min-w-0 max-w-sm">
        <Select
          value={selectedUnit?.id ?? ''}
          onValueChange={setUnitId}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione a unidade" />
          </SelectTrigger>
          <SelectContent>
            {unitList.map((unit) => (
              <SelectItem key={unit.id} value={unit.id}>
                {unit.block} - {unit.number}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!canEdit && (
        <p className="rounded-ds-lg border border-ds-stroke/50 bg-ds-elevated/10 px-4 py-3 text-ds-sm text-ds-dim">
          Para <strong className="text-ds-body">incluir ou editar</strong> moradores, o perfil
          precisa ser de administrador do condomínio. Você pode apenas consultar a lista da unidade
          selecionada.
        </p>
      )}

      {resList.length === 0 ? (
        <EmptyState
          icon={UserRound}
          title="Nenhum morador nesta unidade"
          description="Quando houver pessoas cadastradas, aparecerão aqui com nome, contato e indicação de responsável financeiro."
          suggestion={
            canEdit
              ? 'Use o botão "Novo morador" para adicionar o primeiro morador desta unidade.'
              : 'Se faltar alguém na lista, peça ao síndico ou à administração para concluir o cadastro no sistema.'
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 ds-sm:grid-cols-2 ds-lg:grid-cols-3">
          {resList.map((resident) => (
            <GlassCard key={resident.id} className="flex flex-col gap-4">
              <div className="flex items-start gap-3">
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-sm font-bold text-white ${pickGradient(resident.id)}`}
                >
                  {getInitials(resident.fullName)}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-ds-md font-semibold text-ds-body">
                    {resident.fullName}
                  </h3>
                  {(resident as { userId?: string | null }).userId ? (
                    <span className="mt-0.5 inline-flex items-center gap-1 rounded-ds-md bg-brand-500/15 px-2 py-0.5 text-ds-xs font-medium text-brand-200">
                      Acesso ao app ativo
                    </span>
                  ) : (
                    <span className="mt-0.5 inline-flex items-center gap-1 rounded-ds-md bg-slate-500/15 px-2 py-0.5 text-ds-xs font-medium text-slate-300">
                      Sem acesso ao app (usar link genérico do condomínio)
                    </span>
                  )}
                  {resident.isFinancialResponsible && (
                    <span className="mt-0.5 inline-flex items-center gap-1 rounded-ds-md bg-ds-success/15 px-2 py-0.5 text-ds-xs font-medium text-ds-success">
                      <ShieldCheck className="h-3 w-3" />
                      Responsável financeiro
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-1.5 text-ds-sm text-ds-dim">
                <p className="flex items-center gap-2">
                  <CreditCard className="h-3.5 w-3.5 shrink-0 text-ds-subtle" />
                  <span className="truncate">{resident.cpf}</span>
                </p>
                {resident.phoneWhatsapp && (
                  <p className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 shrink-0 text-ds-subtle" />
                    <span className="truncate">{resident.phoneWhatsapp}</span>
                  </p>
                )}
                {resident.email && (
                  <p className="flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5 shrink-0 text-ds-subtle" />
                    <span className="truncate">{resident.email}</span>
                  </p>
                )}
              </div>

              {canEdit && (
                <div className="mt-auto flex flex-col gap-2 ds-sm:flex-row">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="w-full"
                    onClick={() => {
                      setEditingResidentId(resident.id);
                      editForm.reset({
                        fullName: resident.fullName,
                        cpf: resident.cpf.replace(/\D/g, ''),
                        phoneWhatsapp: resident.phoneWhatsapp?.replace(/\D/g, '') ?? '',
                        email: resident.email ?? '',
                      });
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Editar
                  </Button>
                  {!resident.isFinancialResponsible ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="w-full"
                      disabled={responsibleMutation.isPending}
                      onClick={() =>
                        responsibleMutation.mutate(resident.id, {
                          onSuccess: () => toast.success('Responsável financeiro atualizado!'),
                          onError: () => toast.error('Erro ao definir responsável. Tente novamente.'),
                        })
                      }
                    >
                      Definir responsável
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="w-full"
                    disabled={removeMutation.isPending}
                    onClick={() =>
                      setResidentToRemove({
                        id: resident.id,
                        fullName: resident.fullName,
                      })
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Excluir
                  </Button>
                </div>
              )}
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
