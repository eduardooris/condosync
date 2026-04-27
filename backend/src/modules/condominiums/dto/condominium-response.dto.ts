import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PixKeyType, UserRole } from '../../../common/enums';

export class CondominiumResponseDto {
  @ApiProperty({ example: 'b5a6acbb-f664-4f62-9692-93887d9aafef' })
  id: string;

  @ApiProperty({ example: 'Edifício Aurora' })
  name: string;

  @ApiProperty({ example: '12345678000190' })
  cnpj: string;

  @ApiPropertyOptional({
    example: { street: 'Rua das Flores', number: '100', city: 'Recife' },
    nullable: true,
    type: 'object',
    additionalProperties: true,
  })
  address: Record<string, unknown> | null;

  @ApiPropertyOptional({
    example: 'https://cdn.exemplo.com/photo.jpg',
    nullable: true,
  })
  photoUrl: string | null;

  @ApiProperty({ example: '180.00' })
  monthlyFeeAmount: string;

  @ApiProperty({ example: 1 })
  billingGenerationDay: number;

  @ApiProperty({ example: 10 })
  billingDueDay: number;

  @ApiPropertyOptional({ enum: PixKeyType, nullable: true })
  pixKeyType: PixKeyType | null;

  @ApiPropertyOptional({
    example: 'financeiro@condominio.com',
    nullable: true,
  })
  pixKeyValue: string | null;

  @ApiPropertyOptional({
    example: '85991712228',
    nullable: true,
  })
  adminContactPhone: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  archivedAt: Date | null;

  @ApiProperty({ example: '2026-01-10T13:42:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-04-22T11:00:00.000Z' })
  updatedAt: Date;
}

export class MembershipResponseDto {
  @ApiProperty({ example: '12da3a3c-1b1f-4e85-8d6f-9c4f7a7e0e44' })
  id: string;

  @ApiProperty({ example: 'd1a6ee0d-8b86-4c36-bbe2-066d88f5d886' })
  userId: string;

  @ApiProperty({ example: 'b5a6acbb-f664-4f62-9692-93887d9aafef' })
  condominiumId: string;

  @ApiProperty({ enum: UserRole, example: UserRole.SUB_ADMIN })
  role: UserRole;

  @ApiProperty({ example: '2026-04-22T11:00:00.000Z' })
  createdAt: Date;
}

/**
 * Condomínio enriquecido com a role do usuário corrente. Usado em
 * `GET /condominiums/mine` para o front conseguir fazer gating de UI sem
 * precisar de uma chamada adicional.
 */
export class MyCondominiumResponseDto extends CondominiumResponseDto {
  @ApiProperty({ enum: UserRole, example: UserRole.ADMIN })
  role: UserRole;

  @ApiPropertyOptional({
    example: '12da3a3c-1b1f-4e85-8d6f-9c4f7a7e0e44',
    nullable: true,
    description:
      'Unidade vinculada ao membership (RESIDENT/RESPONSIBLE). Null para ADMIN/SUB_ADMIN.',
  })
  unitId: string | null;
}
