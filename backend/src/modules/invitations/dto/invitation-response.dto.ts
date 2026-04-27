import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../../../common/enums';
import {
  InvitationStatus,
  InvitationType,
} from '../../../database/entities/condominium-invitation.entity';

export class InvitationResponseDto {
  @ApiProperty({ example: '0a2cf2a8-9e93-4f1e-a3f9-0f51c86ba0ab' })
  id: string;

  @ApiProperty({ enum: InvitationType, example: InvitationType.EMAIL_DIRECT })
  type: InvitationType;

  @ApiProperty({ enum: UserRole, example: UserRole.RESIDENT })
  role: UserRole;

  @ApiPropertyOptional({ example: 'morador@email.com', nullable: true })
  email: string | null;

  @ApiPropertyOptional({
    example: '5b0e5b96-0dcb-4aab-8e2b-1c40b2b3e441',
    nullable: true,
  })
  unitId: string | null;

  @ApiPropertyOptional({
    example: '98f997ef-20d7-4581-9ca8-a8248e5f0ca3',
    nullable: true,
  })
  residentId: string | null;

  @ApiProperty({ example: '2026-04-30T20:00:00.000Z' })
  expiresAt: Date;

  @ApiProperty({ example: 1 })
  maxUses: number;

  @ApiProperty({ example: 0 })
  usedCount: number;

  @ApiProperty({ enum: InvitationStatus, example: InvitationStatus.ACTIVE })
  status: InvitationStatus;

  @ApiProperty({ example: '2026-04-25T18:00:00.000Z' })
  createdAt: Date;

  /**
   * URL completa pra aceitar o convite. Vem APENAS na resposta de criação
   * (uma única vez); listagem subsequente NÃO retorna URL pq o token bruto
   * não fica no DB.
   */
  @ApiPropertyOptional({
    example: 'http://localhost:5173/invite/abc123...',
    nullable: true,
  })
  url?: string | null;
}

export class InvitationPreviewDto {
  @ApiProperty({ example: 'Edifício Aurora' })
  condominiumName: string;

  @ApiProperty({ enum: UserRole, example: UserRole.RESIDENT })
  role: UserRole;

  @ApiProperty({ enum: InvitationType, example: InvitationType.EMAIL_DIRECT })
  type: InvitationType;

  @ApiProperty({
    example: false,
    description:
      'Quando true, ao aceitar o usuário entra como PENDING (precisa aprovação). False para EMAIL_DIRECT.',
  })
  requiresApproval: boolean;

  @ApiPropertyOptional({
    example: 'morador@email.com',
    nullable: true,
    description: 'Email pré-fixado quando o convite é EMAIL_DIRECT.',
  })
  email: string | null;

  @ApiPropertyOptional({
    type: [Object],
    description:
      'Unidades disponíveis para seleção quando o convite genérico não vem preso a uma unidade.',
  })
  units?: Array<{
    id: string;
    block: string;
    number: string;
  }>;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Unidade fixa quando o convite já foi criado para uma unidade específica.',
  })
  unitId?: string | null;
}
