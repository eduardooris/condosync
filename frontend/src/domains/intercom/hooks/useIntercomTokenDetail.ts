import { useQuery } from '@tanstack/react-query';
import { intercomAdminService } from '@/domains/intercom/services/intercom-admin.service';
import { queryKeys } from '@/shared/lib/queryKeys';

export function useIntercomTokenDetail(
  condominiumId: string | undefined,
  tokenId: string | null,
  enabled: boolean,
) {
  return useQuery({
    queryKey: queryKeys.intercom.tokenDetail(condominiumId, tokenId ?? undefined),
    queryFn: () => intercomAdminService.getToken(condominiumId!, tokenId!),
    enabled: Boolean(condominiumId && tokenId && enabled),
  });
}
