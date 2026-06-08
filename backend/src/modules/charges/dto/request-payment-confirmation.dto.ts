import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Métodos declarados pelo morador ao clicar "Já paguei". Mais enxuto que
 * o conjunto de baixa do síndico porque o morador só sinaliza intenção —
 * a baixa real (e o método final no Asaas) é do síndico.
 */
export const PAYMENT_REQUEST_METHODS = [
  'PIX',
  'CASH',
  'TRANSFER',
  'OTHER',
] as const;
export type PaymentRequestMethod = (typeof PAYMENT_REQUEST_METHODS)[number];

export class RequestPaymentConfirmationDto {
  @ApiProperty({
    enum: PAYMENT_REQUEST_METHODS,
    description:
      'Como o morador declara ter pago. Informativo — o síndico decide o método final na baixa.',
  })
  @IsIn(PAYMENT_REQUEST_METHODS as unknown as string[])
  method: PaymentRequestMethod;

  @ApiPropertyOptional({
    description:
      'Observação livre (ex.: "paguei via Pix do meu Itaú"). Até 280 chars.',
    maxLength: 280,
  })
  @IsOptional()
  @IsString()
  @MaxLength(280)
  note?: string;
}

export class RejectPaymentRequestDto {
  @ApiProperty({
    description: 'Motivo da rejeição — exibido para o morador. Até 280 chars.',
    maxLength: 280,
  })
  @IsString()
  @MaxLength(280)
  reason: string;
}

export class RequestPaymentConfirmationResponseDto {
  @ApiProperty({ example: true })
  requested: true;

  @ApiProperty({
    example: false,
    description:
      'true quando já existia uma solicitação recente (< 24h) — idempotente.',
  })
  alreadyRequested: boolean;
}
