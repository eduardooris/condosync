import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BulletinResponseDto } from '../../bulletin/dto/bulletin-response.dto';
import { ChargeResponseDto } from '../../charges/dto/charge-response.dto';
import { ParcelResponseDto } from '../../visitors/dto/visitors.dto';
import { ReservationResponseDto } from '../../reservations/dto/reservation.dto';

/**
 * Resumo da Home do app/PWA para o morador autenticado. Combina os
 * principais widgets que o app exibe (próxima cobrança, próxima
 * reserva, encomendas aguardando, mural fixado, contador de
 * notificações) em uma única chamada para evitar 5 round-trips no
 * cold-start da Home.
 */
export class ResidentHomeSummaryDto {
  @ApiProperty({
    example: 'b5a6acbb-f664-4f62-9692-93887d9aafef',
    description: 'Condomínio resolvido para o usuário autenticado.',
  })
  condominiumId: string;

  /** Próxima cobrança em aberto (preferindo OVERDUE). */
  @ApiPropertyOptional({ type: ChargeResponseDto, nullable: true })
  upcomingCharge: ChargeResponseDto | null;

  @ApiProperty({
    example: 2,
    description: 'Quantidade total de cobranças em aberto (PENDING+OVERDUE).',
  })
  pendingChargesCount: number;

  @ApiProperty({
    example: 3,
    description: 'Quantidade de notificações in-app não lidas.',
  })
  unreadNotificationsCount: number;

  @ApiProperty({
    type: [ParcelResponseDto],
    description: 'Encomendas aguardando retirada no condomínio do morador.',
  })
  waitingDeliveries: ParcelResponseDto[];

  /** Próxima reserva confirmada/pendente do morador. */
  @ApiPropertyOptional({ type: ReservationResponseDto, nullable: true })
  nextReservation: ReservationResponseDto | null;

  /**
   * Post fixado mais relevante (ou o mais recente quando não há
   * fixado).
   */
  @ApiPropertyOptional({ type: BulletinResponseDto, nullable: true })
  pinnedBulletin: BulletinResponseDto | null;
}
