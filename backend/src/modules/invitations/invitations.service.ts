import { createHash, randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Env } from '../../config/env.schema';
import { UserRole } from '../../common/enums';
import {
  CondominiumInvitation,
  InvitationStatus,
  InvitationType,
} from '../../database/entities/condominium-invitation.entity';
import {
  MembershipStatus,
  UserCondominium,
} from '../../database/entities/user-condominium.entity';
import { Resident } from '../../database/entities/resident.entity';
import { Unit } from '../../database/entities/unit.entity';
import { KeycloakAdminClient } from '../../adapters/auth/keycloak-admin.client';
import { AUTH_ADAPTER, IAuthAdapter } from '../../adapters/auth/auth.adapter';
import { UsersService } from '../users/users.service';
import { InvitationsRepository } from './invitations.repository';
import {
  AcceptInvitationDto,
  CreateInvitationDto,
} from './dto/invitation-request.dto';
import {
  InvitationPreviewDto,
  InvitationResponseDto,
} from './dto/invitation-response.dto';

const DEFAULT_EXPIRES_HOURS = 72;
const TOKEN_BYTES = 32;

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function generateToken(): string {
  // base64url, ~43 chars sem padding.
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

@Injectable()
export class InvitationsService {
  private readonly appPublicUrl: string;

  constructor(
    private readonly invitations: InvitationsRepository,
    private readonly admin: KeycloakAdminClient,
    private readonly usersService: UsersService,
    @Inject(AUTH_ADAPTER) private readonly authAdapter: IAuthAdapter,
    @InjectRepository(UserCondominium)
    private readonly ucRepo: Repository<UserCondominium>,
    @InjectRepository(Unit)
    private readonly unitRepo: Repository<Unit>,
    @InjectRepository(Resident)
    private readonly residentRepo: Repository<Resident>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    config: ConfigService<Env, true>,
  ) {
    this.appPublicUrl = (
      config.get('APP_PUBLIC_URL', { infer: true }) ?? ''
    ).replace(/\/$/, '');
  }

  // -----------------------------------------------------------------
  // Criar convite (ADMIN/SUB_ADMIN do condomínio)
  // -----------------------------------------------------------------

  async create(
    condominiumId: string,
    createdByUserId: string,
    dto: CreateInvitationDto,
  ): Promise<InvitationResponseDto> {
    if (dto.role === UserRole.ADMIN) {
      throw new ForbiddenException(
        'Convites não podem ter o papel ADMIN. Use um SUB_ADMIN ou transfira a titularidade.',
      );
    }
    if (
      dto.type === InvitationType.EMAIL_DIRECT &&
      dto.role !== UserRole.SUB_ADMIN
    ) {
      throw new BadRequestException(
        'Na gestão do condomínio, convite por e-mail é permitido apenas para SUB_ADMIN.',
      );
    }
    if (
      dto.type === InvitationType.GENERIC_LINK &&
      dto.role !== UserRole.RESIDENT
    ) {
      throw new BadRequestException(
        'Link genérico é exclusivo para autocadastro de moradores.',
      );
    }
    if (dto.type === InvitationType.GENERIC_LINK && dto.unitId) {
      throw new BadRequestException(
        'Link genérico não pode ficar preso a uma unidade. O morador escolhe a unidade no cadastro.',
      );
    }
    if (dto.type === InvitationType.EMAIL_DIRECT && dto.unitId) {
      throw new BadRequestException(
        'Convite de SUB_ADMIN não pode ser associado a unidade.',
      );
    }
    if (dto.unitId) {
      const unit = await this.unitRepo.findOne({
        where: { id: dto.unitId, condominiumId },
      });
      if (!unit) {
        throw new BadRequestException(
          'Unidade não pertence a este condomínio.',
        );
      }
    }
    if (dto.residentId && !dto.unitId) {
      throw new BadRequestException(
        'Ao informar residentId, o campo unitId também é obrigatório.',
      );
    }
    if (dto.residentId) {
      const resident = await this.residentRepo
        .createQueryBuilder('r')
        .innerJoin('r.unit', 'u')
        .where('r.id = :residentId', { residentId: dto.residentId })
        .andWhere('r.unit_id = :unitId', { unitId: dto.unitId })
        .andWhere('u.condominium_id = :condominiumId', { condominiumId })
        .getOne();
      if (!resident) {
        throw new BadRequestException(
          'Morador não encontrado para a unidade informada neste condomínio.',
        );
      }
    }
    if (dto.type === InvitationType.EMAIL_DIRECT && !dto.email) {
      throw new BadRequestException(
        'Convite EMAIL_DIRECT exige campo `email`.',
      );
    }

    const token = generateToken();
    const tokenHash = sha256(token);

    const expiresInHours = dto.expiresInHours ?? DEFAULT_EXPIRES_HOURS;
    const expiresAt = new Date(Date.now() + expiresInHours * 3600_000);

    const defaultMaxUses = dto.type === InvitationType.EMAIL_DIRECT ? 1 : 50;
    const maxUses = dto.maxUses ?? defaultMaxUses;

    const entity = this.invitations.create({
      condominiumId,
      createdByUserId,
      type: dto.type,
      tokenHash,
      email:
        dto.type === InvitationType.EMAIL_DIRECT
          ? dto.email!.toLowerCase()
          : null,
      role: dto.role,
      unitId: dto.unitId ?? null,
      residentId: dto.residentId ?? null,
      expiresAt,
      maxUses,
      usedCount: 0,
      status: InvitationStatus.ACTIVE,
    });

    const saved = await this.invitations.save(entity);
    return {
      ...this.toResponse(saved),
      url: this.buildInviteUrl(token),
    };
  }

  // -----------------------------------------------------------------
  // Listar convites ativos do condomínio (ADMIN/SUB_ADMIN)
  // -----------------------------------------------------------------

  async listByCondominium(
    condominiumId: string,
  ): Promise<InvitationResponseDto[]> {
    await this.invitations.expireOverdue();
    const rows = await this.invitations.listActiveByCondominium(condominiumId);
    return rows.map((r) => this.toResponse(r));
  }

  // -----------------------------------------------------------------
  // Revogar convite (ADMIN/SUB_ADMIN do condomínio dono)
  // -----------------------------------------------------------------

  async revoke(invitationId: string, userId: string): Promise<void> {
    const inv = await this.invitations.findById(invitationId);
    if (!inv) {
      throw new NotFoundException('Convite não encontrado.');
    }
    await this.assertCanManageCondo(inv.condominiumId, userId);
    inv.status = InvitationStatus.REVOKED;
    await this.invitations.save(inv);
  }

  // -----------------------------------------------------------------
  // Preview público (`GET /invitations/:token`)
  // -----------------------------------------------------------------

  async preview(token: string): Promise<InvitationPreviewDto> {
    const inv = await this.findActiveByToken(token);
    const units =
      inv.type === InvitationType.GENERIC_LINK && !inv.unitId
        ? await this.unitRepo.find({
            where: { condominiumId: inv.condominiumId },
            order: { block: 'ASC', number: 'ASC' },
            select: ['id', 'block', 'number'],
          })
        : [];
    return {
      condominiumName: inv.condominium.name,
      role: inv.role,
      type: inv.type,
      requiresApproval: inv.type === InvitationType.GENERIC_LINK,
      email: inv.email,
      unitId: inv.unitId,
      units,
    };
  }

  // -----------------------------------------------------------------
  // Aceitar convite (`POST /invitations/:token/accept`)
  // -----------------------------------------------------------------

  async accept(
    token: string,
    dto: AcceptInvitationDto,
  ): Promise<{
    accessToken: string | null;
    refreshToken: string | null;
    requiresApproval: boolean;
  }> {
    const inv = await this.findActiveByToken(token);
    let membershipUnitId = inv.unitId;
    if (!membershipUnitId && inv.type === InvitationType.GENERIC_LINK) {
      if (!dto.unitId) {
        throw new BadRequestException(
          'Selecione uma unidade para concluir seu cadastro.',
        );
      }
      const unit = await this.unitRepo.findOne({
        where: { id: dto.unitId, condominiumId: inv.condominiumId },
      });
      if (!unit) {
        throw new BadRequestException(
          'Unidade selecionada não pertence a este condomínio.',
        );
      }
      membershipUnitId = unit.id;
    }

    let email: string;
    if (inv.type === InvitationType.EMAIL_DIRECT) {
      email = inv.email!;
    } else {
      if (!dto.email) {
        throw new BadRequestException(
          'Email obrigatório para convite GENERIC_LINK.',
        );
      }
      email = dto.email.toLowerCase();
    }

    // Verifica se já existe usuário com esse email no Keycloak.
    const existing = await this.admin.findUserByEmail(email);
    let userId: string;
    let session: { accessToken: string; refreshToken: string } | null = null;

    if (existing) {
      // Usuário já existe — verifica se já é membro deste condomínio.
      userId = existing.id;
      await this.usersService.ensureFromAuth({
        id: userId,
        email,
        fullName: dto.fullName,
      });
      const alreadyMember = await this.ucRepo.findOne({
        where: { userId, condominiumId: inv.condominiumId },
      });
      if (alreadyMember) {
        throw new ConflictException('Você já é membro deste condomínio.');
      }
      // Para usuário existente, o aceite do convite exige senha da conta já
      // cadastrada. Sem isso o vínculo seria criado, mas o usuário poderia
      // ficar "aprovado sem conseguir entrar" por ter digitado uma senha nova
      // no form (que não atualiza a senha existente).
      try {
        session = await this.authAdapter.signInWithPassword(
          email,
          dto.password,
        );
      } catch {
        throw new BadRequestException(
          'Este e-mail já possui conta. Informe a senha atual para aceitar o convite.',
        );
      }
    } else {
      // Cria usuário no Keycloak SEM `condo-admin` (morador via convite).
      const result = await this.authAdapter.signUp({
        email,
        password: dto.password,
        fullName: dto.fullName,
        assignCondoAdmin: false,
      });
      userId = result.userId;
      if (result.accessToken && result.refreshToken) {
        session = {
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
        };
      }
      // Garante User local.
      await this.usersService.ensureFromAuth({
        id: userId,
        email,
        fullName: dto.fullName,
      });
    }

    // Cria membership + incrementa usedCount em transação.
    const requiresApproval = inv.type === InvitationType.GENERIC_LINK;
    const status = requiresApproval
      ? MembershipStatus.PENDING
      : MembershipStatus.APPROVED;

    await this.dataSource.transaction(async (manager) => {
      const ucRepo = manager.getRepository(UserCondominium);
      const invRepo = manager.getRepository(CondominiumInvitation);
      await this.linkResidentOnAccept(
        manager,
        inv.condominiumId,
        membershipUnitId,
        inv.residentId,
        userId,
        email,
      );
      await ucRepo.save(
        ucRepo.create({
          userId,
          condominiumId: inv.condominiumId,
          role: inv.role,
          unitId: membershipUnitId,
          status,
        }),
      );
      const fresh = await invRepo.findOne({ where: { id: inv.id } });
      if (fresh) {
        fresh.usedCount += 1;
        if (fresh.usedCount >= fresh.maxUses) {
          fresh.status = InvitationStatus.EXHAUSTED;
        }
        await invRepo.save(fresh);
      }
    });

    return {
      accessToken: session?.accessToken ?? null,
      refreshToken: session?.refreshToken ?? null,
      requiresApproval,
    };
  }

  // -----------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------

  /**
   * Verifica se o usuário tem permissão de gerenciar (ADMIN/SUB_ADMIN) o
   * condomínio. Usado em rotas que recebem `:invitationId` (sem
   * `:condominiumId` na URL para passar pelo CondominiumMemberGuard).
   */
  private async assertCanManageCondo(
    condominiumId: string,
    userId: string,
  ): Promise<void> {
    const membership = await this.ucRepo.findOne({
      where: {
        userId,
        condominiumId,
        status: MembershipStatus.APPROVED,
      },
    });
    if (
      !membership ||
      (membership.role !== UserRole.ADMIN &&
        membership.role !== UserRole.SUB_ADMIN)
    ) {
      throw new ForbiddenException(
        'Sem permissão para gerenciar convites deste condomínio.',
      );
    }
  }

  private async findActiveByToken(
    token: string,
  ): Promise<CondominiumInvitation> {
    await this.invitations.expireOverdue();
    const inv = await this.invitations.findByTokenHash(sha256(token));
    if (!inv) {
      throw new NotFoundException('Convite inválido ou expirado.');
    }
    if (inv.status !== InvitationStatus.ACTIVE) {
      throw new NotFoundException('Convite inválido ou expirado.');
    }
    if (inv.expiresAt.getTime() <= Date.now()) {
      inv.status = InvitationStatus.EXHAUSTED;
      await this.invitations.save(inv);
      throw new NotFoundException('Convite inválido ou expirado.');
    }
    if (inv.usedCount >= inv.maxUses) {
      inv.status = InvitationStatus.EXHAUSTED;
      await this.invitations.save(inv);
      throw new NotFoundException('Convite inválido ou expirado.');
    }
    return inv;
  }

  private toResponse(inv: CondominiumInvitation): InvitationResponseDto {
    return {
      id: inv.id,
      type: inv.type,
      role: inv.role,
      email: inv.email,
      unitId: inv.unitId,
      residentId: inv.residentId,
      expiresAt: inv.expiresAt,
      maxUses: inv.maxUses,
      usedCount: inv.usedCount,
      status: inv.status,
      createdAt: inv.createdAt,
    };
  }

  private buildInviteUrl(token: string): string {
    return `${this.appPublicUrl}/invite/${token}`;
  }

  private async linkResidentOnAccept(
    manager: import('typeorm').EntityManager,
    condominiumId: string,
    unitId: string | null,
    residentId: string | null,
    userId: string,
    email: string,
  ): Promise<void> {
    const repo = manager.getRepository(Resident);
    if (residentId) {
      const resident = await repo
        .createQueryBuilder('r')
        .innerJoin('r.unit', 'u')
        .where('r.id = :residentId', { residentId })
        .andWhere('u.condominium_id = :condominiumId', { condominiumId })
        .getOne();
      if (!resident) {
        throw new BadRequestException(
          'Morador vinculado ao convite não foi encontrado.',
        );
      }
      if (resident.userId && resident.userId !== userId) {
        throw new ConflictException(
          'Este morador já está vinculado a outro usuário.',
        );
      }
      if (!resident.userId) {
        resident.userId = userId;
        await repo.save(resident);
      }
      return;
    }
    if (!unitId) return;
    const normalized = email.toLowerCase();
    const candidates = await repo
      .createQueryBuilder('r')
      .where('r.unit_id = :unitId', { unitId })
      .andWhere("LOWER(COALESCE(r.email, '')) = :email", {
        email: normalized,
      })
      .getMany();
    const target = candidates[0];
    if (!target) return;
    if (target.userId && target.userId !== userId) {
      throw new ConflictException(
        'Já existe um morador desta unidade vinculado a outro usuário com este e-mail.',
      );
    }
    if (!target.userId) {
      target.userId = userId;
      await repo.save(target);
    }
  }
}
