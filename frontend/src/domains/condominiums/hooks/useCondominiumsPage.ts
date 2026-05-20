import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { condominiumsService } from '@/domains/condominiums/services/condominiums.service';
import type { CreateCondominiumFormValues } from '@/domains/condominiums/schemas/condominiums.schema';
import type { CreateCondominiumInput } from '@/domains/condominiums/services/condominiums.service';
import { queryKeys } from '@/shared/lib/queryKeys';

export function useCondominiumsPage() {
  const queryClient = useQueryClient();

  const condominiumsQuery = useQuery({
    queryKey: queryKeys.condominiums.root(),
    queryFn: condominiumsService.listMine,
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreateCondominiumFormValues) => {
      const body: CreateCondominiumInput = { name: payload.name };
      if (payload.cnpj) body.cnpj = payload.cnpj;
      return condominiumsService.create(body);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.condominiums.root() }),
  });

  return { condominiumsQuery, createMutation };
}
