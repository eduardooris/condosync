import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  Notification,
  NotificationType,
} from '../../database/entities/notification.entity';

export interface CreateNotificationInput {
  userId: string;
  condominiumId?: string | null;
  type: NotificationType;
  title: string;
  body: string;
  payload?: Record<string, unknown> | null;
  /** Quando omitido, é derivado de `type + payload` por resolveDeeplink. */
  deeplink?: string | null;
}

/**
 * Deriva a URL relativa do recurso para abrir no app/PWA ao tocar
 * na notificação. Retorna `null` quando não há rota associada
 * (notificações genéricas como `BALANCE_NEGATIVE`).
 */
const resolveDeeplink = (
  type: NotificationType,
  payload?: Record<string, unknown> | null,
): string | null => {
  const p = (payload ?? {}) as Record<string, unknown>;
  switch (type) {
    case NotificationType.CHARGE_CREATED:
    case NotificationType.CHARGE_OVERDUE:
    case NotificationType.CHARGE_PAID:
      return typeof p.chargeId === 'string' ? `/charges/${p.chargeId}` : null;
    case NotificationType.POLL_CREATED:
    case NotificationType.POLL_CLOSED:
      return typeof p.pollId === 'string' ? `/polls/${p.pollId}` : null;
    case NotificationType.OCCURRENCE_STATUS:
      return typeof p.occurrenceId === 'string'
        ? `/occurrences/${p.occurrenceId}`
        : null;
    case NotificationType.BULLETIN_NEW:
      return typeof p.bulletinId === 'string'
        ? `/bulletin/${p.bulletinId}`
        : '/bulletin';
    case NotificationType.DOCUMENT_NEW:
      return typeof p.documentId === 'string'
        ? `/documents/${p.documentId}`
        : '/documents';
    case NotificationType.MEMBER_PENDING_APPROVAL:
      return '/residents';
    case NotificationType.BALANCE_NEGATIVE:
    default:
      return null;
  }
};

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly repo: Repository<Notification>,
  ) {}

  async listMine(userId: string, onlyUnread = false): Promise<Notification[]> {
    return this.repo.find({
      where: onlyUnread
        ? { userId, readAt: null as unknown as Date }
        : { userId },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  async create(input: CreateNotificationInput): Promise<Notification> {
    const row = this.repo.create({
      userId: input.userId,
      condominiumId: input.condominiumId ?? null,
      type: input.type,
      title: input.title,
      body: input.body,
      payload: input.payload ?? null,
      deeplink: input.deeplink ?? resolveDeeplink(input.type, input.payload),
      readAt: null,
    });
    return this.repo.save(row);
  }

  /** Inserção em massa para envios broadcast (todos os moradores
   *  do condomínio etc.). Não usa `cascade` para manter atomicidade. */
  async createMany(items: CreateNotificationInput[]): Promise<void> {
    if (items.length === 0) return;
    const rows = items.map((i) =>
      this.repo.create({
        userId: i.userId,
        condominiumId: i.condominiumId ?? null,
        type: i.type,
        title: i.title,
        body: i.body,
        payload: i.payload ?? null,
        deeplink: i.deeplink ?? resolveDeeplink(i.type, i.payload),
        readAt: null,
      }),
    );
    await this.repo.save(rows, { chunk: 200 });
  }

  async markRead(userId: string, id: string): Promise<Notification> {
    const row = await this.repo.findOne({ where: { id, userId } });
    if (!row) {
      throw new NotFoundException('Notificação não encontrada.');
    }
    row.readAt = new Date();
    return this.repo.save(row);
  }

  async markAllRead(userId: string): Promise<{ updated: number }> {
    const res = await this.repo
      .createQueryBuilder()
      .update(Notification)
      .set({ readAt: () => 'NOW()' })
      .where('user_id = :userId', { userId })
      .andWhere('read_at IS NULL')
      .execute();
    return { updated: res.affected ?? 0 };
  }

  async countUnread(userId: string): Promise<number> {
    return this.repo.count({
      where: { userId, readAt: null as unknown as Date },
    });
  }

  async markReadMany(
    userId: string,
    ids: string[],
  ): Promise<{ updated: number }> {
    if (ids.length === 0) return { updated: 0 };
    const res = await this.repo
      .createQueryBuilder()
      .update(Notification)
      .set({ readAt: () => 'NOW()' })
      .where({ id: In(ids), userId })
      .execute();
    return { updated: res.affected ?? 0 };
  }
}
