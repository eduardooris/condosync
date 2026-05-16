import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { Env } from '../../config/env.schema';

/**
 * Protege rotas operacionais do message-server (QR etc.) fora de dev.
 * Em produção exige `Authorization: Bearer <MESSAGE_SERVER_API_KEY>`.
 */
@Injectable()
export class MessageServerInternalGuard implements CanActivate {
  constructor(private readonly config: ConfigService<Env, true>) {}

  canActivate(context: ExecutionContext): boolean {
    if (this.config.get('NODE_ENV', { infer: true }) !== 'production') {
      return true;
    }

    const apiKey = this.config.get('MESSAGE_SERVER_API_KEY', { infer: true });
    if (!apiKey?.trim()) {
      throw new UnauthorizedException(
        'MESSAGE_SERVER_API_KEY não configurada.',
      );
    }

    const request = context.switchToHttp().getRequest<Request>();
    const auth = request.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Authorization Bearer obrigatório.');
    }
    const token = auth.slice(7);
    if (token !== apiKey) {
      throw new UnauthorizedException('API key inválida.');
    }
    return true;
  }
}
