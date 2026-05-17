import { api } from '@/shared/lib/axios';

export type NotificationType =
  | 'CHARGE_CREATED'
  | 'CHARGE_OVERDUE'
  | 'CHARGE_PAID'
  | 'POLL_CREATED'
  | 'POLL_CLOSED'
  | 'OCCURRENCE_STATUS'
  | 'BULLETIN_NEW'
  | 'DOCUMENT_NEW'
  | 'BALANCE_NEGATIVE'
  | 'MEMBER_PENDING_APPROVAL';

export type AppNotification = {
  id: string;
  userId: string;
  condominiumId: string | null;
  type: NotificationType;
  title: string;
  body: string;
  payload: Record<string, unknown> | null;
  /** URL relativa para abrir a tela do recurso (ex.: `/charges/:id`). */
  deeplink: string | null;
  readAt: string | null;
  createdAt: string;
};

export interface NotificationsPage {
  items: AppNotification[];
  /** ISO `createdAt` do último item — passe como `before` na próxima página. */
  nextCursor: string | null;
}

export interface ListNotificationsParams {
  onlyUnread?: boolean;
  condominiumId?: string | null;
  before?: string | null;
  limit?: number;
}

function buildQuery(params: ListNotificationsParams): string {
  const qs = new URLSearchParams();
  if (params.onlyUnread) qs.set('unread', 'true');
  if (params.condominiumId) qs.set('condominiumId', params.condominiumId);
  if (params.before) qs.set('before', params.before);
  if (typeof params.limit === 'number') qs.set('limit', String(params.limit));
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const notificationsService = {
  list: (params: ListNotificationsParams = {}) =>
    api.get<NotificationsPage, NotificationsPage>(
      `/me/notifications${buildQuery(params)}`,
    ),

  unreadCount: (condominiumId?: string | null) =>
    api.get<{ unread: number }, { unread: number }>(
      `/me/notifications/unread-count${
        condominiumId ? `?condominiumId=${encodeURIComponent(condominiumId)}` : ''
      }`,
    ),

  markRead: (id: string) =>
    api.patch<undefined, AppNotification>(`/me/notifications/${id}/read`, undefined),

  markAllRead: (condominiumId?: string | null) =>
    api.post<undefined, { updated: number }>(
      `/me/notifications/read-all${
        condominiumId ? `?condominiumId=${encodeURIComponent(condominiumId)}` : ''
      }`,
      undefined,
    ),
};
