import { Inject, Injectable } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Server, Socket } from 'socket.io';
import {
  AUTH_ADAPTER,
  IAuthAdapter,
} from '../../../adapters/auth/auth.adapter';
import { IntercomSessionUpdateReason } from '../../../common/enums';
import { IntercomSession } from '../../../database/entities/intercom-session.entity';
import { IntercomGuestJwtService } from './intercom-guest-jwt.service';

export interface IntercomRingPayload {
  sessionId: string;
  unitId: string;
  unitLabel: string;
  visitorName: string;
  condominiumId: string;
  targetUserIds: string[];
}

interface SignalPayload {
  sessionId: string;
  type: string;
  sdp?: string;
  candidate?: unknown;
}

interface SocketAuth {
  role: 'guest' | 'resident';
  sessionId: string;
  userId?: string;
}

@WebSocketGateway({
  namespace: '/intercom',
  cors: { origin: true, credentials: true },
})
@Injectable()
export class IntercomGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly guestJwt: IntercomGuestJwtService,
    @Inject(AUTH_ADAPTER) private readonly authAdapter: IAuthAdapter,
    @InjectPinoLogger(IntercomGateway.name)
    private readonly logger: PinoLogger,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const auth = await this.authenticateSocket(client);
      client.data.auth = auth;
      const listenOnly =
        auth.role === 'resident' &&
        String(client.handshake.query.listen ?? '') === 'true';

      if (listenOnly) {
        if (auth.userId) {
          await client.join(this.userRoom(auth.userId));
        }
        return;
      }

      const room = this.sessionRoom(auth.sessionId);
      await client.join(room);
      if (auth.role === 'resident' && auth.userId) {
        await client.join(this.userRoom(auth.userId));
      }
      client.to(room).emit('participant_joined', {
        sessionId: auth.sessionId,
        role: auth.role,
      });
    } catch (err) {
      this.logger.warn(
        {
          err_message: err instanceof Error ? err.message : String(err),
          socket_id: client.id,
        },
        'intercom.ws.auth_failed',
      );
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    void client;
  }

  @SubscribeMessage('signal')
  handleSignal(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: SignalPayload,
  ): void {
    const auth = client.data.auth as SocketAuth | undefined;
    if (!auth || body.sessionId !== auth.sessionId) {
      client.disconnect(true);
      return;
    }
    if (!body.type?.trim()) {
      return;
    }
    client.to(this.sessionRoom(auth.sessionId)).emit('signal', {
      sessionId: auth.sessionId,
      type: body.type,
      sdp: body.sdp,
      candidate: body.candidate,
      fromRole: auth.role,
    });
  }

  emitRing(payload: IntercomRingPayload): void {
    const ringBody = {
      sessionId: payload.sessionId,
      unitId: payload.unitId,
      unitLabel: payload.unitLabel,
      visitorName: payload.visitorName,
      condominiumId: payload.condominiumId,
    };
    for (const userId of payload.targetUserIds) {
      this.server.to(this.userRoom(userId)).emit('ring', ringBody);
    }
    this.server.to(this.sessionRoom(payload.sessionId)).emit('ring', ringBody);
  }

  emitSessionUpdate(
    session: IntercomSession,
    reason?: IntercomSessionUpdateReason,
    targetUserIds?: string[],
  ): void {
    const body = {
      sessionId: session.id,
      status: session.status,
      reason,
      answeredByResidentId: session.answeredByResidentId,
    };
    if (targetUserIds?.length) {
      for (const userId of targetUserIds) {
        this.server.to(this.userRoom(userId)).emit('session_update', body);
      }
      return;
    }
    this.server.to(this.sessionRoom(session.id)).emit('session_update', body);
  }

  private sessionRoom(sessionId: string): string {
    return `session:${sessionId}`;
  }

  private userRoom(userId: string): string {
    return `user:${userId}`;
  }

  private async authenticateSocket(client: Socket): Promise<SocketAuth> {
    const sessionId = String(client.handshake.query.sessionId ?? '');
    const role = String(client.handshake.query.role ?? '');
    const token = String(
      client.handshake.auth?.token ?? client.handshake.query.token ?? '',
    );

    if (!token) {
      throw new Error('Credenciais WebSocket ausentes.');
    }

    const listenOnly =
      role === 'resident' &&
      String(client.handshake.query.listen ?? '') === 'true';

    if (!listenOnly && !sessionId) {
      throw new Error('Credenciais WebSocket ausentes.');
    }

    if (role === 'guest') {
      const claims = this.guestJwt.verify(token);
      if (claims.sessionId !== sessionId) {
        throw new Error('Sessão inválida para visitante.');
      }
      return { role: 'guest', sessionId };
    }

    if (role === 'resident') {
      const claims = await this.authAdapter.verifyAccessToken(token);
      return {
        role: 'resident',
        sessionId: listenOnly ? 'listen' : sessionId,
        userId: claims.sub,
      };
    }

    throw new Error('Papel WebSocket inválido.');
  }
}
