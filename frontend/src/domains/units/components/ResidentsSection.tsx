import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/shared/components/ui/Button';
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog';
import { Spinner } from '@/shared/components/ui/Spinner';
import { queryKeys } from '@/shared/lib/queryKeys';
import { residentsService } from '@/domains/residents/services/residents.service';
import type { Resident, Unit } from '@/shared/types/api';
import { EditResidentDialog } from './EditResidentDialog';
import { ResidentInlineForm } from './ResidentInlineForm';
import { ResidentRow } from './ResidentRow';

interface ResidentsSectionProps {
  condominiumId: string;
  unit: Unit;
  canEdit: boolean;
}

/**
 * Seção de moradores do painel de unidade: header com contagem e botão
 * "Adicionar morador" que expande o ResidentInlineForm na própria seção
 * (sem modal flutuante perdendo contexto). Lista, edição e remoção também
 * vivem aqui.
 */
export function ResidentsSection({ condominiumId, unit, canEdit }: ResidentsSectionProps) {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.residents.byUnit(condominiumId, unit.id);

  const [isAdding, setIsAdding] = useState(false);
  const [editingResident, setEditingResident] = useState<Resident | null>(null);
  const [residentToRemove, setResidentToRemove] = useState<Resident | null>(null);
  const [pendingResponsibleId, setPendingResponsibleId] = useState<string | null>(null);

  const residentsQuery = useQuery({
    queryKey,
    queryFn: () => residentsService.list(condominiumId, unit.id),
  });

  const responsibleMutation = useMutation({
    mutationFn: (residentId: string) =>
      residentsService.setResponsible(condominiumId, unit.id, residentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({
        queryKey: queryKeys.units.onboardingChecklist(condominiumId),
      });
      toast.success('Responsável financeiro atualizado.');
    },
    onError: () => toast.error('Não foi possível alterar o responsável.'),
    onSettled: () => setPendingResponsibleId(null),
  });

  const removeMutation = useMutation({
    mutationFn: (residentId: string) =>
      residentsService.remove(condominiumId, unit.id, residentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({
        queryKey: queryKeys.units.onboardingChecklist(condominiumId),
      });
      toast.success('Morador removido.');
    },
    onError: (err) => {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : null;
      toast.error(message || 'Não foi possível remover o morador.');
    },
    onSettled: () => setResidentToRemove(null),
  });

  const residents = residentsQuery.data ?? [];
  const hasResponsible = residents.some((r) => r.isFinancialResponsible);
  const isLoading = residentsQuery.isLoading;

  return (
    <section className="space-y-3">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-ds-dim" aria-hidden />
          <h3 className="text-ds-sm font-semibold text-ds-body">Moradores</h3>
          <span className="rounded-ds-pill bg-ds-surface px-2 py-0.5 text-[11px] font-semibold text-ds-dim">
            {residents.length}
          </span>
        </div>
        {canEdit && !isAdding ? (
          <Button size="sm" variant="primary" onClick={() => setIsAdding(true)}>
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Adicionar morador
          </Button>
        ) : null}
      </header>

      {canEdit ? (
        <ResidentInlineForm
          open={isAdding}
          onClose={() => setIsAdding(false)}
          condominiumId={condominiumId}
          unit={unit}
          hasResponsible={hasResponsible}
        />
      ) : null}

      {isLoading ? (
        <div className="flex items-center gap-2 rounded-ds-xl border border-ds-stroke/40 bg-ds-surface/30 px-3 py-6 text-ds-xs text-ds-dim">
          <Spinner />
          Carregando moradores…
        </div>
      ) : residents.length === 0 ? (
        <div className="rounded-ds-xl border border-dashed border-ds-stroke/60 bg-ds-surface/20 px-4 py-8 text-center">
          <Users className="mx-auto h-6 w-6 text-ds-subtle" aria-hidden />
          <p className="mt-2 text-ds-sm font-medium text-ds-body">
            Nenhum morador cadastrado nesta unidade
          </p>
          <p className="mt-1 text-ds-xs text-ds-dim">
            {canEdit
              ? 'Use "Adicionar morador" acima para cadastrar a primeira pessoa.'
              : 'Peça ao síndico para cadastrar moradores.'}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {residents.map((resident) => (
            <ResidentRow
              key={resident.id}
              resident={resident}
              canEdit={canEdit}
              isMutating={pendingResponsibleId === resident.id}
              onEdit={() => setEditingResident(resident)}
              onMakeResponsible={() => {
                setPendingResponsibleId(resident.id);
                responsibleMutation.mutate(resident.id);
              }}
              onRemove={() => setResidentToRemove(resident)}
            />
          ))}
        </ul>
      )}

      {canEdit ? (
        <EditResidentDialog
          open={Boolean(editingResident)}
          onOpenChange={(open) => {
            if (!open) setEditingResident(null);
          }}
          condominiumId={condominiumId}
          unit={unit}
          resident={editingResident}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(residentToRemove)}
        onOpenChange={(open) => {
          if (!open) setResidentToRemove(null);
        }}
        title="Remover morador"
        description={
          residentToRemove
            ? `Deseja remover ${residentToRemove.fullName} desta unidade? Esta ação não pode ser desfeita.`
            : ''
        }
        confirmLabel="Remover"
        confirmDisabled={removeMutation.isPending}
        onConfirm={() => {
          if (!residentToRemove) return;
          removeMutation.mutate(residentToRemove.id);
        }}
      />
    </section>
  );
}
