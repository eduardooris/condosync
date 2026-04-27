import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { bulletinService } from '@/domains/bulletin/services/bulletin.service';
import type { BulletinFormInput } from '@/domains/bulletin/schemas/bulletin.schema';
import { queryKeys } from '@/shared/lib/queryKeys';

export function useBulletinPage(condominiumId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.bulletin.list(condominiumId);

  const bulletinQuery = useQuery({
    queryKey,
    queryFn: () => bulletinService.list(condominiumId!),
    enabled: Boolean(condominiumId),
  });

  const createMutation = useMutation({
    mutationFn: (payload: BulletinFormInput) => bulletinService.create(condominiumId!, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return { bulletinQuery, createMutation };
}
