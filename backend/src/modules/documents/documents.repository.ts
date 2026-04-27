import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Document } from '../../database/entities/document.entity';
import { DocumentVisibility, UserRole } from '../../common/enums';

@Injectable()
export class DocumentsRepository {
  constructor(
    @InjectRepository(Document)
    private readonly repo: Repository<Document>,
  ) {}

  findById(id: string, condominiumId: string) {
    return this.repo.findOne({ where: { id, condominiumId } });
  }

  findByIdGlobal(id: string) {
    return this.repo.findOne({ where: { id } });
  }

  findByCondo(condominiumId: string, role: UserRole): Promise<Document[]> {
    const qb: SelectQueryBuilder<Document> = this.repo
      .createQueryBuilder('d')
      .where('d.condominium_id = :condominiumId', { condominiumId });
    if (role !== UserRole.ADMIN && role !== UserRole.SUB_ADMIN) {
      qb.andWhere('d.visibility = :vis', { vis: DocumentVisibility.ALL });
    }
    return qb.orderBy('d.document_date', 'DESC').getMany();
  }

  create(data: Partial<Document>) {
    return this.repo.create(data as Document);
  }

  save(entity: Document) {
    return this.repo.save(entity);
  }

  remove(entity: Document) {
    return this.repo.remove(entity);
  }
}
