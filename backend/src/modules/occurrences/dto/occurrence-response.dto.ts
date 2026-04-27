import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OccurrenceStatus } from '../../../common/enums';

export class OccurrenceResponseDto {
  @ApiProperty({ example: 'oc-1' })
  id: string;

  @ApiProperty({ example: 'b5a6acbb-f664-4f62-9692-93887d9aafef' })
  condominiumId: string;

  @ApiProperty({ example: '82f1c46f-f7f7-4f9e-82cb-cbd38341f5f0' })
  unitId: string;

  @ApiProperty({ example: '7e6c5b4a-3d2c-4e1f-9a0b-c8d7e6f5a4b3' })
  authorResidentId: string;

  @ApiProperty({ example: 'Lâmpada queimada no corredor' })
  title: string;

  @ApiProperty({ example: 'iluminacao' })
  category: string;

  @ApiProperty({ example: 'Corredor do bloco A sem luz' })
  description: string;

  @ApiProperty({ enum: OccurrenceStatus, example: OccurrenceStatus.OPEN })
  status: OccurrenceStatus;

  @ApiProperty({ example: false })
  isAnonymous: boolean;

  @ApiPropertyOptional({ example: null, nullable: true })
  attachmentStorageKey: string | null;

  @ApiProperty({ example: '2026-04-22T10:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-04-22T10:00:00.000Z' })
  updatedAt: Date;
}
