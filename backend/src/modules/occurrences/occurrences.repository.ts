import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Occurrence } from '../../database/entities/occurrence.entity';

@Injectable()
export class OccurrencesRepository {
  constructor(
    @InjectRepository(Occurrence)
    private readonly repo: Repository<Occurrence>,
  ) {}

  findByCondo(condominiumId: string) {
    return this.repo.find({
      where: { condominiumId },
      relations: ['unit'],
      order: { createdAt: 'DESC' },
    });
  }

  findById(id: string, condominiumId: string) {
    return this.repo.findOne({
      where: { id, condominiumId },
      relations: ['authorResident'],
    });
  }

  create(data: Partial<Occurrence>) {
    return this.repo.create(data as Occurrence);
  }

  save(entity: Occurrence) {
    return this.repo.save(entity);
  }
}
