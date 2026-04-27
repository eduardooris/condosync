import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ChargeStatus } from '../../../common/enums';

export class ChargeResponseDto {
  @ApiProperty({ example: 'a71ac8a7-87b0-468b-9f10-ec781f3878c3' })
  id: string;

  @ApiProperty({ example: '82f1c46f-f7f7-4f9e-82cb-cbd38341f5f0' })
  unitId: string;

  @ApiProperty({ example: '2026-04' })
  billingMonth: string;

  @ApiProperty({ example: '180.00' })
  amount: string;

  @ApiProperty({ example: '2026-04-10' })
  dueDate: string;

  @ApiPropertyOptional({
    example: 'Rateio de pintura da fachada.',
    nullable: true,
  })
  description: string | null;

  @ApiProperty({ enum: ChargeStatus, example: ChargeStatus.PENDING })
  status: ChargeStatus;

  @ApiPropertyOptional({ example: null, nullable: true })
  paidAt: Date | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  exemptReason: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  canceledAt: Date | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  cancelReason: string | null;

  @ApiProperty({ example: '2026-04-01T09:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-04-01T09:00:00.000Z' })
  updatedAt: Date;
}

export class GenerateMonthResponseDto {
  @ApiProperty({ example: 24 })
  created: number;
}
