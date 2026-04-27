import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, Matches } from 'class-validator';

export class GenerateMonthDto {
  @ApiPropertyOptional({
    example: '2026-04',
    description:
      'Mês de competência no formato YYYY-MM. Quando omitido, usa o mês corrente em America/Sao_Paulo.',
  })
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'billingMonth deve estar no formato YYYY-MM (ex.: 2026-04).',
  })
  billingMonth?: string;
}
