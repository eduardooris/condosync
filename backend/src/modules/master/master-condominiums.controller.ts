import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { MasterRoleGuard } from '../../common/guards/master-role.guard';
import { Condominium } from '../../database/entities/condominium.entity';
import { Unit } from '../../database/entities/unit.entity';
import { Charge } from '../../database/entities/charge.entity';
import { UserCondominium } from '../../database/entities/user-condominium.entity';
import { PaymentAccount } from '../../database/entities/payment-account.entity';
import { User } from '../../database/entities/user.entity';

/**
 * Endpoints cross-tenant pra navegar **a partir do condomínio** — útil quando
 * o operador quer ver tudo sobre um condo específico (cobranças, pagamento,
 * usuários, unidades). É a página "hub" de investigação.
 */
@ApiTags('master')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard, MasterRoleGuard)
@Controller('master/condominiums')
export class MasterCondominiumsController {
  constructor(
    @InjectRepository(Condominium)
    private readonly condoRepo: Repository<Condominium>,
    @InjectRepository(Unit)
    private readonly unitRepo: Repository<Unit>,
    @InjectRepository(Charge)
    private readonly chargesRepo: Repository<Charge>,
    @InjectRepository(UserCondominium)
    private readonly membershipsRepo: Repository<UserCondominium>,
    @InjectRepository(PaymentAccount)
    private readonly paymentAccountsRepo: Repository<PaymentAccount>,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'Lista todos os condomínios (cross-tenant). Suporta busca por nome ou CNPJ.',
  })
  async list(
    @Query('search') search?: string,
    @Query('archived') archived?: 'only' | 'include',
  ) {
    const qb = this.condoRepo
      .createQueryBuilder('c')
      .orderBy('c.created_at', 'DESC')
      .take(200);

    if (search?.trim()) {
      qb.andWhere('(c.name ILIKE :q OR c.cnpj ILIKE :q)', {
        q: `%${search.trim()}%`,
      });
    }
    if (archived === 'only') {
      qb.andWhere('c.archived_at IS NOT NULL');
    } else if (archived !== 'include') {
      qb.andWhere('c.archived_at IS NULL');
    }

    const condos = await qb.getMany();
    if (condos.length === 0) return [];

    const ids = condos.map((c) => c.id);

    // Agrega métricas em queries paralelas — N+1 controlado, evita join pesado.
    const [unitCounts, memberCounts, accounts] = await Promise.all([
      this.unitRepo
        .createQueryBuilder('u')
        .select('u.condominium_id', 'cid')
        .addSelect('COUNT(*)::int', 'count')
        .where('u.condominium_id IN (:...ids)', { ids })
        .groupBy('u.condominium_id')
        .getRawMany<{ cid: string; count: number }>(),
      this.membershipsRepo
        .createQueryBuilder('m')
        .select('m.condominium_id', 'cid')
        .addSelect('COUNT(DISTINCT m.user_id)::int', 'count')
        .where('m.condominium_id IN (:...ids)', { ids })
        .groupBy('m.condominium_id')
        .getRawMany<{ cid: string; count: number }>(),
      this.paymentAccountsRepo
        .createQueryBuilder('a')
        .where('a.condominium_id IN (:...ids)', { ids })
        .getMany(),
    ]);

    const unitsByCondo = new Map(unitCounts.map((r) => [r.cid, r.count]));
    const membersByCondo = new Map(memberCounts.map((r) => [r.cid, r.count]));
    const accountByCondo = new Map(accounts.map((a) => [a.condominiumId, a]));

    return condos.map((c) => ({
      id: c.id,
      name: c.name,
      cnpj: c.cnpj,
      photoUrl: c.photoUrl,
      monthlyFeeAmount: c.monthlyFeeAmount,
      archivedAt: c.archivedAt,
      unitCount: unitsByCondo.get(c.id) ?? 0,
      memberCount: membersByCondo.get(c.id) ?? 0,
      paymentAccountStatus: accountByCondo.get(c.id)?.status ?? null,
      createdAt: c.createdAt,
    }));
  }

  @Get(':id')
  @ApiOperation({
    summary:
      'Detalhe completo do condomínio + payment account + métricas de cobrança.',
  })
  async detail(@Param('id', ParseUUIDPipe) id: string) {
    const condo = await this.condoRepo.findOne({ where: { id } });
    if (!condo) return null;

    const [account, totalUnits, vacantUnits, members, chargesAgg] =
      await Promise.all([
        this.paymentAccountsRepo.findOne({ where: { condominiumId: id } }),
        this.unitRepo.count({ where: { condominiumId: id } }),
        this.unitRepo.count({
          where: { condominiumId: id, status: 'VACANT' as never },
        }),
        this.listMembers(id),
        this.aggregateCharges(id),
      ]);

    return {
      id: condo.id,
      name: condo.name,
      cnpj: condo.cnpj,
      photoUrl: condo.photoUrl,
      monthlyFeeAmount: condo.monthlyFeeAmount,
      billingGenerationDay: condo.billingGenerationDay,
      billingDueDay: condo.billingDueDay,
      pixKeyType: condo.pixKeyType,
      adminContactPhone: condo.adminContactPhone,
      archivedAt: condo.archivedAt,
      createdAt: condo.createdAt,
      paymentAccount: account
        ? {
            id: account.id,
            status: account.status,
            asaasAccountId: account.asaasAccountId,
            holderLegalName: account.holderLegalName,
            holderType: account.holderType,
          }
        : null,
      metrics: {
        totalUnits,
        vacantUnits,
        occupiedUnits: totalUnits - vacantUnits,
        ...chargesAgg,
      },
      members,
    };
  }

  private async listMembers(condominiumId: string) {
    const rows = await this.membershipsRepo
      .createQueryBuilder('m')
      .where('m.condominium_id = :cid', { cid: condominiumId })
      .orderBy('m.created_at', 'ASC')
      .getMany();
    if (rows.length === 0) return [];
    const userIds = [...new Set(rows.map((r) => r.userId))];
    const users = await this.usersRepo
      .createQueryBuilder('u')
      .where('u.id IN (:...ids)', { ids: userIds })
      .getMany();
    const userById = new Map(users.map((u) => [u.id, u]));
    return rows.map((r) => {
      const u = userById.get(r.userId);
      return {
        userId: r.userId,
        email: u?.email ?? null,
        fullName: u?.fullName ?? null,
        role: r.role,
        status: r.status,
        unitId: r.unitId,
        joinedAt: r.createdAt,
      };
    });
  }

  private async aggregateCharges(condominiumId: string) {
    const rows = await this.chargesRepo
      .createQueryBuilder('c')
      .leftJoin('c.unit', 'u')
      .select('c.status', 'status')
      .addSelect('COUNT(*)::int', 'count')
      .where('u.condominium_id = :cid', { cid: condominiumId })
      .groupBy('c.status')
      .getRawMany<{ status: string; count: number }>();
    const byStatus = new Map(rows.map((r) => [r.status, r.count]));
    return {
      chargesTotal: [...byStatus.values()].reduce((a, b) => a + b, 0),
      chargesPaid: byStatus.get('PAID') ?? 0,
      chargesPending: byStatus.get('PENDING') ?? 0,
      chargesOverdue: byStatus.get('OVERDUE') ?? 0,
    };
  }
}

// Avoid unused-import linter
void ILike;
