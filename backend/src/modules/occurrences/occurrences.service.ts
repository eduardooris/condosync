import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bull';
import { randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';
import { Resident } from '../../database/entities/resident.entity';
import { Unit } from '../../database/entities/unit.entity';
import { TenantMembershipService } from '../../common/services/tenant-membership.service';
import { OccurrenceStatus, UserRole } from '../../common/enums';
import { CreateOccurrenceDto } from './dto/create-occurrence.dto';
import { Occurrence } from '../../database/entities/occurrence.entity';
import { OccurrencesRepository } from './occurrences.repository';
import { QUEUE_WHATSAPP_SEND } from '../../queues/queue-names';
import {
  renderOccurrenceStatusNotificationBody,
  renderOccurrenceStatusWhatsappMessage,
} from '../../queues/messages/occurrence-templates';
import {
  IStorageAdapter,
  STORAGE_ADAPTER,
} from '../../adapters/storage/storage.adapter';
import { Env } from '../../config/env.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../../database/entities/notification.entity';

const STATUS_FLOW: Record<OccurrenceStatus, OccurrenceStatus[]> = {
  [OccurrenceStatus.OPEN]: [OccurrenceStatus.UNDER_REVIEW],
  [OccurrenceStatus.UNDER_REVIEW]: [
    OccurrenceStatus.RESOLVED,
    OccurrenceStatus.ARCHIVED,
  ],
  [OccurrenceStatus.RESOLVED]: [],
  [OccurrenceStatus.ARCHIVED]: [],
};

@Injectable()
export class OccurrencesService {
  constructor(
    private readonly occurrencesRepo: OccurrencesRepository,
    @InjectRepository(Resident)
    private readonly residentRepo: Repository<Resident>,
    @InjectRepository(Unit)
    private readonly unitRepo: Repository<Unit>,
    private readonly tenantMembership: TenantMembershipService,
    @InjectQueue(QUEUE_WHATSAPP_SEND)
    private readonly whatsappQueue: Queue,
    @Inject(STORAGE_ADAPTER)
    private readonly storage: IStorageAdapter,
    private readonly config: ConfigService<Env, true>,
    private readonly notifications: NotificationsService,
  ) {}

  private bucket(): string {
    return this.config.get('STORAGE_BUCKET', { infer: true });
  }

  /**
   * Listagem aplicando RN-05.3:
   *
   * - Síndico/subsíndico veem todos os campos (necessário para
   *   moderação interna).
   * - Demais membros NUNCA enxergam `unit.block`/`unit.number` ou
   *   `authorResidentId` quando `isAnonymous = true`.
   */
  async list(
    condominiumId: string,
    viewerRole: UserRole,
  ): Promise<Occurrence[]> {
    const rows = await this.occurrencesRepo.findByCondo(condominiumId);
    if (this.isPrivileged(viewerRole)) return rows;
    return rows.map((o) => this.redactIfAnonymous(o));
  }

  async create(
    condominiumId: string,
    userId: string,
    dto: CreateOccurrenceDto,
    file?: Express.Multer.File,
  ): Promise<Occurrence> {
    const unit = await this.unitRepo.findOne({
      where: { id: dto.unitId, condominiumId },
    });
    if (!unit) {
      throw new NotFoundException('Unidade não encontrada.');
    }
    const author = await this.tenantMembership.findResidentOnOwnedUnit(
      userId,
      condominiumId,
      dto.unitId,
    );

    let attachmentKey: string | null = null;
    if (file) {
      attachmentKey = `occurrences/${condominiumId}/${randomUUID()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      await this.storage.uploadObject(
        this.bucket(),
        attachmentKey,
        file.buffer,
        file.mimetype || 'application/octet-stream',
      );
    }

    const row = this.occurrencesRepo.create({
      condominiumId,
      unitId: dto.unitId,
      authorResidentId: author.id,
      title: dto.title,
      category: dto.category,
      description: dto.description,
      status: OccurrenceStatus.OPEN,
      isAnonymous: dto.isAnonymous ?? false,
      attachmentStorageKey: attachmentKey,
    });
    return this.occurrencesRepo.save(row);
  }

  async signedAttachmentUrl(
    condominiumId: string,
    id: string,
    viewerRole: UserRole,
    viewerUserId: string,
  ): Promise<{ url: string; expiresIn: number }> {
    const o = await this.occurrencesRepo.findById(id, condominiumId);
    if (!o || !o.attachmentStorageKey) {
      throw new NotFoundException('Anexo não encontrado.');
    }
    if (!this.isPrivileged(viewerRole)) {
      await this.tenantMembership.assertUserOwnsUnit(
        viewerUserId,
        condominiumId,
        o.unitId,
      );
    }
    const expiresIn = 300;
    const url = await this.storage.getSignedUrl(
      this.bucket(),
      o.attachmentStorageKey,
      expiresIn,
    );
    return { url, expiresIn };
  }

  /**
   * RN-05.1 — apenas o síndico (ADMIN) pode mudar o status; o
   * subsíndico só lê. O controller já garante isso via RolesGuard,
   * mas mantemos a transição validada aqui para defesa em profundidade.
   */
  async updateStatus(
    condominiumId: string,
    id: string,
    status: OccurrenceStatus,
  ): Promise<Occurrence> {
    const o = await this.occurrencesRepo.findById(id, condominiumId);
    if (!o) {
      throw new NotFoundException('Ocorrência não encontrada.');
    }
    const allowed = STATUS_FLOW[o.status] ?? [];
    if (!allowed.includes(status)) {
      throw new BadRequestException(
        `Transição de status inválida: "${o.status}" → "${status}".`,
      );
    }
    o.status = status;
    const saved = await this.occurrencesRepo.save(o);
    const author = await this.residentRepo.findOne({
      where: { id: o.authorResidentId },
    });
    if (author?.userId) {
      await this.notifications.create({
        userId: author.userId,
        condominiumId: o.condominiumId,
        type: NotificationType.OCCURRENCE_STATUS,
        title: `Ocorrência atualizada: ${o.title}`,
        body: renderOccurrenceStatusNotificationBody(o.title, status),
        payload: { occurrenceId: o.id, status },
      });
    }
    if (author?.phoneWhatsapp) {
      await this.whatsappQueue.add(
        'occurrence-status',
        {
          phone: author.phoneWhatsapp,
          message: renderOccurrenceStatusWhatsappMessage(o.title, status),
        },
        { jobId: `occurrence:${o.id}:${status}` },
      );
    }
    return saved;
  }

  // ── Helpers ────────────────────────────────────────────────────

  private isPrivileged(role: UserRole): boolean {
    return role === UserRole.ADMIN || role === UserRole.SUB_ADMIN;
  }

  private redactIfAnonymous(o: Occurrence): Occurrence {
    if (!o.isAnonymous) return o;
    return {
      ...o,
      authorResidentId: '',
      authorResident: null as unknown as Resident,
      unitId: '',
      unit: o.unit
        ? ({
            ...o.unit,
            block: '',
            number: '',
          } as Unit)
        : (null as unknown as Unit),
    };
  }
}
