import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { UserRole } from '../enums';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { CondominiumMembershipContext } from '../interfaces/request-user.interface';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) {
      return true;
    }
    const request = context.switchToHttp().getRequest<Request>();
    const membership = request.condominiumMembership as
      | CondominiumMembershipContext
      | undefined;
    if (!membership) {
      throw new ForbiddenException(
        'Membership de condomínio obrigatório para acessar este recurso.',
      );
    }
    if (!required.includes(membership.role)) {
      throw new ForbiddenException(
        'Você não tem permissão (papel) suficiente para esta operação.',
      );
    }
    return true;
  }
}
