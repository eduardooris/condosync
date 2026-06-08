import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Condominium } from '../../database/entities/condominium.entity';
import {
  MembershipStatus,
  UserCondominium,
} from '../../database/entities/user-condominium.entity';

@Injectable()
export class CondominiumsRepository {
  constructor(
    @InjectRepository(Condominium)
    private readonly condoRepo: Repository<Condominium>,
    @InjectRepository(UserCondominium)
    private readonly ucRepo: Repository<UserCondominium>,
  ) {}

  findById(id: string) {
    return this.condoRepo.findOne({ where: { id } });
  }

  findActive() {
    return this.condoRepo.find({ where: { archivedAt: IsNull() } });
  }

  /** Apenas memberships APROVADOS — pendentes não são visíveis ao usuário. */
  findByUser(userId: string) {
    return this.ucRepo.find({
      where: { userId, status: MembershipStatus.APPROVED },
      relations: ['condominium'],
    });
  }

  /** Memberships PENDING do usuário (usado pra mostrar "aguardando aprovação"). */
  findPendingByUser(userId: string) {
    return this.ucRepo.find({
      where: { userId, status: MembershipStatus.PENDING },
      relations: ['condominium'],
    });
  }

  saveCondo(entity: Condominium) {
    return this.condoRepo.save(entity);
  }

  createCondo(data: Partial<Condominium>) {
    return this.condoRepo.create(data as Condominium);
  }

  findMembership(userId: string, condominiumId: string) {
    return this.ucRepo.findOne({ where: { userId, condominiumId } });
  }

  saveMembership(entity: UserCondominium) {
    return this.ucRepo.save(entity);
  }

  createMembership(data: Partial<UserCondominium>) {
    return this.ucRepo.create(data as UserCondominium);
  }
}
