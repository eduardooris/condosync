import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { PaymentAccountHolderType } from '../../../../database/entities/payment-account.entity';
import { HolderAddressDto } from './holder-address.dto';

/**
 * Payload do setup wizard para criar a subconta Asaas do condomínio.
 *
 * Validação cruzada: quando `holderType=PF`, `birthDate` é obrigatório
 * (Asaas exige). PJ/MEI dispensam.
 */
export class CreatePaymentAccountDto {
  @ApiProperty({
    enum: PaymentAccountHolderType,
    example: PaymentAccountHolderType.PF,
    description:
      'Tipo do titular. PF/MEI exigem RG/CNH + selfie no KYC; PJ exige contrato social + selfie do sócio.',
  })
  @IsEnum(PaymentAccountHolderType)
  holderType: PaymentAccountHolderType;

  @ApiProperty({
    example: '24971563792',
    description: 'CPF (11 dígitos) para PF/MEI, CNPJ (14) para PJ. Só dígitos.',
  })
  @Matches(/^\d{11}$|^\d{14}$/, {
    message: 'cpfCnpj deve ter 11 (CPF) ou 14 (CNPJ) dígitos numéricos.',
  })
  cpfCnpj: string;

  @ApiProperty({
    example: 'Edifício Aurora LTDA',
    description: 'Nome completo (PF) ou razão social (PJ).',
  })
  @IsString()
  @IsNotEmpty()
  @Length(2, 200)
  legalName: string;

  @ApiPropertyOptional({
    example: '1985-03-21',
    description:
      'Data de nascimento do titular (PF/MEI). Obrigatória quando holderType=PF.',
  })
  @ValidateIf(
    (o: CreatePaymentAccountDto) =>
      o.holderType === PaymentAccountHolderType.PF,
  )
  @IsDateString({ strict: true })
  birthDate?: string;

  @ApiProperty({ example: 'sindico@aurora.com.br' })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: '5585991712228',
    description:
      'Telefone com DDI 55 + DDD + 9 dígitos. Só números (Asaas exige).',
  })
  @Matches(/^55\d{10,11}$/, {
    message: 'mobilePhone deve ter formato 55 + DDD + 8 ou 9 dígitos.',
  })
  mobilePhone: string;

  @ApiProperty({
    example: 5000.0,
    description:
      'Renda mensal (PF) ou faturamento mensal (PJ). Obrigatório pelo Asaas.',
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  incomeValue: number;

  @ApiProperty({ type: HolderAddressDto })
  @ValidateNested()
  @Type(() => HolderAddressDto)
  address: HolderAddressDto;

  @ApiPropertyOptional({
    description:
      'Aceite explícito dos termos de pagamento (LGPD + Asaas). Deve ser `true`.',
    example: true,
  })
  @IsOptional()
  termsAcceptedAt?: boolean;
}
