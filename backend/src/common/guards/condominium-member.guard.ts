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
import {
  MembershipStatus,
  UserCondominium,
} from '../../database/entities/user-condominium.entity';

/**
 * Garante que o usuário autenticado é membro do condomínio referenciado
 * pela rota (parâmetro `:condominiumId`).
 *
 * Sempre devolve 403 quando o usuário **não** é membro — não usamos 404
 * de propósito porque 404 vazaria a existência do condomínio para
 * usuários não autorizados (regra do guia 7.3).
 */
@Injectable()
export class CondominiumMemberGuard implements CanActivate {
  constructor(
    @InjectRepository(UserCondominium)
    private readonly membershipRepo: Repository<UserCondominium>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as { id: string } | undefined;
    if (!user?.id) {
      throw new UnauthorizedException('Autenticação obrigatória.');
    }
    const condominiumId =
      (request.params?.condominiumId as string) ||
      (request.params?.condId as string);
    if (!condominiumId) {
      throw new ForbiddenException('Parâmetro condominiumId ausente na rota.');
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
