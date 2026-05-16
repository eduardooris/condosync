import { Reservation } from '../../database/entities/reservation.entity';
import { ReservationResponseDto } from './dto/reservation.dto';

/**
 * Denormaliza `area.name` em `areaName` para evitar que o cliente
 * precise consultar a área separadamente. Requer que a relação
 * `area` esteja carregada (use `relations: ['area']` no repo).
 */
export const toReservationResponse = (
  r: Reservation,
): ReservationResponseDto => ({
  id: r.id,
  condominiumId: r.condominiumId,
  areaId: r.areaId,
  areaName: r.area?.name ?? '',
  unitId: r.unitId,
  residentId: r.residentId,
  startAt: r.startAt,
  endAt: r.endAt,
  status: r.status,
  reviewedByUserId: r.reviewedByUserId,
  reviewedAt: r.reviewedAt,
  cancelReason: r.cancelReason,
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
});
