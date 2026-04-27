import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { residentsService } from '@/domains/residents/services/residents.service';
import type { EditResidentFormInput } from '@/domains/residents/schemas/resident.schema';

export function useResidentsPage(
  condominiumId: string | undefined,
  selectedUnitId: string | undefined,
  editingResidentId: string | null,
) {
  const queryClient = useQueryClient();
  const queryKey = ['residents', condominiumId, selectedUnitId];
  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const residentsQuery = useQuery({
    queryKey,
    queryFn: () => residentsService.list(condominiumId!, selectedUnitId!),
    enabled: Boolean(condominiumId && selectedUnitId),
  });

  const responsibleMutation = useMutation({
    mutationFn: (residentId: string) =>
      residentsService.setResponsible(condominiumId!, selectedUnitId!, residentId),
    onSuccess: invalidate,
  });

  const updateMutation = useMutation({
    mutationFn: (payload: EditResidentFormInput) =>
      residentsService.update(condominiumId!, selectedUnitId!, editingResidentId!, payload),
    onSuccess: invalidate,
  });

  const removeMutation = useMutation({
    mutationFn: (residentId: string) =>
      residentsService.remove(condominiumId!, selectedUnitId!, residentId),
    onSuccess: invalidate,
  });

  return { residentsQuery, responsibleMutation, updateMutation, removeMutation };
}
