import { io, type Socket } from 'socket.io-client';
import type { IntercomSignalMessage, IntercomSessionStatusResponse } from '@/shared/types/intercom';

export interface IntercomSocketHandlers {
  onSignal?: (msg: IntercomSignalMessage) => void;
  onSessionUpdate?: (msg: IntercomSessionStatusResponse & { reason?: string }) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

function parseWsBaseUrl(wsUrl: string): { origin: string; namespace: string } {
  const url = new URL(wsUrl);
  const namespace = url.pathname && url.pathname !== '/' ? url.pathname : '/intercom';
  return { origin: url.origin, namespace };
}

export function connectIntercomSocket(
  wsUrl: string,
  params: { sessionId: string; role: 'guest' | 'resident'; token: string },
  handlers: IntercomSocketHandlers,
): Socket {
  const { origin, namespace } = parseWsBaseUrl(wsUrl);
  const socket = io(`${origin}${namespace}`, {
    transports: ['websocket', 'polling'],
    auth: { token: params.token },
    query: {
      sessionId: params.sessionId,
      role: params.role,
    },
  });

  socket.on('connect', () => handlers.onConnect?.());
  socket.on('disconnect', () => handlers.onDisconnect?.());
  socket.on('signal', (payload: IntercomSignalMessage) => handlers.onSignal?.(payload));
  socket.on('session_update', (payload: IntercomSessionStatusResponse) =>
    handlers.onSessionUpdate?.(payload),
  );

  return socket;
}

export function emitSignal(socket: Socket, msg: Omit<IntercomSignalMessage, 'sessionId'> & { sessionId: string }): void {
  socket.emit('signal', msg);
}
