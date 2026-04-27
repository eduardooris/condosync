import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { occurrencesService } from '@/domains/occurrences/services/occurrences.service';
import type { OccurrenceFormValues } from '@/domains/occurrences/schemas/occurrences.schema';

export function useOccurrencesPage(condominiumId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ['occurrences', condominiumId];

  const occurrencesQuery = useQuery({
    queryKey,
    queryFn: () => occurrencesService.list(condominiumId!),
    enabled: Boolean(condominiumId),
  });

  const createMutation = useMutation({
    mutationFn: (payload: OccurrenceFormValues) => occurrencesService.create(condominiumId!, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'UNDER_REVIEW' | 'RESOLVED' }) =>
      occurrencesService.updateStatus(condominiumId!, id, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return { occurrencesQuery, createMutation, statusMutation };
}
