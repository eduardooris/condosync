import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { BulletinPost } from '../../database/entities/bulletin-post.entity';

@Injectable()
export class BulletinRepository {
  constructor(
    @InjectRepository(BulletinPost)
    private readonly repo: Repository<BulletinPost>,
  ) {}

  findByCondo(condominiumId: string, includeExpired = false) {
    if (includeExpired) {
      return this.repo.find({
        where: { condominiumId },
        order: { createdAt: 'DESC' },
      });
    }
    const now = new Date();
    return this.repo.find({
      where: [
        { condominiumId, expiresAt: IsNull() },
        { condominiumId, expiresAt: MoreThan(now) },
      ],
      order: { createdAt: 'DESC' },
    });
  }

  create(data: Partial<BulletinPost>) {
    return this.repo.create(data as BulletinPost);
  }

  save(entity: BulletinPost) {
    return this.repo.save(entity);
  }
}
