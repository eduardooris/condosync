import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Inject } from '@nestjs/common';
import { DataSource, In, Repository } from 'typeorm';
import { randomBytes } from 'node:crypto';
import { Unit } from '../../database/entities/unit.entity';
import { Condominium } from '../../database/entities/condominium.entity';
import { UserCondominium } from '../../database/entities/user-condominium.entity';
import { User } from '../../database/entities/user.entity';
import {
  isValidBrazilWhatsapp,
  isValidCpfDigits,
  normalizeBrazilWhatsapp,
  normalizeCpf,
} from '../../common/utils/br-documents';
import { CreateResidentDto } from './dto/create-resident.dto';
import { UpdateResidentDto } from './dto/update-resident.dto';
import { Resident } from '../../database/entities/resident.entity';
import { FinancialResponsibleHistory } from '../../database/entities/financial-responsible-history.entity';
import { ResidentsRepository } from './residents.repository';
import { NeighborResidentResponseDto } from './dto/resident-response.dto';
import { UnitStatus as UnitStatusEnum, UserRole } from '../../common/enums';
import { KeycloakAdminClient } from '../../adapters/auth/keycloak-admin.client';
import {
  IWhatsAppAdapter,
  WHATSAPP_ADAPTER,
} from '../../adapters/whatsapp/whatsapp.adapter';
import { MembershipStatus } from '../../database/entities/user-condominium.entity';
import { UsersService } from '../users/users.service';

@Injectable()
export class ResidentsService {
  private readonly logger = new Logger(ResidentsService.name);

  constructor(
    private readonly residentsRepo: ResidentsRepository,
    @InjectRepository(Unit)
    private readonly unitRepo: Repository<Unit>,
    @InjectRepository(Resident)
    private readonly residentRawRepo: Repository<Resident>,
    @InjectRepository(UserCondominium)
    private readonly membershipRepo: Repository<UserCondominium>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly keycloakAdmin: KeycloakAdminClient,
    private readonly usersService: UsersService,
    @Inject(WHATSAPP_ADAPTER)
    private readonly whatsapp: IWhatsAppAdapter,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  private async loadUnit(condominiumId: string, unitId: string): Promise<Unit> {
    const unit = await this.unitRepo.findOne({
      where: { id: unitId, condominiumId },
    });
    if (!unit) {
      throw new NotFoundException('Unidade não encontrada.');
    }
    return unit;
  }

  private validateFinancialFields(dto: {
    cpf: string;
    phoneWhatsapp: string;
    isFinancialResponsible?: boolean;
  }) {
    if (dto.isFinancialResponsible) {
      if (!isValidCpfDigits(dto.cpf)) {
        throw new BadRequestException(
          'CPF inválido para responsável financeiro (verifique os dígitos verificadores).',
        );
      }
      if (!isValidBrazilWhatsapp(dto.phoneWhatsapp)) {
        throw new BadRequestException(
          'WhatsApp inválido para responsável financeiro.',
        );
      }
    }
  }

  async create(
    condominiumId: string,
    unitId: string,
    dto: CreateResidentDto,
  ): Promise<Resident> {
    await this.loadUnit(condominiumId, unitId);
    const condominium = await this.dataSource
      .getRepository(Condominium)
      .findOne({
        where: { id: condominiumId },
      });
    const condominiumName = condominium?.name ?? 'seu condomínio';
    const normalizedEmail = dto.email?.trim().toLowerCase();
    if (!normalizedEmail) {
      throw new BadRequestException(
        'E-mail é obrigatório para criar acesso do morador.',
      );
    }
    const willBeResponsible = dto.isFinancialResponsible === true;
    this.validateFinancialFields({
      cpf: dto.cpf,
      phoneWhatsapp: dto.phoneWhatsapp,
      isFinancialResponsible: willBeResponsible,
    });

    if (willBeResponsible) {
      // Toda promoção a responsável precisa rodar dentro de uma
      // transação SERIALIZABLE — caso contrário dois requests
      // concorrentes podem deixar a unidade com 2 responsáveis.
      return this.dataSource.transaction('SERIALIZABLE', async (manager) => {
        const provisioned = await this.provisionResidentAccess({
          condominiumId,
          unitId,
          email: normalizedEmail,
          fullName: dto.fullName,
          isFinancialResponsible: true,
        });
        await this.clearOtherResponsiblesTx(manager, unitId);
        await this.closeOpenHistoryTx(manager, unitId);
        const r = manager.getRepository(Resident).create({
          unitId,
          userId: provisioned.userId,
          fullName: dto.fullName,
          cpf: normalizeCpf(dto.cpf),
          phoneWhatsapp: normalizeBrazilWhatsapp(dto.phoneWhatsapp),
          email: normalizedEmail,
          isFinancialResponsible: true,
        });
        const saved = await manager.getRepository(Resident).save(r);
        await manager
          .getRepository(Unit)
          .update(
            { id: unitId, status: UnitStatusEnum.VACANT },
            { status: UnitStatusEnum.OCCUPIED },
          );
        await manager.getRepository(FinancialResponsibleHistory).save(
          manager.getRepository(FinancialResponsibleHistory).create({
            unitId,
            residentId: saved.id,
            startedAt: new Date(),
            endedAt: null,
          }),
        );
        await this.sendPasswordSetupIfNeeded(
          provisioned.isNewUser,
          saved.phoneWhatsapp,
          normalizedEmail,
          condominiumName,
        );
        return saved;
      });
    }

    const provisioned = await this.provisionResidentAccess({
      condominiumId,
      unitId,
      email: normalizedEmail,
      fullName: dto.fullName,
      isFinancialResponsible: false,
    });
    const r = this.residentsRepo.create({
      unitId,
      userId: provisioned.userId,
      fullName: dto.fullName,
      cpf: normalizeCpf(dto.cpf),
      phoneWhatsapp: normalizeBrazilWhatsapp(dto.phoneWhatsapp),
      email: normalizedEmail,
      isFinancialResponsible: false,
    });
    const saved = await this.residentsRepo.save(r);
    await this.unitRepo.update(
      { id: unitId, status: UnitStatusEnum.VACANT },
      { status: UnitStatusEnum.OCCUPIED },
    );
    await this.sendPasswordSetupIfNeeded(
      provisioned.isNewUser,
      saved.phoneWhatsapp,
      normalizedEmail,
      condominiumName,
    );
    return saved;
  }

  async list(condominiumId: string, unitId: string): Promise<Resident[]> {
    await this.loadUnit(condominiumId, unitId);
    const residents = await this.residentsRepo.findByUnit(unitId);
    if (residents.length > 0) {
      await this.syncUnitOccupation(unitId);
    }
    return residents;
  }

  async listNeighbors(
    condominiumId: string,
  ): Promise<NeighborResidentResponseDto[]> {
    const rows = await this.residentRawRepo
      .createQueryBuilder('r')
      .innerJoin('r.unit', 'u')
      .where('u.condominium_id = :condominiumId', { condominiumId })
      .select([
        'r.id AS id',
        'r.full_name AS "fullName"',
        'u.block AS block',
        'u.number AS number',
      ])
      .orderBy('u.block')
      .addOrderBy('u.number')
      .addOrderBy('r.full_name')
      .getRawMany<NeighborResidentResponseDto>();
    return rows;
  }

  async getMyProfile(condominiumId: string, userId: string): Promise<Resident> {
    return this.findMyResidentOrFail(condominiumId, userId);
  }

  async updateMyProfile(
    condominiumId: string,
    userId: string,
    dto: { fullName?: string; phoneWhatsapp?: string },
  ): Promise<Resident> {
    const resident = await this.findMyResidentOrFail(condominiumId, userId);
    if (dto.fullName !== undefined) {
      const next = dto.fullName.trim();
      if (!next) {
        throw new BadRequestException('Nome completo é obrigatório.');
      }
      resident.fullName = next;
    }
    if (dto.phoneWhatsapp !== undefined) {
      const next = dto.phoneWhatsapp.trim();
      if (!isValidBrazilWhatsapp(next)) {
        throw new BadRequestException(
          'Informe um WhatsApp válido (DDD + número, 10 a 13 dígitos com DDI opcional).',
        );
      }
      resident.phoneWhatsapp = normalizeBrazilWhatsapp(next);
    }
    return this.residentsRepo.save(resident);
  }

  async update(
    condominiumId: string,
    unitId: string,
    id: string,
    dto: UpdateResidentDto,
  ): Promise<Resident> {
    await this.loadUnit(condominiumId, unitId);
    const r = await this.residentsRepo.findById(id, unitId);
    if (!r) {
      throw new NotFoundException('Morador não encontrado nesta unidade.');
    }
    const nextCpf = dto.cpf !== undefined ? dto.cpf : r.cpf;
    const nextWa =
      dto.phoneWhatsapp !== undefined ? dto.phoneWhatsapp : r.phoneWhatsapp;
    const nextFlag =
      dto.isFinancialResponsible !== undefined
        ? dto.isFinancialResponsible
        : r.isFinancialResponsible;
    this.validateFinancialFields({
      cpf: nextCpf,
      phoneWhatsapp: nextWa,
      isFinancialResponsible: nextFlag,
    });
    if (dto.userId !== undefined) r.userId = dto.userId;
    if (dto.fullName !== undefined) r.fullName = dto.fullName;
    if (dto.cpf !== undefined) r.cpf = normalizeCpf(dto.cpf);
    if (dto.phoneWhatsapp !== undefined) {
      r.phoneWhatsapp = normalizeBrazilWhatsapp(dto.phoneWhatsapp);
    }
    if (dto.email !== undefined) r.email = dto.email;

    if (dto.isFinancialResponsible === true && !r.isFinancialResponsible) {
      return this.promoteToResponsible(unitId, r);
    }
    if (dto.isFinancialResponsible === false && r.isFinancialResponsible) {
      r.isFinancialResponsible = false;
      await this.residentsRepo.closeHistoryForResident(r.id);
    }
    const saved = await this.residentsRepo.save(r);
    await this.syncUnitOccupation(unitId);
    return saved;
  }

  async setResponsible(
    condominiumId: string,
    unitId: string,
    residentId: string,
  ): Promise<Resident> {
    await this.loadUnit(condominiumId, unitId);
    const r = await this.residentsRepo.findById(residentId, unitId);
    if (!r) {
      throw new NotFoundException('Morador não encontrado nesta unidade.');
    }
    this.validateFinancialFields({
      cpf: r.cpf,
      phoneWhatsapp: r.phoneWhatsapp,
      isFinancialResponsible: true,
    });
    const saved = await this.promoteToResponsible(unitId, r);
    await this.syncUnitOccupation(unitId);
    return saved;
  }

  async remove(
    condominiumId: string,
    unitId: string,
    residentId: string,
  ): Promise<void> {
    await this.loadUnit(condominiumId, unitId);
    const resident = await this.residentsRepo.findById(residentId, unitId);
    if (!resident) {
      throw new NotFoundException('Morador não encontrado nesta unidade.');
    }
    const residentsCount = await this.residentRawRepo.count({
      where: { unitId },
    });
    if (resident.isFinancialResponsible && residentsCount > 1) {
      throw new BadRequestException(
        'Defina outro responsável financeiro antes de remover este morador.',
      );
    }
    await this.residentsRepo.closeHistoryForResident(resident.id);
    await this.residentRawRepo.remove(resident);
    await this.syncUnitOccupation(unitId);
    await this.maybeDeleteResidentUserAccount(condominiumId, resident.userId);
  }

  private async maybeDeleteResidentUserAccount(
    condominiumId: string,
    userId: string | null | undefined,
  ): Promise<void> {
    if (!userId) return;

    const adminMemberships = await this.membershipRepo.count({
      where: {
        userId,
        role: In([UserRole.ADMIN, UserRole.SUB_ADMIN]),
      },
    });
    if (adminMemberships > 0) {
      await this.membershipRepo.delete({
        condominiumId,
        userId,
        role: In([UserRole.RESIDENT, UserRole.RESPONSIBLE]),
      });
      this.logger.log(
        `Usuário ${userId} mantido por vínculo de administração; removidos vínculos RESIDENT/RESPONSIBLE do condomínio ${condominiumId}.`,
      );
      return;
    }

    await this.membershipRepo.delete({
      userId,
      role: In([UserRole.RESIDENT, UserRole.RESPONSIBLE]),
    });

    const [memberships, residents] = await Promise.all([
      this.membershipRepo.count({ where: { userId } }),
      this.residentRawRepo.count({ where: { userId } }),
    ]);
    if (memberships > 0 || residents > 0) {
      this.logger.warn(
        `Usuário ${userId} não ficou órfão após remoção de morador (memberships=${memberships}, residents=${residents}).`,
      );
      return;
    }

    try {
      await this.keycloakAdmin.deleteUser(userId);
      await this.userRepo.delete({ id: userId });
    } catch (error) {
      this.logger.warn(
        `Não foi possível remover usuário órfão ${userId} no Keycloak/local: ${(error as Error).message}`,
      );
    }
  }

  private async provisionResidentAccess(params: {
    condominiumId: string;
    unitId: string;
    email: string;
    fullName: string;
    isFinancialResponsible: boolean;
  }): Promise<{ userId: string; isNewUser: boolean }> {
    const email = params.email.toLowerCase();
    const existing = await this.keycloakAdmin.findUserByEmail(email);
    let userId: string;
    let isNewUser = false;
    if (existing) {
      userId = existing.id;
      await this.usersService.ensureFromAuth({
        id: userId,
        email,
        fullName: params.fullName,
      });
      try {
        await this.keycloakAdmin.setUserEnabled(userId, true);
      } catch (error) {
        this.logger.warn(
          `Não foi possível reativar usuário ${userId} no Keycloak: ${(error as Error).message}`,
        );
      }
    } else {
      isNewUser = true;
      const bootstrapPassword = `Tmp!${randomBytes(18).toString('base64url')}`;
      userId = await this.keycloakAdmin.createUser({
        email,
        password: bootstrapPassword,
        fullName: params.fullName,
        assignCondoAdmin: false,
      });
      await this.usersService.ensureFromAuth({
        id: userId,
        email,
        fullName: params.fullName,
      });
    }
    const role = params.isFinancialResponsible
      ? UserRole.RESPONSIBLE
      : UserRole.RESIDENT;
    const membership = await this.membershipRepo.findOne({
      where: { userId, condominiumId: params.condominiumId },
    });
    if (!membership) {
      await this.membershipRepo.save(
        this.membershipRepo.create({
          userId,
          condominiumId: params.condominiumId,
          unitId: params.unitId,
          role,
          status: MembershipStatus.APPROVED,
        }),
      );
      return { userId, isNewUser };
    }
    if (membership.status !== MembershipStatus.APPROVED) {
      membership.status = MembershipStatus.APPROVED;
    }
    if (
      membership.role === UserRole.RESIDENT &&
      role === UserRole.RESPONSIBLE
    ) {
      membership.role = UserRole.RESPONSIBLE;
    }
    if (
      membership.role === UserRole.RESIDENT ||
      membership.role === UserRole.RESPONSIBLE
    ) {
      membership.unitId = params.unitId;
    }
    await this.membershipRepo.save(membership);
    return { userId, isNewUser };
  }

  private async sendPasswordSetupIfNeeded(
    isNewUser: boolean,
    phoneWhatsapp: string,
    email: string,
    condominiumName: string,
  ): Promise<void> {
    try {
      let msg = '';
      if (isNewUser) {
        const temporaryPassword = `Condo@${randomBytes(4).toString('hex')}`;
        const user = await this.keycloakAdmin.findUserByEmail(email);
        if (!user?.id) {
          this.logger.warn(
            `Não foi possível localizar usuário novo no Keycloak para envio via WhatsApp: ${email}`,
          );
          return;
        }
        await this.keycloakAdmin.setPassword(user.id, temporaryPassword);
        msg = [
          `Olá! Seu acesso ao app do condomínio *${condominiumName}* foi criado.`,
          '',
          `• Login: *${email}*`,
          `• Senha provisória: *${temporaryPassword}*`,
          '',
          'Entre no app e altere sua senha no primeiro acesso.',
        ].join('\n');
      } else {
        msg = [
          `Olá! Você foi vinculado(a) ao condomínio *${condominiumName}*.`,
          '',
          `• Login: *${email}*`,
          '',
          'Use sua senha atual para entrar no app. Se necessário, use "Esqueci minha senha" na tela de login.',
        ].join('\n');
      }
      await this.sendWhatsappWithRetry(phoneWhatsapp, msg);
    } catch (error) {
      this.logger.warn(
        `Não foi possível enviar credenciais iniciais por WhatsApp: ${(error as Error).message}`,
      );
    }
  }

  private async sendWhatsappWithRetry(
    phoneWhatsapp: string,
    message: string,
  ): Promise<void> {
    const attempts = 3;
    let lastError: unknown = null;
    for (let i = 1; i <= attempts; i += 1) {
      try {
        await this.whatsapp.sendMessage(phoneWhatsapp, message);
        if (i > 1) {
          this.logger.log(
            `Envio de credenciais via WhatsApp recuperado na tentativa ${i}.`,
          );
        }
        return;
      } catch (error) {
        lastError = error;
        if (i < attempts) {
          // A sessão WhatsApp pode estar reconectando no exato momento do cadastro.
          await new Promise((resolve) => setTimeout(resolve, i * 1500));
          continue;
        }
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error('Falha desconhecida ao enviar WhatsApp.');
  }

  private async syncUnitOccupation(unitId: string): Promise<void> {
    const residentsCount = await this.residentRawRepo.count({
      where: { unitId },
    });
    if (residentsCount > 0) {
      await this.unitRepo.update(
        { id: unitId, status: UnitStatusEnum.VACANT },
        { status: UnitStatusEnum.OCCUPIED },
      );
      return;
    }
    await this.unitRepo.update(
      { id: unitId, status: UnitStatusEnum.OCCUPIED },
      { status: UnitStatusEnum.VACANT },
    );
  }

  /**
   * Atomicamente:
   *  - Limpa o flag de `is_financial_responsible` dos demais moradores da unidade.
   *  - Fecha histórico aberto.
   *  - Marca este morador como responsável.
   *  - Abre novo registro em `financial_responsible_history`.
   *
   * Usa isolamento SERIALIZABLE para impedir race com `create` ou outro
   * `setResponsible` rodando em paralelo.
   */
  private async promoteToResponsible(
    unitId: string,
    resident: Resident,
  ): Promise<Resident> {
    return this.dataSource.transaction('SERIALIZABLE', async (manager) => {
      await this.clearOtherResponsiblesTx(manager, unitId);
      await this.closeOpenHistoryTx(manager, unitId);
      resident.isFinancialResponsible = true;
      const saved = await manager.getRepository(Resident).save(resident);
      await manager.getRepository(FinancialResponsibleHistory).save(
        manager.getRepository(FinancialResponsibleHistory).create({
          unitId,
          residentId: saved.id,
          startedAt: new Date(),
          endedAt: null,
        }),
      );
      return saved;
    });
  }

  private clearOtherResponsiblesTx(
    manager: import('typeorm').EntityManager,
    unitId: string,
  ) {
    return manager
      .getRepository(Resident)
      .update(
        { unitId, isFinancialResponsible: true },
        { isFinancialResponsible: false },
      );
  }

  private closeOpenHistoryTx(
    manager: import('typeorm').EntityManager,
    unitId: string,
  ) {
    return manager
      .getRepository(FinancialResponsibleHistory)
      .createQueryBuilder()
      .update(FinancialResponsibleHistory)
      .set({ endedAt: () => 'NOW()' })
      .where('unit_id = :unitId', { unitId })
      .andWhere('ended_at IS NULL')
      .execute();
  }

  private async findMyResidentOrFail(
    condominiumId: string,
    userId: string,
  ): Promise<Resident> {
    const membership = await this.membershipRepo.findOne({
      where: { condominiumId, userId, status: MembershipStatus.APPROVED },
    });
    if (!membership) {
      throw new NotFoundException('Vínculo do condomínio não encontrado.');
    }
    if (!membership.unitId) {
      throw new BadRequestException(
        'Seu perfil neste condomínio não está vinculado a uma unidade.',
      );
    }
    const resident = await this.residentRawRepo.findOne({
      where: { unitId: membership.unitId, userId },
      order: { updatedAt: 'DESC' },
    });
    if (!resident) {
      throw new NotFoundException(
        'Cadastro de morador não encontrado para sua unidade.',
      );
    }
    return resident;
  }
}
