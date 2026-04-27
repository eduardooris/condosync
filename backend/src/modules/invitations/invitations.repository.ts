import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import {
  CondominiumInvitation,
  InvitationStatus,
} from '../../database/entities/condominium-invitation.entity';

@Injectable()
export class InvitationsRepository {
  constructor(
    @InjectRepository(CondominiumInvitation)
    private readonly repo: Repository<CondominiumInvitation>,
  ) {}

  create(data: Partial<CondominiumInvitation>): CondominiumInvitation {
    return this.repo.create(data as CondominiumInvitation);
  }

  save(entity: CondominiumInvitation) {
    return this.repo.save(entity);
  }

  findById(id: string) {
    return this.repo.findOne({ where: { id } });
  }

  findByTokenHash(tokenHash: string) {
    return this.repo.findOne({
      where: { tokenHash },
      relations: ['condominium'],
    });
  }

  /** Lista convites ATIVOS (não revogados/exauridos) do condomínio. */
  listActiveByCondominium(condominiumId: string) {
    return this.repo.find({
      where: { condominiumId, status: InvitationStatus.ACTIVE },
      order: { createdAt: 'DESC' },
    });
  }

  /** Marca como expirados/exaustos os convites cujo prazo passou. */
  async expireOverdue(now: Date = new Date()) {
    await this.repo.update(
      { status: InvitationStatus.ACTIVE, expiresAt: LessThan(now) },
      { status: InvitationStatus.EXHAUSTED },
    );
  }
}
