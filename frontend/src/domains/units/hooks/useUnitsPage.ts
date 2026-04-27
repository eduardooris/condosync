import { useMutation, useQueryClient } from '@tanstack/react-query';
import { unitsService } from '@/domains/units/services/units.service';
import type { UnitFormInput } from '@/domains/units/schemas/unit.schema';
import { queryKeys } from '@/shared/lib/queryKeys';

export function useUnitsPage(condominiumId: string | undefined, editingUnitId: string | null) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.units.list(condominiumId) });

  const createMutation = useMutation({
    mutationFn: (payload: UnitFormInput) => unitsService.create(condominiumId!, payload),
    onSuccess: invalidate,
  });

  const updateMutation = useMutation({
    mutationFn: (payload: UnitFormInput) => unitsService.update(condominiumId!, editingUnitId!, payload),
    onSuccess: invalidate,
  });

  return { createMutation, updateMutation };
}
