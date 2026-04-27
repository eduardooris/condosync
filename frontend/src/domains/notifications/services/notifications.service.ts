import { api } from '@/shared/lib/axios';

export type AppNotification = {
  id: string;
  userId: string;
  condominiumId: string | null;
  type: string;
  title: string;
  body: string;
  payload: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
};

export const notificationsService = {
  list: (onlyUnread = false) =>
    api.get<AppNotification[], AppNotification[]>(
      `/me/notifications${onlyUnread ? '?unread=true' : ''}`,
    ),

  unreadCount: () => api.get<{ unread: number }, { unread: number }>('/me/notifications/unread-count'),

  markRead: (id: string) =>
    api.patch<undefined, AppNotification>(`/me/notifications/${id}/read`, undefined),

  markAllRead: () =>
    api.post<undefined, { updated: number }>('/me/notifications/read-all', undefined),
};
