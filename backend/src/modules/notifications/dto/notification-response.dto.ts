import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationType } from '../../../database/entities/notification.entity';

export class NotificationResponseDto {
  @ApiProperty({ example: '7c2f4c5a-8a1e-4d4a-9b9b-2a4f0e1f7a99' })
  id: string;

  @ApiProperty({ example: 'd1a6ee0d-8b86-4c36-bbe2-066d88f5d886' })
  userId: string;

  @ApiPropertyOptional({
    example: 'b5a6acbb-f664-4f62-9692-93887d9aafef',
    nullable: true,
  })
  condominiumId: string | null;

  @ApiProperty({
    enum: NotificationType,
    example: NotificationType.CHARGE_CREATED,
  })
  type: NotificationType;

  @ApiProperty({ example: 'Nova cobrança disponível' })
  title: string;

  @ApiProperty({
    example: 'Sua cobrança de 2026-04 foi gerada e vence em 2026-04-10.',
  })
  body: string;

  @ApiPropertyOptional({
    example: { chargeId: 'ch-1' },
    nullable: true,
    type: 'object',
    additionalProperties: true,
  })
  payload: Record<string, unknown> | null;

  @ApiPropertyOptional({
    example: '/charges/ch-1',
    nullable: true,
    description:
      'URL relativa para abrir a tela do recurso ao tocar/clicar na notificação.',
  })
  deeplink: string | null;

  @ApiPropertyOptional({
    example: '2026-04-22T11:00:00.000Z',
    nullable: true,
  })
  readAt: Date | null;

  @ApiProperty({ example: '2026-04-22T10:55:00.000Z' })
  createdAt: Date;
}

export class UnreadCountResponseDto {
  @ApiProperty({ example: 5 })
  unread: number;
}

export class UpdatedCountResponseDto {
  @ApiProperty({ example: 3 })
  updated: number;
}

export class NotificationsPageResponseDto {
  @ApiProperty({ type: NotificationResponseDto, isArray: true })
  items: NotificationResponseDto[];

  @ApiPropertyOptional({
    example: '2026-04-22T10:55:00.000Z',
    nullable: true,
    description:
      'Cursor opaco (ISO `createdAt` do último item) para a próxima página. `null` indica fim.',
  })
  nextCursor: string | null;
}
