import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentVisibility } from '../../../common/enums';

export class DocumentResponseDto {
  @ApiProperty({ example: 'doc-1' })
  id: string;

  @ApiProperty({ example: 'b5a6acbb-f664-4f62-9692-93887d9aafef' })
  condominiumId: string;

  @ApiProperty({ example: 'Ata da assembleia 04/2026' })
  title: string;

  @ApiPropertyOptional({ example: 'Aprovação de pintura', nullable: true })
  description: string | null;

  @ApiProperty({ example: 'minutes' })
  category: string;

  @ApiProperty({ example: '2026-04-15' })
  documentDate: string;

  @ApiProperty({ enum: DocumentVisibility, example: DocumentVisibility.ALL })
  visibility: DocumentVisibility;

  @ApiProperty({ example: 'documents/b5a6.../ata-abril.pdf' })
  storageKey: string;

  @ApiPropertyOptional({
    example: 'd1a6ee0d-8b86-4c36-bbe2-066d88f5d886',
    nullable: true,
  })
  createdByUserId: string | null;

  @ApiProperty({ example: '2026-04-15T11:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-04-15T11:00:00.000Z' })
  updatedAt: Date;
}
