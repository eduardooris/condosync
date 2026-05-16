import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bull';
import { Repository } from 'typeorm';
import { Resident } from '../../database/entities/resident.entity';
import { UserCondominium } from '../../database/entities/user-condominium.entity';
import { BulletinPriority } from '../../common/enums';
import { CreateBulletinDto } from './dto/create-bulletin.dto';
import { BulletinPost } from '../../database/entities/bulletin-post.entity';
import { BulletinRepository } from './bulletin.repository';
import { QUEUE_WHATSAPP_SEND } from '../../queues/queue-names';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../../database/entities/notification.entity';

@Injectable()
export class BulletinService {
  constructor(
    private readonly bulletinRepo: BulletinRepository,
    @InjectRepository(Resident)
    private readonly residentRepo: Repository<Resident>,
    @InjectRepository(UserCondominium)
    private readonly membershipRepo: Repository<UserCondominium>,
    @InjectQueue(QUEUE_WHATSAPP_SEND)
    private readonly whatsappQueue: Queue,
    private readonly notifications: NotificationsService,
  ) {}

  async list(
    condominiumId: string,
    includeExpired = false,
  ): Promise<BulletinPost[]> {
    const rows = await this.bulletinRepo.findByCondo(
      condominiumId,
      includeExpired,
    );
    const rank: Record<BulletinPriority, number> = {
      [BulletinPriority.URGENT]: 0,
      [BulletinPriority.MAINTENANCE]: 1,
      [BulletinPriority.ATTENTION]: 2,
      [BulletinPriority.EVENT]: 3,
      [BulletinPriority.INFO]: 4,
    };
    // Fixados sempre primeiro; depois prioridade; depois recência.
    return [...rows].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      const byPriority = rank[a.priority] - rank[b.priority];
      if (byPriority !== 0) return byPriority;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
  }

  async create(
    condominiumId: string,
    userId: string,
    dto: CreateBulletinDto,
  ): Promise<BulletinPost> {
    const row = this.bulletinRepo.create({
      condominiumId,
      title: dto.title,
      body: dto.body,
      priority: dto.priority,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      pinned: dto.pinned ?? false,
      createdByUserId: userId,
    });
    const saved = await this.bulletinRepo.save(row);

    const memberships = await this.membershipRepo.find({
      where: { condominiumId },
      select: ['userId'],
    });
    if (memberships.length > 0) {
      await this.notifications.createMany(
        memberships.map((m) => ({
          userId: m.userId,
          condominiumId,
          type: NotificationType.BULLETIN_NEW,
          title: dto.title,
          body: dto.body.slice(0, 200),
          payload: { bulletinId: saved.id, priority: dto.priority },
        })),
      );
    }

    if (dto.priority === BulletinPriority.URGENT) {
      const responsibles = await this.residentRepo
        .createQueryBuilder('r')
        .innerJoin('r.unit', 'u')
        .where('u.condominium_id = :condominiumId', { condominiumId })
        .andWhere('r.is_financial_responsible = true')
        .getMany();
      for (const r of responsibles) {
        if (!r.phoneWhatsapp) continue;
        await this.whatsappQueue.add(
          'bulletin-urgent',
          {
            phone: r.phoneWhatsapp,
            message: `CondoSync URGENTE: ${dto.title}\n${dto.body.slice(0, 200)}`,
          },
          { jobId: `bulletin:${saved.id}:urgent:${r.id}` },
        );
      }
    }
    return saved;
  }
}
