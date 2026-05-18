import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

/** Métodos aceitos pra baixa manual. Asaas-paid usa o `billingType` direto. */
export const MANUAL_PAID_METHODS = [
  'MANUAL_CASH',
  'MANUAL_TRANSFER',
  'MANUAL_PIX',
  'MANUAL_BOLETO',
  'MANUAL_OTHER',
] as const;
export type ManualPaidMethod = (typeof MANUAL_PAID_METHODS)[number];

export class MarkPaidDto {
  @ApiPropertyOptional({ description: 'Data do pagamento (ISO).' })
  @IsOptional()
  @IsString()
  paidAt?: string;

  @ApiPropertyOptional({
    enum: MANUAL_PAID_METHODS,
    description: 'Como o pagador quitou (informativo).',
  })
  @IsOptional()
  @IsIn(MANUAL_PAID_METHODS as unknown as string[])
  method?: ManualPaidMethod;

  @ApiPropertyOptional({
    description: 'Observação livre exibida no comprovante (até 280 chars).',
    maxLength: 280,
  })
  @IsOptional()
  @IsString()
  @MaxLength(280)
  note?: string;
}
