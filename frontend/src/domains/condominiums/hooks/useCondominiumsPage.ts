import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { condominiumsService } from '@/domains/condominiums/services/condominiums.service';
import type { CreateCondominiumInput } from '@/domains/condominiums/schemas/condominiums.schema';
import { queryKeys } from '@/shared/lib/queryKeys';

export function useCondominiumsPage() {
  const queryClient = useQueryClient();

  const condominiumsQuery = useQuery({
    queryKey: queryKeys.condominiums.root(),
    queryFn: condominiumsService.listMine,
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreateCondominiumInput) => condominiumsService.create(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.condominiums.root() }),
  });

  return { condominiumsQuery, createMutation };
}
