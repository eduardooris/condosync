import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

export class UpdateMeDto {
  @ApiPropertyOptional({ nullable: true, description: 'Nome exibido no app.' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(200)
  fullName?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'WhatsApp para receber o link de “esqueci minha senha” (prioridade sobre o número do morador).',
    example: '11987654321',
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @ValidateIf((_, v) => v != null && v !== '')
  @IsString()
  @MaxLength(32)
  phoneWhatsapp?: string | null;
}
