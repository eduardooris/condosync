import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Request } from 'express';
import { Repository } from 'typeorm';
import { Condominium } from '../../database/entities/condominium.entity';
import {
  MembershipStatus,
  UserCondominium,
} from '../../database/entities/user-condominium.entity';
import { UserRole } from '../enums';
import { RequestUser } from '../interfaces/request-user.interface';
import { MasterRoleGuard } from './master-role.guard';

/**
 * Igual ao `CondominiumMemberGuard`, mas operadores com realm role
 * `master-admin` (back-office) podem agir em qualquer condomínio existente
 * sem membership local — usado só em rotas `/payment-account/dev/*`.
 *
 * Para `master-admin`, injeta membership sintética com papel `ADMIN` para o
 * `RolesGuard` downstream continuar funcionando.
 */
@Injectable()
export class CondominiumMemberOrMasterGuard implements CanActivate {
  constructor(
    @InjectRepository(UserCondominium)
    private readonly membershipRepo: Repository<UserCondominium>,
    @InjectRepository(Condominium)
    private readonly condoRepo: Repository<Condominium>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as RequestUser | undefined;
    if (!user?.id) {
      throw new UnauthorizedException('Autenticação obrigatória.');
    }
    const condominiumId =
      (request.params?.condominiumId as string) ||
      (request.params?.condId as string);
    if (!condominiumId) {
      throw new ForbiddenException('Parâmetro condominiumId ausente na rota.');
    }

    const isMaster = (user.realmRoles ?? []).includes(
      MasterRoleGuard.REQUIRED_ROLE,
    );
    if (isMaster) {
      const exists = await this.condoRepo.exist({
        where: { id: condominiumId },
      });
      if (!exists) {
        throw new ForbiddenException('Você não tem acesso a este condomínio.');
      }
      request.condominiumMembership = {
        condominiumId,
        role: UserRole.ADMIN,
      };
      return true;
    }

    const row = await this.membershipRepo.findOne({
      where: {
        userId: user.id,
        condominiumId,
        status: MembershipStatus.APPROVED,
      },
    });
    if (!row) {
      throw new ForbiddenException('Você não tem acesso a este condomínio.');
    }
    request.condominiumMembership = {
      condominiumId,
      role: row.role,
    };
    return true;
  }
}
