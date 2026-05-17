import { io, type Socket } from 'socket.io-client';
import type { AppNotification } from '@/domains/notifications/services/notifications.service';

const ORIGIN =
  import.meta.env.VITE_API_BASE_URL ??
  import.meta.env.VITE_API_URL ??
  'http://localhost:3000';

/**
 * Conecta no namespace `/notifications` do backend e dispara
 * `onNew(notification)` sempre que chega um `notification:new`.
 *
 * O backend aceita o JWT via `auth.token` no handshake. Use o mesmo
 * access token usado pelos requests HTTP — o gateway valida via
 * `AUTH_ADAPTER.verifyAccessToken`.
 */
export function connectNotificationsSocket(
  token: string,
  handlers: {
    onNew?: (n: AppNotification) => void;
    onConnect?: () => void;
    onDisconnect?: () => void;
  },
): Socket {
  const origin = ORIGIN.replace(/\/$/, '');
  const socket = io(`${origin}/notifications`, {
    transports: ['websocket', 'polling'],
    auth: { token },
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1500,
    reconnectionDelayMax: 15000,
  });
  socket.on('connect', () => handlers.onConnect?.());
  socket.on('disconnect', () => handlers.onDisconnect?.());
  socket.on('notification:new', (payload: AppNotification) => {
    handlers.onNew?.(payload);
  });
  return socket;
}
