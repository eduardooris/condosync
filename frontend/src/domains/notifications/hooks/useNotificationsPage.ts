import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import {
  notificationsService,
  type NotificationsPage,
} from '@/domains/notifications/services/notifications.service';
import { queryKeys } from '@/shared/lib/queryKeys';
import { useAuthStore } from '@/shared/stores/auth.store';

const PAGE_SIZE = 25;

export function useNotificationsPage(onlyUnread: boolean) {
  const qc = useQueryClient();
  const activeCondominiumId = useAuthStore(
    (s) => s.activeCondominium?.id ?? null,
  );

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: queryKeys.notifications.all() });
    qc.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount() });
  };

  const notificationsQuery = useInfiniteQuery({
    queryKey: [
      ...queryKeys.notifications.list(onlyUnread),
      activeCondominiumId,
    ],
    queryFn: ({ pageParam }) =>
      notificationsService.list({
        onlyUnread,
        condominiumId: activeCondominiumId,
        before: pageParam,
        limit: PAGE_SIZE,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage: NotificationsPage) => lastPage.nextCursor,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationsService.markRead(id),
    onSuccess: invalidate,
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationsService.markAllRead(activeCondominiumId),
    onSuccess: invalidate,
  });

  return { notificationsQuery, markReadMutation, markAllReadMutation };
}
