import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { PixKeyType } from '../../../common/enums';

export class CreateCondominiumDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  /**
   * Documento fiscal da administração. Aceita CPF (11 dígitos) ou
   * CNPJ (14). Opcional — condomínios informais podem deixar em branco
   * e o síndico recebe via CPF dele na subconta Asaas.
   */
  @ApiPropertyOptional({
    description:
      'CPF (11 dígitos) ou CNPJ (14) da administração. Opcional para condomínios informais.',
  })
  @IsOptional()
  @IsString()
  cnpj?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  address?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  photoUrl?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  monthlyFeeAmount?: number;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(28)
  billingGenerationDay?: number;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(28)
  billingDueDay?: number;

  @ApiPropertyOptional({ enum: PixKeyType })
  @IsOptional()
  @IsEnum(PixKeyType)
  pixKeyType?: PixKeyType;

  @ApiPropertyOptional({
    description: 'Valor da chave Pix (CPF/CNPJ/email/telefone/EVP).',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  pixKeyValue?: string;

  @ApiPropertyOptional({
    description: 'Telefone/WhatsApp da administração (DDD + número).',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  adminContactPhone?: string;
}
