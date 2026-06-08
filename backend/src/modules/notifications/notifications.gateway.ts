import { Inject, Injectable } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Server, Socket } from 'socket.io';
import { AUTH_ADAPTER, IAuthAdapter } from '../../adapters/auth/auth.adapter';
import { Notification } from '../../database/entities/notification.entity';

/**
 * Gateway WebSocket para entrega real-time de notificações in-app.
 *
 * Protocolo de conexão (`/notifications` namespace):
 *   - Cliente autentica via `auth.token` no handshake (Bearer JWT do usuário).
 *   - Servidor verifica o token via `AUTH_ADAPTER.verifyAccessToken` e
 *     coloca o socket na room `user:<userId>`.
 *   - Quando uma notificação é criada (single ou broadcast), o serviço
 *     chama `emitToUser(userId, payload)` que emite `notification:new`
 *     para a room do usuário — todos os dispositivos conectados recebem.
 *
 * Por que reaproveitar a infra de socket.io que já existe no Intercom:
 * o frontend já carrega `socket.io-client`, então o overhead é zero. Um
 * namespace dedicado mantém a separação de domínios (intercom WebRTC vs.
 * notificações genéricas).
 */
@WebSocketGateway({
  namespace: '/notifications',
  cors: { origin: true, credentials: true },
})
@Injectable()
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  constructor(
    @Inject(AUTH_ADAPTER) private readonly authAdapter: IAuthAdapter,
    @InjectPinoLogger(NotificationsGateway.name)
    private readonly logger: PinoLogger,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = String(
        client.handshake.auth?.token ?? client.handshake.query.token ?? '',
      );
      if (!token) {
        throw new Error('Token ausente.');
      }
      const claims = await this.authAdapter.verifyAccessToken(token);
      client.data.userId = claims.sub;
      await client.join(this.userRoom(claims.sub));
    } catch (err) {
      this.logger.warn(
        {
          err_message: err instanceof Error ? err.message : String(err),
          socket_id: client.id,
        },
        'notifications.ws.auth_failed',
      );
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    void client;
  }

  /**
   * Emite a notificação para todas as conexões abertas do usuário.
   * Idempotente: se o usuário não tiver socket conectado, a notif só
   * fica disponível ao próximo `GET /me/notifications` — sem retry,
   * sem persistir buffer in-memory.
   */
  emitToUser(userId: string, notification: Notification): void {
    if (!this.server) return;
    this.server.to(this.userRoom(userId)).emit('notification:new', {
      id: notification.id,
      userId: notification.userId,
      condominiumId: notification.condominiumId,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      payload: notification.payload,
      deeplink: notification.deeplink,
      createdAt: notification.createdAt,
      readAt: notification.readAt,
    });
  }

  /**
   * Versão broadcast — emite uma lista de notificações para seus
   * respectivos donos em uma única passada. Útil ao final de
   * `createMany` (poll criada, comunicado, cobrança em lote).
   */
  emitMany(notifications: Notification[]): void {
    if (!this.server) return;
    for (const n of notifications) {
      this.emitToUser(n.userId, n);
    }
  }

  private userRoom(userId: string): string {
    return `user:${userId}`;
  }
}
