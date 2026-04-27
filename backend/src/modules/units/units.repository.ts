import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Unit } from '../../database/entities/unit.entity';
import { UnitStatus } from '../../common/enums';

@Injectable()
export class UnitsRepository {
  constructor(
    @InjectRepository(Unit)
    private readonly repo: Repository<Unit>,
  ) {}

  findById(id: string, condominiumId: string) {
    return this.repo.findOne({ where: { id, condominiumId } });
  }

  findAll(condominiumId: string) {
    return this.repo.find({
      where: { condominiumId },
      order: { block: 'ASC', number: 'ASC' },
    });
  }

  findOccupied(condominiumId: string) {
    return this.repo.find({
      where: { condominiumId, status: UnitStatus.OCCUPIED },
    });
  }

  countOccupied(condominiumId: string) {
    return this.repo.count({
      where: { condominiumId, status: UnitStatus.OCCUPIED },
    });
  }

  create(data: Partial<Unit>) {
    return this.repo.create(data as Unit);
  }

  save(entity: Unit) {
    return this.repo.save(entity);
  }

  transaction<T>(work: (em: EntityManager) => Promise<T>) {
    return this.repo.manager.transaction(work);
  }
}
