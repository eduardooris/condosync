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
import { ParcelStatus } from '../../../database/entities/parcel.entity';
import { VisitorEntryStatus } from '../../../database/entities/visitor-entry.entity';

export class CreateVisitorEntryDto {
  @ApiProperty({ example: '82f1c46f-f7f7-4f9e-82cb-cbd38341f5f0' })
  @IsUUID()
  unitId: string;

  @ApiProperty({ example: 'João Pereira' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  visitorName: string;

  @ApiPropertyOptional({ example: '123.456.789-00' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  visitorDocument?: string;

  @ApiProperty({ example: '2026-05-03T18:30:00.000Z' })
  @IsDateString()
  expectedAt: string;

  @ApiPropertyOptional({ example: 'Autorizado para evento familiar.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class UpdateVisitorEntryStatusDto {
  @ApiProperty({
    enum: VisitorEntryStatus,
    example: VisitorEntryStatus.ARRIVED,
  })
  @IsEnum(VisitorEntryStatus)
  status: VisitorEntryStatus;
}

export class CreateParcelDto {
  @ApiProperty({ example: '82f1c46f-f7f7-4f9e-82cb-cbd38341f5f0' })
  @IsUUID()
  unitId: string;

  @ApiPropertyOptional({ example: 'f6827067-36e8-490a-a859-0330a6e6f73f' })
  @IsOptional()
  @IsUUID()
  residentId?: string;

  @ApiProperty({ example: 'Correios' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  carrier: string;

  @ApiPropertyOptional({ example: 'BR123456789' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  trackingCode?: string;

  @ApiPropertyOptional({ example: 'Caixa grande.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class UpdateParcelStatusDto {
  @ApiProperty({ enum: ParcelStatus, example: ParcelStatus.DELIVERED })
  @IsEnum(ParcelStatus)
  status: ParcelStatus;
}

export class VisitorEntryResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() condominiumId: string;
  @ApiProperty() unitId: string;
  @ApiProperty() residentId: string;
  @ApiProperty() visitorName: string;
  @ApiPropertyOptional({ nullable: true }) visitorDocument: string | null;
  @ApiProperty() expectedAt: Date;
  @ApiProperty({ enum: VisitorEntryStatus }) status: VisitorEntryStatus;
  @ApiPropertyOptional({ nullable: true }) notes: string | null;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}

export class ParcelResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() condominiumId: string;
  @ApiProperty() unitId: string;
  @ApiPropertyOptional({ nullable: true }) residentId: string | null;
  @ApiProperty() carrier: string;
  @ApiPropertyOptional({ nullable: true }) trackingCode: string | null;
  @ApiProperty({ enum: ParcelStatus }) status: ParcelStatus;
  @ApiProperty() receivedAt: Date;
  @ApiPropertyOptional({ nullable: true }) deliveredAt: Date | null;
  @ApiPropertyOptional({ nullable: true }) notes: string | null;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}
