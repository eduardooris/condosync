import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { MasterRoleGuard } from '../../common/guards/master-role.guard';
import { User } from '../../database/entities/user.entity';
import { UserCondominium } from '../../database/entities/user-condominium.entity';
import { Condominium } from '../../database/entities/condominium.entity';

/**
 * Endpoints cross-tenant pra navegar **a partir do usuário** — útil quando
 * o operador recebe um email do síndico e quer ver todos os condos que ele
 * pertence pra investigar onde está o problema.
 */
@ApiTags('master')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard, MasterRoleGuard)
@Controller('master/users')
export class MasterUsersController {
  constructor(
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    @InjectRepository(UserCondominium)
    private readonly membershipsRepo: Repository<UserCondominium>,
    @InjectRepository(Condominium)
    private readonly condoRepo: Repository<Condominium>,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Busca usuários (cross-tenant). Filtra por email ou nome.',
  })
  async list(@Query('search') search?: string, @Query('limit') limit = '50') {
    const qb = this.usersRepo
      .createQueryBuilder('u')
      .orderBy('u.created_at', 'DESC')
      .take(Math.min(Number(limit) || 50, 200));

    if (search?.trim()) {
      qb.andWhere('(u.email ILIKE :q OR u.full_name ILIKE :q)', {
        q: `%${search.trim()}%`,
      });
    }

    const users = await qb.getMany();
    if (users.length === 0) return [];

    // Conta condos por usuário em uma query só.
    const membershipCounts = await this.membershipsRepo
      .createQueryBuilder('m')
      .select('m.user_id', 'uid')
      .addSelect('COUNT(*)::int', 'count')
      .where('m.user_id IN (:...ids)', { ids: users.map((u) => u.id) })
      .groupBy('m.user_id')
      .getRawMany<{ uid: string; count: number }>();
    const countByUser = new Map(membershipCounts.map((r) => [r.uid, r.count]));

    return users.map((u) => ({
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      phoneWhatsapp: u.phoneWhatsapp,
      condominiumCount: countByUser.get(u.id) ?? 0,
      createdAt: u.createdAt,
    }));
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Detalhe do usuário + condomínios que pertence (com role).',
  })
  async detail(@Param('id', ParseUUIDPipe) id: string) {
    const user = await this.usersRepo.findOne({ where: { id } });
    if (!user) return null;

    const memberships = await this.membershipsRepo.find({
      where: { userId: id },
      order: { createdAt: 'ASC' },
    });
    const condoIds = [...new Set(memberships.map((m) => m.condominiumId))];
    const condos = condoIds.length
      ? await this.condoRepo.find({ where: { id: In(condoIds) } })
      : [];
    const condoById = new Map(condos.map((c) => [c.id, c]));

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phoneWhatsapp: user.phoneWhatsapp,
      createdAt: user.createdAt,
      memberships: memberships.map((m) => ({
        condominiumId: m.condominiumId,
        condominiumName: condoById.get(m.condominiumId)?.name ?? null,
        role: m.role,
        status: m.status,
        unitId: m.unitId,
        joinedAt: m.createdAt,
      })),
    };
  }
}
