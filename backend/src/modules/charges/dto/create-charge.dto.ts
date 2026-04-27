import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateChargeDto {
  @ApiProperty()
  @IsUUID()
  unitId: string;

  @ApiProperty({ example: '2026-04' })
  @IsString()
  billingMonth: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  amount?: string;

  @ApiPropertyOptional({ description: 'YYYY-MM-DD' })
  @IsOptional()
  @IsString()
  dueDate?: string;

  @ApiPropertyOptional({
    description: 'Descrição opcional para cobranças avulsas.',
    maxLength: 80,
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  description?: string;
}
