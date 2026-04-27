import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bull';
import { Repository } from 'typeorm';
import {
  IStorageAdapter,
  STORAGE_ADAPTER,
} from '../../adapters/storage/storage.adapter';
import { ConfigService } from '@nestjs/config';
import { Env } from '../../config/env.schema';
import { CreateDocumentDto } from './dto/create-document.dto';
import { randomUUID } from 'crypto';
import { DocumentVisibility, UserRole } from '../../common/enums';
import { UserCondominium } from '../../database/entities/user-condominium.entity';
import { Document } from '../../database/entities/document.entity';
import { Resident } from '../../database/entities/resident.entity';
import { DocumentsRepository } from './documents.repository';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../../database/entities/notification.entity';
import { QUEUE_WHATSAPP_SEND } from '../../queues/queue-names';

@Injectable()
export class DocumentsService {
  constructor(
    private readonly documentsRepo: DocumentsRepository,
    @InjectRepository(UserCondominium)
    private readonly ucRepo: Repository<UserCondominium>,
    @InjectRepository(Resident)
    private readonly residentRepo: Repository<Resident>,
    @Inject(STORAGE_ADAPTER)
    private readonly storage: IStorageAdapter,
    private readonly config: ConfigService<Env, true>,
    private readonly notifications: NotificationsService,
    @InjectQueue(QUEUE_WHATSAPP_SEND)
    private readonly whatsappQueue: Queue,
  ) {}

  private bucket(): string {
    return this.config.get('STORAGE_BUCKET', { infer: true });
  }

  async list(condominiumId: string, userId: string): Promise<Document[]> {
    const uc = await this.ucRepo.findOne({ where: { userId, condominiumId } });
    if (!uc) {
      throw new NotFoundException();
    }
    return this.documentsRepo.findByCondo(condominiumId, uc.role);
  }

  async create(
    condominiumId: string,
    userId: string,
    dto: CreateDocumentDto,
    file: Express.Multer.File,
  ): Promise<Document> {
    if (!file) {
      throw new BadRequestException('Arquivo é obrigatório.');
    }
    const storageKey = `documents/${condominiumId}/${randomUUID()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    await this.storage.uploadObject(
      this.bucket(),
      storageKey,
      file.buffer,
      file.mimetype || 'application/octet-stream',
    );
    const row = this.documentsRepo.create({
      condominiumId,
      title: dto.title,
      description: dto.description ?? null,
      category: dto.category,
      documentDate: dto.documentDate.slice(0, 10),
      visibility: dto.visibility,
      storageKey,
      createdByUserId: userId,
    });
    const saved = await this.documentsRepo.save(row);
    await this.notifyDocumentCreated(saved);
    return saved;
  }

  /**
   * US-07 — quando um documento novo é publicado, notificar todos
   * os usuários do condomínio (in-app) e os responsáveis financeiros
   * (WhatsApp). `ADMIN_ONLY` só notifica admin/sub-admin.
   */
  private async notifyDocumentCreated(doc: Document): Promise<void> {
    const memberships = await this.ucRepo.find({
      where: { condominiumId: doc.condominiumId },
    });
    const allowed =
      doc.visibility === DocumentVisibility.ADMIN_ONLY
        ? memberships.filter(
            (m) => m.role === UserRole.ADMIN || m.role === UserRole.SUB_ADMIN,
          )
        : memberships;
    if (allowed.length > 0) {
      await this.notifications.createMany(
        allowed.map((m) => ({
          userId: m.userId,
          condominiumId: doc.condominiumId,
          type: NotificationType.DOCUMENT_NEW,
          title: `Novo documento: ${doc.title}`,
          body:
            doc.description?.slice(0, 200) ??
            `Categoria ${doc.category} disponível na biblioteca do condomínio.`,
          payload: { documentId: doc.id, category: doc.category },
        })),
      );
    }
    if (doc.visibility === DocumentVisibility.ALL) {
      const responsibles = await this.residentRepo
        .createQueryBuilder('r')
        .innerJoin('r.unit', 'u')
        .where('u.condominium_id = :condominiumId', {
          condominiumId: doc.condominiumId,
        })
        .andWhere('r.is_financial_responsible = true')
        .getMany();
      for (const r of responsibles) {
        if (!r.phoneWhatsapp) continue;
        await this.whatsappQueue.add(
          'document-new',
          {
            phone: r.phoneWhatsapp,
            message: `CondoSync: novo documento publicado — ${doc.title}.`,
          },
          { jobId: `document:${doc.id}:notify:${r.id}` },
        );
      }
    }
  }

  async remove(condominiumId: string, id: string): Promise<void> {
    const d = await this.documentsRepo.findById(id, condominiumId);
    if (!d) {
      throw new NotFoundException('Documento não encontrado.');
    }
    await this.storage.deleteObject(this.bucket(), d.storageKey);
    await this.documentsRepo.remove(d);
  }

  async signedUrl(
    condominiumId: string,
    id: string,
    userId: string,
  ): Promise<{ url: string; expiresIn: number }> {
    const d = await this.documentsRepo.findById(id, condominiumId);
    if (!d) {
      throw new NotFoundException('Documento não encontrado.');
    }
    const uc = await this.ucRepo.findOne({ where: { userId, condominiumId } });
    if (!uc) {
      throw new NotFoundException();
    }
    if (
      d.visibility === DocumentVisibility.ADMIN_ONLY &&
      uc.role !== UserRole.ADMIN &&
      uc.role !== UserRole.SUB_ADMIN
    ) {
      throw new NotFoundException();
    }
    const expiresIn = 300;
    const url = await this.storage.getSignedUrl(
      this.bucket(),
      d.storageKey,
      expiresIn,
    );
    return { url, expiresIn };
  }

  async signedUrlFromId(
    documentId: string,
    userId: string,
  ): Promise<{ url: string; expiresIn: number }> {
    const d = await this.documentsRepo.findByIdGlobal(documentId);
    if (!d) {
      throw new NotFoundException('Documento não encontrado.');
    }
    return this.signedUrl(d.condominiumId, documentId, userId);
  }
}
