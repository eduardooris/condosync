import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UnitStatus, UserRole } from '../../common/enums';
import {
  MembershipStatus,
  UserCondominium,
} from '../../database/entities/user-condominium.entity';
import { Unit } from '../../database/entities/unit.entity';
import { Resident } from '../../database/entities/resident.entity';
import { User } from '../../database/entities/user.entity';
import { MemberResponseDto } from './dto/member-response.dto';
import { ApproveMemberDto, UpdateMemberDto } from './dto/member-actions.dto';
import { KeycloakAdminClient } from '../../adapters/auth/keycloak-admin.client';

@Injectable()
export class MembersService {
  private readonly logger = new Logger(MembersService.name);

  constructor(
    @InjectRepository(UserCondominium)
    private readonly ucRepo: Repository<UserCondominium>,
    @InjectRepository(Unit)
    private readonly unitRepo: Repository<Unit>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Resident)
    private readonly residentRepo: Repository<Resident>,
    private readonly keycloakAdmin: KeycloakAdminClient,
  ) {}

  // -----------------------------------------------------------------
  // Listagens
  // -----------------------------------------------------------------

  async listApproved(condominiumId: string): Promise<MemberResponseDto[]> {
    const rows = await this.ucRepo.find({
      where: { condominiumId, status: MembershipStatus.APPROVED },
      relations: ['user'],
      order: { createdAt: 'ASC' },
    });
    return rows.map((r) => this.toResponse(r));
  }

  async listPending(condominiumId: string): Promise<MemberResponseDto[]> {
    const rows = await this.ucRepo.find({
      where: { condominiumId, status: MembershipStatus.PENDING },
      relations: ['user'],
      order: { createdAt: 'ASC' },
    });
    return rows.map((r) => this.toResponse(r));
  }

  // -----------------------------------------------------------------
  // Aprovar / rejeitar PENDING
  // -----------------------------------------------------------------

  async approve(
    condominiumId: string,
    membershipId: string,
    dto: ApproveMemberDto,
  ): Promise<MemberResponseDto> {
    const m = await this.findPendingOrFail(condominiumId, membershipId);
    if (dto.role === UserRole.ADMIN) {
      throw new ForbiddenException(
        'Não é possível aprovar membros como ADMIN. Use o fluxo de transferência de titularidade.',
      );
    }
    if (dto.unitId) {
      await this.assertUnitInCondo(dto.unitId, condominiumId);
    }
    const previousUnitId = m.unitId;
    const userId = m.userId;
    const newRole = dto.role;
    const newUnitId = dto.unitId ?? null;
    const wantsResidentRow =
      (newRole === UserRole.RESIDENT || newRole === UserRole.RESPONSIBLE) &&
      !!newUnitId;
    const existingResident = previousUnitId
      ? await this.residentRepo.findOne({
          where: { userId, unitId: previousUnitId },
        })
      : null;
    if (wantsResidentRow && existingResident && newUnitId !== previousUnitId) {
      const clash = await this.residentRepo.findOne({
        where: { unitId: newUnitId!, cpf: existingResident.cpf },
      });
      if (clash) {
        throw new ConflictException(
          'Já existe um morador com este CPF na unidade selecionada.',
        );
      }
    }
    // Garante reativação de contas antigas que possam ter sido desabilitadas
    // em fluxos anteriores de remoção/rejeição.
    try {
      await this.keycloakAdmin.setUserEnabled(m.userId, true);
    } catch (err) {
      this.logger.warn(
        `Não foi possível reativar o usuário ${m.userId} no Keycloak ao aprovar membership: ${(err as Error).message}`,
      );
    }
    m.role = newRole;
    m.unitId = newUnitId;
    m.status = MembershipStatus.APPROVED;
    const saved = await this.ucRepo.save(m);

    if (!wantsResidentRow) {
      if (existingResident) {
        await this.residentRepo.remove(existingResident);
        if (previousUnitId) await this.refreshOccupation(previousUnitId);
      }
    } else if (existingResident && existingResident.unitId !== newUnitId) {
      existingResident.unitId = newUnitId!;
      await this.residentRepo.save(existingResident);
      if (previousUnitId) await this.refreshOccupation(previousUnitId);
      await this.refreshOccupation(newUnitId!);
    }

    return this.toResponse(await this.reloadWithUser(saved.id));
  }

  private async refreshOccupation(unitId: string): Promise<void> {
    const count = await this.residentRepo.count({ where: { unitId } });
    if (count > 0) {
      await this.unitRepo.update(
        { id: unitId, status: UnitStatus.VACANT },
        { status: UnitStatus.OCCUPIED },
      );
    } else {
      await this.unitRepo.update(
        { id: unitId, status: UnitStatus.OCCUPIED },
        { status: UnitStatus.VACANT },
      );
    }
  }

  async reject(condominiumId: string, membershipId: string): Promise<void> {
    const m = await this.findPendingOrFail(condominiumId, membershipId);
    const userId = m.userId;
    const unitId = m.unitId;
    await this.ucRepo.remove(m);
    if (unitId) {
      await this.residentRepo.delete({ userId, unitId });
      await this.refreshOccupation(unitId);
    }
    await this.maybeDeleteUserIfOrphan(userId);
  }

  // -----------------------------------------------------------------
  // Atualizar role/unit (APROVADO)
  // -----------------------------------------------------------------

  async update(
    condominiumId: string,
    membershipId: string,
    dto: UpdateMemberDto,
  ): Promise<MemberResponseDto> {
    const m = await this.findApprovedOrFail(condominiumId, membershipId);

    if (dto.role && dto.role !== m.role) {
      if (dto.role === UserRole.ADMIN) {
        throw new ForbiddenException(
          'Não é possível promover diretamente para ADMIN. Use o fluxo de transferência.',
        );
      }
      if (m.role === UserRole.ADMIN) {
        // Garante que ainda haverá pelo menos 1 ADMIN.
        const otherAdmins = await this.ucRepo.count({
          where: {
            condominiumId,
            role: UserRole.ADMIN,
            status: MembershipStatus.APPROVED,
          },
        });
        if (otherAdmins <= 1) {
          throw new ConflictException(
            'O condomínio precisa ter pelo menos um ADMIN.',
          );
        }
      }
      m.role = dto.role;
    }

    if (dto.unitId !== undefined) {
      if (dto.unitId) {
        await this.assertUnitInCondo(dto.unitId, condominiumId);
      }
      m.unitId = dto.unitId;
    }

    const saved = await this.ucRepo.save(m);
    return this.toResponse(await this.reloadWithUser(saved.id));
  }

  // -----------------------------------------------------------------
  // Remover membro
  // -----------------------------------------------------------------

  async remove(condominiumId: string, membershipId: string): Promise<void> {
    const m = await this.ucRepo.findOne({
      where: { id: membershipId, condominiumId },
    });
    if (!m) {
      throw new NotFoundException('Membership não encontrado.');
    }
    if (m.role === UserRole.ADMIN) {
      const otherAdmins = await this.ucRepo.count({
        where: {
          condominiumId,
          role: UserRole.ADMIN,
          status: MembershipStatus.APPROVED,
        },
      });
      if (otherAdmins <= 1) {
        throw new ConflictException(
          'Não é possível remover o último ADMIN do condomínio.',
        );
      }
    }
    const userId = m.userId;
    await this.ucRepo.remove(m);
    await this.maybeDeleteUserIfOrphan(userId);
  }

  private async maybeDeleteUserIfOrphan(userId: string): Promise<void> {
    const remaining = await this.ucRepo.count({ where: { userId } });
    if (remaining > 0) return;
    const linkedResidents = await this.residentRepo.count({
      where: { userId },
    });
    if (linkedResidents > 0) return;
    try {
      await this.keycloakAdmin.deleteUser(userId);
      await this.userRepo.delete({ id: userId });
    } catch (err) {
      this.logger.warn(
        `Não foi possível remover usuário órfão ${userId}: ${(err as Error).message}`,
      );
    }
  }

  // -----------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------

  private async findPendingOrFail(
    condominiumId: string,
    membershipId: string,
  ): Promise<UserCondominium> {
    const m = await this.ucRepo.findOne({
      where: {
        id: membershipId,
        condominiumId,
        status: MembershipStatus.PENDING,
      },
    });
    if (!m) {
      throw new NotFoundException('Membership pendente não encontrado.');
    }
    return m;
  }

  private async findApprovedOrFail(
    condominiumId: string,
    membershipId: string,
  ): Promise<UserCondominium> {
    const m = await this.ucRepo.findOne({
      where: {
        id: membershipId,
        condominiumId,
        status: MembershipStatus.APPROVED,
      },
    });
    if (!m) {
      throw new NotFoundException('Membership aprovado não encontrado.');
    }
    return m;
  }

  private async reloadWithUser(membershipId: string): Promise<UserCondominium> {
    const m = await this.ucRepo.findOne({
      where: { id: membershipId },
      relations: ['user'],
    });
    if (!m) {
      throw new NotFoundException('Membership não encontrado.');
    }
    return m;
  }

  private async assertUnitInCondo(
    unitId: string,
    condominiumId: string,
  ): Promise<void> {
    const unit = await this.unitRepo.findOne({
      where: { id: unitId, condominiumId },
    });
    if (!unit) {
      throw new BadRequestException('Unidade não pertence a este condomínio.');
    }
  }

  private toResponse(m: UserCondominium): MemberResponseDto {
    const user = m.user as User | undefined;
    return {
      membershipId: m.id,
      userId: m.userId,
      email: user?.email ?? '',
      fullName: user?.fullName ?? null,
      role: m.role,
      status: m.status,
      unitId: m.unitId,
      createdAt: m.createdAt,
    };
  }
}
