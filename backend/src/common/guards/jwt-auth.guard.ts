import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AUTH_ADAPTER, IAuthAdapter } from '../../adapters/auth/auth.adapter';
import { Inject } from '@nestjs/common';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { RequestUser } from '../interfaces/request-user.interface';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(AUTH_ADAPTER) private readonly authAdapter: IAuthAdapter,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }
    const token = authHeader.slice(7);
    try {
      const claims = await this.authAdapter.verifyAccessToken(token);
      request.user = {
        id: claims.sub,
        email: claims.email,
        realmRoles: claims.realmRoles,
      } as RequestUser;
      return true;
    } catch {
      throw new UnauthorizedException('Token inválido ou expirado.');
    }
  }
}
