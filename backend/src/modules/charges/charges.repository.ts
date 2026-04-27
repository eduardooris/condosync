import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Charge } from '../../database/entities/charge.entity';
import { ChargeStatus } from '../../common/enums';

@Injectable()
export class ChargesRepository {
  constructor(
    @InjectRepository(Charge)
    private readonly repo: Repository<Charge>,
  ) {}

  findByCondo(condominiumId: string) {
    return this.repo
      .createQueryBuilder('c')
      .innerJoinAndSelect('c.unit', 'u')
      .where('u.condominium_id = :condominiumId', { condominiumId })
      .orderBy('c.billing_month', 'DESC')
      .addOrderBy('u.block')
      .addOrderBy('u.number')
      .getMany();
  }

  findById(id: string) {
    return this.repo.findOne({ where: { id } });
  }

  findByIdWithUnit(id: string) {
    return this.repo.findOne({
      where: { id },
      relations: ['unit', 'unit.condominium'],
    });
  }

  findByUnitAndMonth(unitId: string, billingMonth: string) {
    return this.repo.findOne({ where: { unitId, billingMonth } });
  }

  /**
   * Verifica idempotência da geração mensal: só considera cobranças
   * “ativas” (PENDING ou OVERDUE). Cobranças `CANCELED`, `PAID` ou
   * `EXEMPT` não bloqueiam a geração de uma nova cobrança no mesmo
   * mês — útil quando o admin cancela algo gerado errado e precisa
   * que a geração mensal volte a criar.
   */
  findActiveByUnitAndMonth(unitId: string, billingMonth: string) {
    return this.repo.findOne({
      where: [
        { unitId, billingMonth, status: ChargeStatus.PENDING },
        { unitId, billingMonth, status: ChargeStatus.OVERDUE },
      ],
    });
  }

  /** Cobranças de um conjunto de unidades (US-08 — minhas cobranças). */
  findByUnits(unitIds: string[]) {
    if (unitIds.length === 0) return Promise.resolve([] as Charge[]);
    return this.repo
      .createQueryBuilder('c')
      .innerJoinAndSelect('c.unit', 'u')
      .where({ unitId: In(unitIds) })
      .orderBy('c.billing_month', 'DESC')
      .addOrderBy('u.block')
      .addOrderBy('u.number')
      .getMany();
  }

  findPendingWithUnit() {
    return this.repo.find({
      where: { status: ChargeStatus.PENDING },
      relations: ['unit', 'unit.condominium'],
    });
  }

  countPendingOverdueByCondo(condominiumId: string) {
    return this.repo
      .createQueryBuilder('c')
      .innerJoin('c.unit', 'u')
      .where('u.condominium_id = :condominiumId', { condominiumId })
      .andWhere('c.status IN (:...statuses)', {
        statuses: [ChargeStatus.PENDING, ChargeStatus.OVERDUE],
      })
      .getCount();
  }

  create(data: Partial<Charge>) {
    return this.repo.create(data as Charge);
  }

  save(entity: Charge) {
    return this.repo.save(entity);
  }
}
