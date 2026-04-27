import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateResidentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  userId?: string | null;

  @ApiProperty()
  @IsString()
  fullName: string;

  @ApiProperty({ description: 'CPF com ou sem máscara' })
  @IsString()
  cpf: string;

  @ApiProperty()
  @IsString()
  phoneWhatsapp: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isFinancialResponsible?: boolean;
}
