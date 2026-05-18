import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  PaymentAccountApprovalStatus,
  PaymentAccountHolderType,
  PaymentAccountStatus,
} from '../../../../database/entities/payment-account.entity';

/**
 * Resposta enviada ao frontend. Nunca inclui `asaas_api_key` nem o
 * `asaas_webhook_token` — ambos são segredos internos.
 */
export class PaymentAccountResponseDto {
  @ApiProperty({ example: '7c2f4c5a-8a1e-4d4a-9b9b-2a4f0e1f7a99' })
  id: string;

  @ApiProperty({ example: 'b5a6acbb-f664-4f62-9692-93887d9aafef' })
  condominiumId: string;

  @ApiProperty({ enum: PaymentAccountHolderType })
  holderType: PaymentAccountHolderType;

  @ApiProperty({ example: '249***637*92', description: 'CPF/CNPJ mascarado.' })
  holderCpfCnpjMasked: string;

  @ApiProperty({ example: 'Edifício Aurora LTDA' })
  holderLegalName: string;

  @ApiProperty({ enum: PaymentAccountStatus })
  status: PaymentAccountStatus;

  @ApiPropertyOptional({ enum: PaymentAccountApprovalStatus, nullable: true })
  commercialInfoStatus: PaymentAccountApprovalStatus | null;

  @ApiPropertyOptional({ enum: PaymentAccountApprovalStatus, nullable: true })
  bankAccountInfoStatus: PaymentAccountApprovalStatus | null;

  @ApiPropertyOptional({ enum: PaymentAccountApprovalStatus, nullable: true })
  documentationStatus: PaymentAccountApprovalStatus | null;

  @ApiPropertyOptional({ example: 'Documento ilegível', nullable: true })
  rejectReason: string | null;

  @ApiPropertyOptional({
    example: 'https://www.asaas.com/onboarding/...',
    nullable: true,
    description: 'Link para o titular subir documentos (Asaas onboarding).',
  })
  onboardingUrl: string | null;

  @ApiProperty({ example: '2026-05-20T13:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-05-20T13:00:00.000Z' })
  updatedAt: Date;

  @ApiPropertyOptional({ example: '2026-05-20T13:05:00.000Z', nullable: true })
  lastStatusCheckAt: Date | null;
}

/**
 * Resposta minimalista quando a subconta acabou de ser criada (POST).
 * Devolve um warning explícito ao frontend: a `apiKey` foi armazenada e o
 * usuário não terá acesso a ela.
 */
export class CreatePaymentAccountResponseDto extends PaymentAccountResponseDto {
  @ApiProperty({
    example:
      'Subconta criada. A apiKey foi armazenada com segurança e não está disponível na resposta.',
  })
  message: string;
}
