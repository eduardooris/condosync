import { useQuery } from '@tanstack/react-query';
import { condominiumsService } from '@/domains/condominiums/services/condominiums.service';
import { queryKeys } from '@/shared/lib/queryKeys';

export function useCondominiumDetail(condominiumId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.condominium.detail(condominiumId),
    queryFn: () => condominiumsService.getOne(condominiumId!),
    enabled: Boolean(condominiumId),
  });
}
