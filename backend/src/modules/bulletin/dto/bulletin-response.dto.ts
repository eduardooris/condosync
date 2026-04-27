import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BulletinPriority } from '../../../common/enums';

export class BulletinResponseDto {
  @ApiProperty({ example: 'bp-1' })
  id: string;

  @ApiProperty({ example: 'b5a6acbb-f664-4f62-9692-93887d9aafef' })
  condominiumId: string;

  @ApiProperty({ example: 'Manutenção da caixa d’água' })
  title: string;

  @ApiProperty({ example: 'Sexta-feira das 8h às 12h sem água.' })
  body: string;

  @ApiProperty({ enum: BulletinPriority, example: BulletinPriority.URGENT })
  priority: BulletinPriority;

  @ApiPropertyOptional({ example: '2026-05-30T23:59:59.000Z', nullable: true })
  expiresAt: Date | null;

  @ApiPropertyOptional({
    example: 'd1a6ee0d-8b86-4c36-bbe2-066d88f5d886',
    nullable: true,
  })
  createdByUserId: string | null;

  @ApiProperty({ example: '2026-04-22T11:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-04-22T11:00:00.000Z' })
  updatedAt: Date;
}
