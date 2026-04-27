import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { DocumentVisibility } from '../../../common/enums';

export class CreateDocumentDto {
  @ApiProperty()
  @IsString()
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty()
  @IsString()
  category: string;

  @ApiProperty()
  @IsDateString()
  documentDate: string;

  @ApiProperty({ enum: DocumentVisibility })
  @IsEnum(DocumentVisibility)
  visibility: DocumentVisibility;
}
