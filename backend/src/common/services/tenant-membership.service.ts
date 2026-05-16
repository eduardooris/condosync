import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole } from '../enums';
import { Resident } from '../../database/entities/resident.entity';
import {
  MembershipStatus,
  UserCondominium,
} from '../../database/entities/user-condominium.entity';

/**
 * Regras de tenancy por condomínio: membership aprovado, papéis admin e
 * unidades às quais o usuário autenticado tem acesso (morador e/ou
 * `user_condominiums.unit_id`).
 */
@Injectable()
export class TenantMembershipService {
  constructor(
    @InjectRepository(UserCondominium)
    private readonly membershipRepo: Repository<UserCondominium>,
    @InjectRepository(Resident)
    private readonly residentRepo: Repository<Resident>,
  ) {}

  async findApprovedMembership(
    userId: string,
    condominiumId: string,
  ): Promise<UserCondominium | null> {
    return this.membershipRepo.findOne({
      where: {
        userId,
        condominiumId,
        status: MembershipStatus.APPROVED,
      },
    });
  }

  async requireApprovedMembership(
    userId: string,
    condominiumId: string,
  ): Promise<UserCondominium> {
    const row = await this.findApprovedMembership(userId, condominiumId);
    if (!row) {
      throw new ForbiddenException('Você não tem acesso a este condomínio.');
    }
    return row;
  }

  async assertAdminOrSub(userId: string, condominiumId: string): Promise<void> {
    const row = await this.requireApprovedMembership(userId, condominiumId);
    if (row.role !== UserRole.ADMIN && row.role !== UserRole.SUB_ADMIN) {
      throw new ForbiddenException(
        'Apenas síndico ou subsíndico podem executar esta ação.',
      );
    }
  }

  /**
   * Unidades do usuário no condomínio: `residents.user_id` e/ou
   * `user_condominiums.unit_id` (membership aprovado).
   */
  async resolveMineUnitIds(
    userId: string,
    condominiumId: string,
  ): Promise<string[]> {
    const [residents, membership] = await Promise.all([
      this.residentRepo
        .createQueryBuilder('r')
        .innerJoin('r.unit', 'u')
        .where('r.user_id = :userId', { userId })
        .andWhere('u.condominium_id = :condominiumId', { condominiumId })
        .getMany(),
      this.findApprovedMembership(userId, condominiumId),
    ]);

    const unitIds = new Set(residents.map((r) => r.unitId));
    if (membership?.unitId) {
      unitIds.add(membership.unitId);
    }
    return [...unitIds];
  }

  /** Evita vazamento: 404 quando a unidade não pertence ao usuário. */
  async assertUserOwnsUnit(
    userId: string,
    condominiumId: string,
    unitId: string,
  ): Promise<void> {
    const unitIds = await this.resolveMineUnitIds(userId, condominiumId);
    if (!unitIds.includes(unitId)) {
      throw new NotFoundException('Recurso não encontrado.');
    }
  }

  /**
   * Morador autor de ações na unidade (ocorrência, reserva, visitante).
   * Aceita vínculo por `residents.user_id` ou unidade do membership; se o
   * cadastro ainda não tem `user_id`, usa o morador da unidade.
   */
  async findResidentOnOwnedUnit(
    userId: string,
    condominiumId: string,
    unitId: string,
  ): Promise<Resident> {
    await this.assertUserOwnsUnit(userId, condominiumId, unitId);

    const linked = await this.residentRepo.findOne({
      where: { unitId, userId },
      order: { updatedAt: 'DESC' },
    });
    if (linked) {
      return linked;
    }

    const onUnit = await this.residentRepo.findOne({
      where: { unitId },
      order: { updatedAt: 'DESC' },
    });
    if (!onUnit) {
      throw new ForbiddenException(
        'Cadastro de morador não encontrado para esta unidade.',
      );
    }
    return onUnit;
  }

  /** Perfil `/residents/me` — exige membership com unidade resolvível. */
  async findMyResidentOrFail(
    condominiumId: string,
    userId: string,
  ): Promise<Resident> {
    const membership = await this.requireApprovedMembership(
      userId,
      condominiumId,
    );
    const unitIds = await this.resolveMineUnitIds(userId, condominiumId);
    const unitId = membership.unitId ?? unitIds[0];
    if (!unitId) {
      throw new BadRequestException(
        'Seu perfil neste condomínio não está vinculado a uma unidade.',
      );
    }
    return this.findResidentOnOwnedUnit(userId, condominiumId, unitId);
  }
}
