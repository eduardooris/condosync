import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationsService } from '@/domains/notifications/services/notifications.service';
import { queryKeys } from '@/shared/lib/queryKeys';

export function useNotificationsPage(onlyUnread: boolean) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: queryKeys.notifications.all() });
    qc.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount() });
  };

  const notificationsQuery = useQuery({
    queryKey: queryKeys.notifications.list(onlyUnread),
    queryFn: () => notificationsService.list(onlyUnread),
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationsService.markRead(id),
    onSuccess: invalidate,
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationsService.markAllRead(),
    onSuccess: invalidate,
  });

  return { notificationsQuery, markReadMutation, markAllReadMutation };
}
