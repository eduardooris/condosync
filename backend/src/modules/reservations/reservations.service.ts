import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole } from '../../common/enums';
import { ReservationArea } from '../../database/entities/reservation-area.entity';
import {
  Reservation,
  ReservationStatus,
} from '../../database/entities/reservation.entity';
import { Resident } from '../../database/entities/resident.entity';
import { Unit } from '../../database/entities/unit.entity';
import { UserCondominium } from '../../database/entities/user-condominium.entity';
import {
  CreateReservationAreaDto,
  UpdateReservationAreaDto,
} from './dto/reservation-area.dto';
import {
  CancelReservationDto,
  CreateReservationDto,
  RejectReservationDto,
} from './dto/reservation.dto';

@Injectable()
export class ReservationsService {
  constructor(
    @InjectRepository(ReservationArea)
    private readonly areaRepo: Repository<ReservationArea>,
    @InjectRepository(Reservation)
    private readonly reservationRepo: Repository<Reservation>,
    @InjectRepository(Unit)
    private readonly unitRepo: Repository<Unit>,
    @InjectRepository(Resident)
    private readonly residentRepo: Repository<Resident>,
    @InjectRepository(UserCondominium)
    private readonly membershipRepo: Repository<UserCondominium>,
  ) {}

  async listAreas(condominiumId: string): Promise<ReservationArea[]> {
    return this.areaRepo.find({
      where: { condominiumId },
      order: { name: 'ASC' },
    });
  }

  async createArea(
    condominiumId: string,
    dto: CreateReservationAreaDto,
  ): Promise<ReservationArea> {
    const row = this.areaRepo.create({
      condominiumId,
      name: dto.name.trim(),
      description: dto.description?.trim() || null,
      requiresApproval: dto.requiresApproval ?? false,
      maxPerUnitPerWeek: dto.maxPerUnitPerWeek ?? 1,
      slotMinutes: dto.slotMinutes ?? 60,
      active: true,
    });
    return this.areaRepo.save(row);
  }

  async updateArea(
    condominiumId: string,
    areaId: string,
    dto: UpdateReservationAreaDto,
  ): Promise<ReservationArea> {
    const area = await this.areaRepo.findOne({
      where: { id: areaId, condominiumId },
    });
    if (!area) throw new NotFoundException('Área de reserva não encontrada.');
    if (dto.name !== undefined) area.name = dto.name.trim();
    if (dto.description !== undefined)
      area.description = dto.description?.trim() || null;
    if (dto.requiresApproval !== undefined)
      area.requiresApproval = dto.requiresApproval;
    if (dto.maxPerUnitPerWeek !== undefined)
      area.maxPerUnitPerWeek = dto.maxPerUnitPerWeek;
    if (dto.slotMinutes !== undefined) area.slotMinutes = dto.slotMinutes;
    if (dto.active !== undefined) area.active = dto.active;
    return this.areaRepo.save(area);
  }

  async listReservations(condominiumId: string): Promise<Reservation[]> {
    return this.reservationRepo.find({
      where: { condominiumId },
      order: { startAt: 'ASC' },
      relations: ['area', 'unit', 'resident'],
    });
  }

  async createReservation(
    userId: string,
    condominiumId: string,
    dto: CreateReservationDto,
  ): Promise<Reservation> {
    const [area, unit] = await Promise.all([
      this.areaRepo.findOne({ where: { id: dto.areaId, condominiumId } }),
      this.unitRepo.findOne({ where: { id: dto.unitId, condominiumId } }),
    ]);
    if (!area || !area.active) {
      throw new NotFoundException('Área de reserva não encontrada ou inativa.');
    }
    if (!unit) throw new NotFoundException('Unidade não encontrada.');
    const resident = await this.residentRepo.findOne({
      where: { unitId: unit.id, userId },
    });
    if (!resident) {
      throw new ForbiddenException(
        'Você precisa estar vinculado como morador da unidade para reservar.',
      );
    }
    const startAt = new Date(dto.startAt);
    const endAt = new Date(dto.endAt);
    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
      throw new BadRequestException('Período de reserva inválido.');
    }
    if (endAt <= startAt) {
      throw new BadRequestException(
        'A data/hora de término deve ser maior que o início.',
      );
    }
    const durationMinutes = Math.round(
      (endAt.getTime() - startAt.getTime()) / (1000 * 60),
    );
    if (durationMinutes % area.slotMinutes !== 0) {
      throw new BadRequestException(
        `A reserva deve respeitar blocos de ${area.slotMinutes} minutos.`,
      );
    }
    const overlapCount = await this.reservationRepo
      .createQueryBuilder('r')
      .where('r.condominium_id = :condominiumId', { condominiumId })
      .andWhere('r.area_id = :areaId', { areaId: area.id })
      .andWhere('r.status IN (:...statuses)', {
        statuses: [ReservationStatus.PENDING, ReservationStatus.APPROVED],
      })
      .andWhere('r.start_at < :endAt AND r.end_at > :startAt', {
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
      })
      .getCount();
    if (overlapCount > 0) {
      throw new BadRequestException(
        'Já existe uma reserva nesse intervalo para a área.',
      );
    }
    const [weekStart, weekEnd] = this.weekRange(startAt);
    const weekCount = await this.reservationRepo
      .createQueryBuilder('r')
      .where('r.condominium_id = :condominiumId', { condominiumId })
      .andWhere('r.unit_id = :unitId', { unitId: unit.id })
      .andWhere('r.area_id = :areaId', { areaId: area.id })
      .andWhere('r.status IN (:...statuses)', {
        statuses: [ReservationStatus.PENDING, ReservationStatus.APPROVED],
      })
      .andWhere('r.start_at >= :weekStart AND r.start_at < :weekEnd', {
        weekStart: weekStart.toISOString(),
        weekEnd: weekEnd.toISOString(),
      })
      .getCount();
    if (weekCount >= area.maxPerUnitPerWeek) {
      throw new BadRequestException(
        'Limite semanal de reservas para esta unidade já foi atingido nesta área.',
      );
    }
    const row = this.reservationRepo.create({
      condominiumId,
      areaId: area.id,
      unitId: unit.id,
      residentId: resident.id,
      startAt,
      endAt,
      status: area.requiresApproval
        ? ReservationStatus.PENDING
        : ReservationStatus.APPROVED,
    });
    return this.reservationRepo.save(row);
  }

  async approve(
    userId: string,
    condominiumId: string,
    reservationId: string,
  ): Promise<Reservation> {
    const row = await this.findReservation(condominiumId, reservationId);
    if (row.status !== ReservationStatus.PENDING) {
      throw new BadRequestException(
        'Apenas reservas pendentes podem ser aprovadas.',
      );
    }
    row.status = ReservationStatus.APPROVED;
    row.reviewedByUserId = userId;
    row.reviewedAt = new Date();
    row.cancelReason = null;
    return this.reservationRepo.save(row);
  }

  async reject(
    userId: string,
    condominiumId: string,
    reservationId: string,
    dto: RejectReservationDto,
  ): Promise<Reservation> {
    const row = await this.findReservation(condominiumId, reservationId);
    if (row.status !== ReservationStatus.PENDING) {
      throw new BadRequestException(
        'Apenas reservas pendentes podem ser recusadas.',
      );
    }
    row.status = ReservationStatus.REJECTED;
    row.reviewedByUserId = userId;
    row.reviewedAt = new Date();
    row.cancelReason = dto.reason?.trim() || null;
    return this.reservationRepo.save(row);
  }

  async cancel(
    userId: string,
    condominiumId: string,
    reservationId: string,
    dto: CancelReservationDto,
  ): Promise<Reservation> {
    const row = await this.findReservation(condominiumId, reservationId);
    if (
      row.status === ReservationStatus.CANCELED ||
      row.status === ReservationStatus.REJECTED
    ) {
      throw new BadRequestException('A reserva já foi encerrada.');
    }
    const membership = await this.membershipRepo.findOne({
      where: { condominiumId, userId },
    });
    if (!membership) {
      throw new ForbiddenException('Você não pertence a este condomínio.');
    }
    const isAdmin =
      membership.role === UserRole.ADMIN ||
      membership.role === UserRole.SUB_ADMIN;
    const actorResident = await this.residentRepo.findOne({
      where: { userId, unitId: row.unitId },
    });
    if (!isAdmin && !actorResident) {
      throw new ForbiddenException(
        'Apenas o solicitante da unidade ou administração podem cancelar.',
      );
    }
    row.status = ReservationStatus.CANCELED;
    row.cancelReason = dto.reason?.trim() || null;
    row.reviewedByUserId = isAdmin ? userId : null;
    row.reviewedAt = new Date();
    return this.reservationRepo.save(row);
  }

  private async findReservation(
    condominiumId: string,
    reservationId: string,
  ): Promise<Reservation> {
    const row = await this.reservationRepo.findOne({
      where: { id: reservationId, condominiumId },
    });
    if (!row) throw new NotFoundException('Reserva não encontrada.');
    return row;
  }

  private weekRange(date: Date): [Date, Date] {
    const start = new Date(date);
    const day = start.getUTCDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    start.setUTCDate(start.getUTCDate() + diffToMonday);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 7);
    return [start, end];
  }
}
