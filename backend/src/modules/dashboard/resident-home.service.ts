import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Charge } from '../../database/entities/charge.entity';
import { Condominium } from '../../database/entities/condominium.entity';
import { Parcel, ParcelStatus } from '../../database/entities/parcel.entity';
import {
  Reservation,
  ReservationStatus,
} from '../../database/entities/reservation.entity';
import { Resident } from '../../database/entities/resident.entity';
import { UserCondominium } from '../../database/entities/user-condominium.entity';
import { BulletinPost } from '../../database/entities/bulletin-post.entity';
import { Notification } from '../../database/entities/notification.entity';
import { ChargeStatus } from '../../common/enums';
import { toChargeResponse } from '../charges/charge.mapper';
import { toReservationResponse } from '../reservations/reservation.mapper';
import { ResidentHomeSummaryDto } from './dto/resident-home.dto';

/**
 * Compõe o resumo da Home do morador a partir das tabelas existentes
 * sem duplicar regras dos services específicos: lê o estado bruto,
 * roda 1 consulta por widget e devolve um envelope único.
 */
@Injectable()
export class ResidentHomeService {
  constructor(
    @InjectRepository(UserCondominium)
    private readonly membershipRepo: Repository<UserCondominium>,
    @InjectRepository(Resident)
    private readonly residentRepo: Repository<Resident>,
    @InjectRepository(Charge)
    private readonly chargeRepo: Repository<Charge>,
    @InjectRepository(Condominium)
    private readonly condoRepo: Repository<Condominium>,
    @InjectRepository(Parcel)
    private readonly parcelRepo: Repository<Parcel>,
    @InjectRepository(Reservation)
    private readonly reservationRepo: Repository<Reservation>,
    @InjectRepository(BulletinPost)
    private readonly bulletinRepo: Repository<BulletinPost>,
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
  ) {}

  /**
   * @param userId   usuário autenticado.
   * @param condominiumId  quando omitido, usa o primeiro condomínio em
   *   que o usuário é membro. A maioria dos moradores tem apenas 1.
   */
  async buildSummary(
    userId: string,
    condominiumId?: string,
  ): Promise<ResidentHomeSummaryDto> {
    const condoId = condominiumId
      ? await this.assertMembership(userId, condominiumId)
      : await this.resolveDefaultCondominium(userId);

    const [chargesOpen, condo, parcels, nextReservation, pinned, unreadCount] =
      await Promise.all([
        this.findOpenCharges(userId, condoId),
        this.condoRepo.findOne({ where: { id: condoId } }),
        this.findWaitingParcels(userId, condoId),
        this.findNextReservation(userId, condoId),
        this.findPinnedBulletin(condoId),
        this.notificationRepo.count({
          where: { userId, readAt: null as unknown as Date },
        }),
      ]);

    const upcomingCharge =
      chargesOpen.find((c) => c.status === ChargeStatus.OVERDUE) ??
      chargesOpen[0] ??
      null;

    return {
      condominiumId: condoId,
      upcomingCharge: upcomingCharge
        ? toChargeResponse(upcomingCharge, condo)
        : null,
      pendingChargesCount: chargesOpen.length,
      unreadNotificationsCount: unreadCount,
      waitingDeliveries: parcels.map((p) => ({
        id: p.id,
        condominiumId: p.condominiumId,
        unitId: p.unitId,
        residentId: p.residentId,
        carrier: p.carrier,
        trackingCode: p.trackingCode,
        status: p.status,
        receivedAt: p.receivedAt,
        deliveredAt: p.deliveredAt,
        notes: p.notes,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
      nextReservation: nextReservation
        ? toReservationResponse(nextReservation)
        : null,
      pinnedBulletin: pinned
        ? {
            id: pinned.id,
            condominiumId: pinned.condominiumId,
            title: pinned.title,
            body: pinned.body,
            priority: pinned.priority,
            expiresAt: pinned.expiresAt,
            pinned: pinned.pinned,
            createdByUserId: pinned.createdByUserId,
            createdAt: pinned.createdAt,
            updatedAt: pinned.updatedAt,
          }
        : null,
    };
  }

  // ── helpers ──────────────────────────────────────────────────────

  private async resolveDefaultCondominium(userId: string): Promise<string> {
    const m = await this.membershipRepo.findOne({ where: { userId } });
    if (!m) {
      throw new NotFoundException('Usuário não pertence a nenhum condomínio.');
    }
    return m.condominiumId;
  }

  private async assertMembership(
    userId: string,
    condominiumId: string,
  ): Promise<string> {
    const m = await this.membershipRepo.findOne({
      where: { userId, condominiumId },
    });
    if (!m) {
      throw new NotFoundException('Você não pertence a este condomínio.');
    }
    return condominiumId;
  }

  private async findOpenCharges(
    userId: string,
    condominiumId: string,
  ): Promise<Charge[]> {
    const residents = await this.residentRepo
      .createQueryBuilder('r')
      .innerJoin('r.unit', 'u')
      .where('r.user_id = :userId', { userId })
      .andWhere('u.condominium_id = :condominiumId', { condominiumId })
      .getMany();
    const unitIds = residents.map((r) => r.unitId);
    if (unitIds.length === 0) return [];
    return this.chargeRepo
      .createQueryBuilder('c')
      .where({ unitId: In(unitIds) })
      .andWhere('c.status IN (:...statuses)', {
        statuses: [ChargeStatus.PENDING, ChargeStatus.OVERDUE],
      })
      .orderBy('c.due_date', 'ASC')
      .getMany();
  }

  private async findWaitingParcels(
    userId: string,
    condominiumId: string,
  ): Promise<Parcel[]> {
    const residents = await this.residentRepo
      .createQueryBuilder('r')
      .innerJoin('r.unit', 'u')
      .where('r.user_id = :userId', { userId })
      .andWhere('u.condominium_id = :condominiumId', { condominiumId })
      .getMany();
    const unitIds = residents.map((r) => r.unitId);
    if (unitIds.length === 0) return [];
    return this.parcelRepo.find({
      where: { unitId: In(unitIds), status: ParcelStatus.RECEIVED },
      order: { receivedAt: 'DESC' },
      take: 5,
    });
  }

  private async findNextReservation(
    userId: string,
    condominiumId: string,
  ): Promise<Reservation | null> {
    return this.reservationRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.area', 'area')
      .innerJoin('residents', 'res', 'res.user_id = :userId', { userId })
      .where('r.condominium_id = :condominiumId', { condominiumId })
      .andWhere('r.unit_id = res.unit_id')
      .andWhere('r.start_at >= NOW()')
      .andWhere('r.status IN (:...statuses)', {
        statuses: [ReservationStatus.PENDING, ReservationStatus.APPROVED],
      })
      .orderBy('r.start_at', 'ASC')
      .getOne();
  }

  private async findPinnedBulletin(
    condominiumId: string,
  ): Promise<BulletinPost | null> {
    // Prioriza fixado mais recente; cai para o post recente quando
    // nenhum estiver fixado.
    const pinned = await this.bulletinRepo.findOne({
      where: { condominiumId, pinned: true },
      order: { createdAt: 'DESC' },
    });
    if (pinned) return pinned;
    return this.bulletinRepo.findOne({
      where: { condominiumId },
      order: { createdAt: 'DESC' },
    });
  }
}
