import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { RequestUser } from '../interfaces/request-user.interface';

/**
 * Permite acesso somente a usuários com a realm role `master-admin`.
 *
 * Esta role é atribuída manualmente pelo dono do produto via console
 * Keycloak — não é criada por self-signup. Protege todo o namespace
 * `/api/v1/master/*` (back-office cross-tenant).
 *
 * **Aplicar SEMPRE em conjunto com `JwtAuthGuard`** — este guard só lê
 * `request.user.realmRoles`, que é populado pelo guard anterior.
 *
 * Por que role, não usuário hardcoded?
 *   - Múltiplos operadores possíveis no futuro (devs/suporte)
 *   - Revogação imediata via Keycloak (sem deploy)
 *   - Rastreabilidade: cada operador tem seu sub no audit log
 */
@Injectable()
export class MasterRoleGuard implements CanActivate {
  static readonly REQUIRED_ROLE = 'master-admin';

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request & { user?: RequestUser }>();
    const user = req.user;
    if (!user) {
      // JwtAuthGuard deveria ter populado — se não tem, é erro de wiring.
      throw new ForbiddenException('Sem contexto de usuário.');
    }
    const roles = user.realmRoles ?? [];
    if (!roles.includes(MasterRoleGuard.REQUIRED_ROLE)) {
      throw new ForbiddenException(
        'Acesso restrito ao back-office. Solicite a role master-admin.',
      );
    }
    return true;
  }
}
