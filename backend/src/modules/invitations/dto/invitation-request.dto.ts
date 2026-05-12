import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { UserRole } from '../../../common/enums';
import { InvitationType } from '../../../database/entities/condominium-invitation.entity';

export class CreateInvitationDto {
  @ApiProperty({ enum: InvitationType, example: InvitationType.EMAIL_DIRECT })
  @IsEnum(InvitationType)
  type: InvitationType;

  @ApiPropertyOptional({
    example: 'morador@email.com',
    description: 'Obrigatório quando `type=EMAIL_DIRECT`.',
  })
  @ValidateIf(
    (o: CreateInvitationDto) => o.type === InvitationType.EMAIL_DIRECT,
  )
  @IsEmail()
  email?: string;

  @ApiProperty({ enum: UserRole, example: UserRole.RESIDENT })
  @IsEnum(UserRole)
  role: UserRole;

  @ApiPropertyOptional({ example: '5b0e5b96-0dcb-4aab-8e2b-1c40b2b3e441' })
  @IsOptional()
  @IsUUID()
  unitId?: string;

  @ApiPropertyOptional({
    example: '98f997ef-20d7-4581-9ca8-a8248e5f0ca3',
    description:
      'ID do morador vinculado ao convite. Quando informado, exige `unitId` e o morador deve pertencer a essa unidade.',
  })
  @IsOptional()
  @IsUUID()
  residentId?: string;

  @ApiPropertyOptional({
    example: 72,
    description: 'Validade em horas. Default: 72h. Máx: 720h (30 dias).',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(720)
  expiresInHours?: number;

  @ApiPropertyOptional({
    example: 50,
    description:
      'Número máximo de aceites. Default: 1 para EMAIL_DIRECT, 50 para GENERIC_LINK.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  maxUses?: number;
}

export class AcceptInvitationDto {
  @ApiProperty({ example: 'João Silva' })
  @IsString()
  fullName: string;

  @ApiProperty({ example: 'senha-super-segura' })
  @IsString()
  password: string;

  @ApiPropertyOptional({
    example: 'morador@email.com',
    description:
      'Obrigatório quando o convite é GENERIC_LINK (email não vem fixado no convite).',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    example: '5b0e5b96-0dcb-4aab-8e2b-1c40b2b3e441',
    description:
      'Obrigatório quando o convite genérico não estiver preso a uma unidade específica.',
  })
  @IsOptional()
  @IsUUID()
  unitId?: string;

  @ApiPropertyOptional({
    example: '12345678901',
    description:
      'CPF do morador. Obrigatório em convites GENERIC_LINK (autocadastro).',
  })
  @IsOptional()
  @IsString()
  cpf?: string;

  @ApiPropertyOptional({
    example: '11987654321',
    description:
      'WhatsApp do morador (DDD + número). Obrigatório em convites GENERIC_LINK.',
  })
  @IsOptional()
  @IsString()
  phoneWhatsapp?: string;
}
