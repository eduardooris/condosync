import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ReservationStatus } from '../../../database/entities/reservation.entity';

export class CreateReservationDto {
  @ApiProperty({ example: 'cbf76f9a-77e7-4b46-aa97-3f6d66f673fd' })
  @IsUUID()
  areaId: string;

  @ApiProperty({ example: '82f1c46f-f7f7-4f9e-82cb-cbd38341f5f0' })
  @IsUUID()
  unitId: string;

  @ApiProperty({ example: '2026-05-12T14:00:00.000Z' })
  @IsDateString()
  startAt: string;

  @ApiProperty({ example: '2026-05-12T16:00:00.000Z' })
  @IsDateString()
  endAt: string;
}

export class RejectReservationDto {
  @ApiPropertyOptional({ example: 'Conflito com manutenção programada.' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason?: string;
}

export class CancelReservationDto {
  @ApiPropertyOptional({ example: 'Mudança de planos.' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason?: string;
}

export class ReservationResponseDto {
  @ApiProperty({ example: 'cbf76f9a-77e7-4b46-aa97-3f6d66f673fd' })
  id: string;

  @ApiProperty({ example: '7ee25f46-38c5-4f46-93bf-97b67840a8b6' })
  condominiumId: string;

  @ApiProperty({ example: '4e2b30b1-509f-4633-872d-57bb41a1f3d7' })
  areaId: string;

  @ApiProperty({ example: '82f1c46f-f7f7-4f9e-82cb-cbd38341f5f0' })
  unitId: string;

  @ApiProperty({ example: 'f6827067-36e8-490a-a859-0330a6e6f73f' })
  residentId: string;

  @ApiProperty({ example: '2026-05-12T14:00:00.000Z' })
  startAt: Date;

  @ApiProperty({ example: '2026-05-12T16:00:00.000Z' })
  endAt: Date;

  @ApiProperty({ enum: ReservationStatus, example: ReservationStatus.PENDING })
  @IsEnum(ReservationStatus)
  status: ReservationStatus;

  @ApiPropertyOptional({
    example: '43cd8f13-8c9d-4646-81cc-8fbf8ff09ce2',
    nullable: true,
  })
  reviewedByUserId: string | null;

  @ApiPropertyOptional({ example: '2026-05-12T12:00:00.000Z', nullable: true })
  reviewedAt: Date | null;

  @ApiPropertyOptional({
    example: 'Conflito com manutenção programada.',
    nullable: true,
  })
  cancelReason: string | null;

  @ApiProperty({ example: '2026-04-26T02:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-04-26T02:00:00.000Z' })
  updatedAt: Date;
}
