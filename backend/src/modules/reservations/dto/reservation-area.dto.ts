import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateReservationAreaDto {
  @ApiProperty({ example: 'Salão de festas' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional({ example: 'Capacidade para 40 pessoas.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ example: true, default: false })
  @IsOptional()
  @IsBoolean()
  requiresApproval?: boolean;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxPerUnitPerWeek?: number;

  @ApiPropertyOptional({ example: 60, default: 60 })
  @IsOptional()
  @IsInt()
  @Min(30)
  slotMinutes?: number;
}

export class UpdateReservationAreaDto {
  @ApiPropertyOptional({ example: 'Espaço gourmet' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ example: 'Com churrasqueira e bancada.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  requiresApproval?: boolean;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxPerUnitPerWeek?: number;

  @ApiPropertyOptional({ example: 120 })
  @IsOptional()
  @IsInt()
  @Min(30)
  slotMinutes?: number;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class ReservationAreaResponseDto {
  @ApiProperty({ example: 'cbf76f9a-77e7-4b46-aa97-3f6d66f673fd' })
  id: string;

  @ApiProperty({ example: '7ee25f46-38c5-4f46-93bf-97b67840a8b6' })
  condominiumId: string;

  @ApiProperty({ example: 'Salão de festas' })
  name: string;

  @ApiPropertyOptional({
    example: 'Capacidade para 40 pessoas.',
    nullable: true,
  })
  description: string | null;

  @ApiProperty({ example: false })
  requiresApproval: boolean;

  @ApiProperty({ example: 1 })
  maxPerUnitPerWeek: number;

  @ApiProperty({ example: 60 })
  slotMinutes: number;

  @ApiProperty({ example: true })
  active: boolean;

  @ApiProperty({ example: '2026-04-26T02:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-04-26T02:00:00.000Z' })
  updatedAt: Date;
}
