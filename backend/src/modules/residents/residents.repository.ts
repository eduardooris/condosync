import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Resident } from '../../database/entities/resident.entity';
import { FinancialResponsibleHistory } from '../../database/entities/financial-responsible-history.entity';

@Injectable()
export class ResidentsRepository {
  constructor(
    @InjectRepository(Resident)
    private readonly repo: Repository<Resident>,
    @InjectRepository(FinancialResponsibleHistory)
    private readonly historyRepo: Repository<FinancialResponsibleHistory>,
  ) {}

  findByUnit(unitId: string) {
    return this.repo.find({ where: { unitId } });
  }

  findById(id: string, unitId: string) {
    return this.repo.findOne({ where: { id, unitId } });
  }

  findResponsibleForUnit(unitId: string) {
    return this.repo.findOne({
      where: { unitId, isFinancialResponsible: true },
    });
  }

  findResponsibleByUserInCondo(userId: string, condominiumId: string) {
    return this.repo
      .createQueryBuilder('r')
      .innerJoinAndSelect('r.unit', 'u')
      .where('r.user_id = :userId', { userId })
      .andWhere('r.is_financial_responsible = true')
      .andWhere('u.condominium_id = :condominiumId', { condominiumId })
      .getOne();
  }

  findResponsiblesInCondo(condominiumId: string) {
    return this.repo
      .createQueryBuilder('r')
      .innerJoin('r.unit', 'u')
      .where('u.condominium_id = :condominiumId', { condominiumId })
      .andWhere('r.is_financial_responsible = true')
      .getMany();
  }

  async findOtherResponsibleForUser(
    userId: string,
    currentUnitId: string,
    excludeResidentId?: string,
  ) {
    const qb = this.repo
      .createQueryBuilder('r')
      .innerJoin('r.unit', 'u')
      .where('r.user_id = :userId', { userId })
      .andWhere('r.is_financial_responsible = true')
      .andWhere('u.id != :currentUnitId', { currentUnitId });
    if (excludeResidentId) {
      qb.andWhere('r.id != :excludeResidentId', { excludeResidentId });
    }
    return qb.getOne();
  }

  create(data: Partial<Resident>) {
    return this.repo.create(data as Resident);
  }

  save(entity: Resident) {
    return this.repo.save(entity);
  }

  clearOtherResponsibles(unitId: string) {
    return this.repo.update(
      { unitId, isFinancialResponsible: true },
      { isFinancialResponsible: false },
    );
  }

  saveHistory(data: Partial<FinancialResponsibleHistory>) {
    return this.historyRepo.save(
      this.historyRepo.create(data as FinancialResponsibleHistory),
    );
  }

  closeOpenHistory(unitId: string) {
    return this.historyRepo
      .createQueryBuilder()
      .update(FinancialResponsibleHistory)
      .set({ endedAt: () => 'NOW()' })
      .where('unit_id = :unitId', { unitId })
      .andWhere('ended_at IS NULL')
      .execute();
  }

  closeHistoryForResident(residentId: string) {
    return this.historyRepo
      .createQueryBuilder()
      .update(FinancialResponsibleHistory)
      .set({ endedAt: () => 'NOW()' })
      .where('resident_id = :residentId', { residentId })
      .andWhere('ended_at IS NULL')
      .execute();
  }
}
