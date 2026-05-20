import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ChargeStatus } from '../../../common/enums';

export class ChargeResponseDto {
  @ApiProperty({ example: 'a71ac8a7-87b0-468b-9f10-ec781f3878c3' })
  id: string;

  @ApiProperty({ example: '82f1c46f-f7f7-4f9e-82cb-cbd38341f5f0' })
  unitId: string;

  @ApiProperty({ example: '2026-04' })
  billingMonth: string;

  @ApiProperty({ example: '180.00' })
  amount: string;

  @ApiProperty({ example: '2026-04-10' })
  dueDate: string;

  @ApiPropertyOptional({
    example: 'Rateio de pintura da fachada.',
    nullable: true,
  })
  description: string | null;

  @ApiProperty({ enum: ChargeStatus, example: ChargeStatus.PENDING })
  status: ChargeStatus;

  @ApiPropertyOptional({ example: null, nullable: true })
  paidAt: Date | null;

  @ApiPropertyOptional({
    description: 'Método de pagamento. Asaas: PIX/BOLETO/CREDIT_CARD/etc. Manual: MANUAL_*.',
    nullable: true,
  })
  paidMethod: string | null;

  @ApiPropertyOptional({ description: 'Observação livre do admin.', nullable: true })
  paidNote: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  exemptReason: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  canceledAt: Date | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  cancelReason: string | null;

  @ApiProperty({ example: '2026-04-01T09:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-04-01T09:00:00.000Z' })
  updatedAt: Date;

  /**
   * BR Code Pix (copia e cola). `null` quando a cobrança não está em
   * aberto ou o condomínio ainda não configurou chave Pix.
   */
  @ApiPropertyOptional({
    example:
      '00020126480014BR.GOV.BCB.PIX0114+5511999999999520400005303986540565.405802BR5925EDIFICIO AURORA6009SAO PAULO62070503TX-2026-056304ABCD',
    nullable: true,
  })
  pixCode: string | null;

  // ── Asaas (gateway) ────────────────────────────────────────────────
  // Preenchidos quando a cobrança foi emitida via subconta Asaas.
  // Frontend usa para renderizar QR Pix + boleto + Asaas Checkout.

  @ApiPropertyOptional({ example: 'pay_876bc7cz3dr19bz8', nullable: true })
  asaasPaymentId: string | null;

  @ApiPropertyOptional({
    example: 'https://sandbox.asaas.com/i/876bc7cz3dr19bz8',
    nullable: true,
  })
  asaasInvoiceUrl: string | null;

  @ApiPropertyOptional({ nullable: true })
  asaasPixPayload: string | null;

  @ApiPropertyOptional({ nullable: true })
  asaasPixQrBase64: string | null;

  @ApiPropertyOptional({
    example: 'https://sandbox.asaas.com/b/pdf/876bc7cz3dr19bz8',
    nullable: true,
  })
  asaasBankSlipUrl: string | null;

  @ApiPropertyOptional({
    description: 'Recibo oficial da Asaas (link público).',
    nullable: true,
  })
  asaasTransactionReceiptUrl: string | null;

  @ApiPropertyOptional({
    enum: ['PIX', 'BOLETO', 'CREDIT_CARD', 'DEBIT_CARD', 'CASH', 'TRANSFER'],
    nullable: true,
  })
  asaasPaidVia: string | null;

  @ApiPropertyOptional({ example: 'PAYMENT_CREATED', nullable: true })
  asaasLastEvent: string | null;

  @ApiPropertyOptional({ nullable: true })
  asaasSyncedAt: Date | null;
}

export class GenerateMonthAsaasFailureDto {
  @ApiProperty()
  chargeId: string;

  @ApiProperty()
  unitId: string;

  @ApiProperty({ example: 'A-101' })
  unitLabel: string;

  @ApiProperty({ example: 'Unidade sem responsável financeiro.' })
  message: string;
}

export class GenerateMonthResponseDto {
  @ApiProperty({ example: 24 })
  created: number;

  @ApiProperty({
    example: 2,
    description: 'Unidades que já tinham cobrança ativa no mês.',
  })
  skipped: number;

  @ApiProperty({
    example: 22,
    description: 'Cobranças emitidas na Asaas com sucesso.',
  })
  asaasEmitted: number;

  @ApiProperty({
    example: 2,
    description: 'Cobranças criadas localmente mas não enviadas à Asaas.',
  })
  asaasFailed: number;

  @ApiProperty({ type: [GenerateMonthAsaasFailureDto] })
  failures: GenerateMonthAsaasFailureDto[];
}

export class EmitPendingAsaasResponseDto {
  @ApiProperty({ example: 5 })
  emitted: number;

  @ApiProperty({ example: 1 })
  failed: number;

  @ApiProperty({ type: [GenerateMonthAsaasFailureDto] })
  failures: GenerateMonthAsaasFailureDto[];
}
