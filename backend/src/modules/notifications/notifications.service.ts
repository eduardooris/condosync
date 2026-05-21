import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, LessThan, Repository } from 'typeorm';
import {
  Notification,
  NotificationType,
} from '../../database/entities/notification.entity';
import { NotificationsGateway } from './notifications.gateway';

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

export interface ListMineOptions {
  /** Quando true, retorna apenas as notif não lidas. */
  onlyUnread?: boolean;
  /** Restringe ao escopo de um condomínio (evita misturar tenants). */
  condominiumId?: string | null;
  /** Cursor: `createdAt` (ISO) do último item recebido pelo cliente. */
  before?: Date | null;
  /** Limite por página. Clamp 1..100. */
  limit?: number;
}

export interface ListMineResult {
  items: Notification[];
  /** ISO string do `createdAt` do último item — passe como `before` na próxima página. */
  nextCursor: string | null;
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
    case NotificationType.CHARGE_PAYMENT_REQUESTED:
    case NotificationType.CHARGE_PAYMENT_REJECTED:
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

const DEFAULT_PAGE_LIMIT = 25;
const MAX_PAGE_LIMIT = 100;

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly repo: Repository<Notification>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly gateway: NotificationsGateway,
  ) {}

  /**
   * Lista paginada por cursor. Ordem `createdAt DESC, id DESC` — quando
   * o cliente passa `before`, filtramos `createdAt < before`, garantindo
   * que mesmo notif criadas no mesmo segundo não se percam (id atua como
   * tiebreak determinístico no order by).
   */
  async listMine(
    userId: string,
    options: ListMineOptions = {},
  ): Promise<ListMineResult> {
    const limit = Math.min(
      Math.max(1, options.limit ?? DEFAULT_PAGE_LIMIT),
      MAX_PAGE_LIMIT,
    );

    const where: Record<string, unknown> = { userId };
    if (options.onlyUnread) where.readAt = IsNull();
    if (options.condominiumId) where.condominiumId = options.condominiumId;
    if (options.before) where.createdAt = LessThan(options.before);

    const items = await this.repo.find({
      where,
      order: { createdAt: 'DESC', id: 'DESC' },
      // Pega `limit + 1` para detectar se ainda há próxima página sem
      // count extra. Devolve só `limit` itens.
      take: limit + 1,
    });

    const hasMore = items.length > limit;
    const trimmed = hasMore ? items.slice(0, limit) : items;
    const last = trimmed[trimmed.length - 1];
    const nextCursor =
      hasMore && last ? last.createdAt.toISOString() : null;

    return { items: trimmed, nextCursor };
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
    const saved = await this.repo.save(row);
    // Best-effort: se o socket não estiver configurado (testes), apenas ignora.
    try {
      this.gateway.emitToUser(saved.userId, saved);
    } catch {
      /* noop */
    }
    return saved;
  }

  /**
   * Inserção em massa para envios broadcast (todos os moradores
   * do condomínio etc.). Envelopa num QueryRunner para garantir
   * atomicidade — se qualquer chunk falhar, todo o lote é revertido.
   */
  async createMany(items: CreateNotificationInput[]): Promise<Notification[]> {
    if (items.length === 0) return [];

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const repo = queryRunner.manager.getRepository(Notification);
      const rows = items.map((i) =>
        repo.create({
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
      const saved = await repo.save(rows, { chunk: 200 });
      await queryRunner.commitTransaction();

      try {
        this.gateway.emitMany(saved);
      } catch {
        /* noop */
      }
      return saved;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async markRead(userId: string, id: string): Promise<Notification> {
    const row = await this.repo.findOne({ where: { id, userId } });
    if (!row) {
      throw new NotFoundException('Notificação não encontrada.');
    }
    row.readAt = new Date();
    return this.repo.save(row);
  }

  async markAllRead(
    userId: string,
    condominiumId?: string | null,
  ): Promise<{ updated: number }> {
    const qb = this.repo
      .createQueryBuilder()
      .update(Notification)
      .set({ readAt: () => 'NOW()' })
      .where('user_id = :userId', { userId })
      .andWhere('read_at IS NULL');
    if (condominiumId) {
      qb.andWhere('condominium_id = :condominiumId', { condominiumId });
    }
    const res = await qb.execute();
    return { updated: res.affected ?? 0 };
  }

  async countUnread(
    userId: string,
    condominiumId?: string | null,
  ): Promise<number> {
    const where: Record<string, unknown> = { userId, readAt: IsNull() };
    if (condominiumId) where.condominiumId = condominiumId;
    return this.repo.count({ where });
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
