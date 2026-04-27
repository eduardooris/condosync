import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ResidentResponseDto {
  @ApiProperty({
    example: '7e6c5b4a-3d2c-4e1f-9a0b-c8d7e6f5a4b3',
    description: 'Identificador do morador.',
  })
  id: string;

  @ApiProperty({
    example: '82f1c46f-f7f7-4f9e-82cb-cbd38341f5f0',
    description: 'Unidade vinculada ao morador.',
  })
  unitId: string;

  @ApiPropertyOptional({
    example: 'd1a6ee0d-8b86-4c36-bbe2-066d88f5d886',
    nullable: true,
    description:
      'ID do usuário do CondoSync vinculado (quando o morador também faz login).',
  })
  userId: string | null;

  @ApiProperty({ example: 'Maria da Silva' })
  fullName: string;

  @ApiProperty({
    example: '12345678909',
    description: 'CPF apenas com dígitos.',
  })
  cpf: string;

  @ApiProperty({
    example: '5581999999999',
    description:
      'WhatsApp no formato 55 + DDD + número (sem caracteres especiais).',
  })
  phoneWhatsapp: string;

  @ApiPropertyOptional({ example: 'maria@email.com', nullable: true })
  email: string | null;

  @ApiProperty({
    example: true,
    description:
      'Sinaliza o responsável financeiro da unidade (1 por unidade).',
  })
  isFinancialResponsible: boolean;

  @ApiProperty({ example: '2026-01-10T13:42:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-04-22T11:00:00.000Z' })
  updatedAt: Date;
}

/**
 * Visão "vizinhos" — sem PII (RN-02.1). Disponível para qualquer
 * membro do condomínio.
 */
export class NeighborResidentResponseDto {
  @ApiProperty({ example: '7e6c5b4a-3d2c-4e1f-9a0b-c8d7e6f5a4b3' })
  id: string;

  @ApiProperty({ example: 'Maria da Silva' })
  fullName: string;

  @ApiProperty({ example: 'A' })
  block: string;

  @ApiProperty({ example: '101' })
  number: string;
}
