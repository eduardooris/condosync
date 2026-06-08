import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  DevicePlatform,
  IntercomSessionStatus,
  IntercomSessionUpdateReason,
} from '../../../../common/enums';

export class PortariaUnitDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  block: string;

  @ApiProperty()
  number: string;

  @ApiProperty({ example: 'Bloco A · 101' })
  label: string;
}

export class CreateIntercomSessionDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  unitId: string;

  @ApiProperty({ minLength: 2, maxLength: 80 })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  visitorName: string;
}

export class IceServerDto {
  @ApiProperty({ isArray: true, type: String })
  urls: string | string[];

  @ApiPropertyOptional()
  username?: string;

  @ApiPropertyOptional()
  credential?: string;
}

export class IntercomWebRtcConfigDto {
  @ApiProperty({ type: IceServerDto, isArray: true })
  iceServers: IceServerDto[];
}

export class CreateIntercomSessionResponseDto {
  @ApiProperty({ format: 'uuid' })
  sessionId: string;

  @ApiProperty({
    description: 'JWT de curta duração para WebSocket e cancelamento.',
  })
  guestWsToken: string;

  @ApiProperty({
    example: 'http://localhost:3000/intercom',
    description: 'Namespace Socket.IO do interfone.',
  })
  wsUrl: string;

  @ApiProperty({ type: IceServerDto, isArray: true })
  iceServers: IceServerDto[];

  @ApiProperty()
  ringExpiresAt: Date;

  @ApiProperty({ enum: IntercomSessionStatus })
  status: IntercomSessionStatus;
}

export class IntercomSessionStatusDto {
  @ApiProperty({ format: 'uuid' })
  sessionId: string;

  @ApiProperty({ enum: IntercomSessionStatus })
  status: IntercomSessionStatus;

  @ApiPropertyOptional({ enum: IntercomSessionUpdateReason })
  reason?: IntercomSessionUpdateReason;

  @ApiPropertyOptional()
  endedAt?: Date | null;
}

export class CreateIntercomAccessTokenDto {
  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;
}

export class IntercomAccessTokenResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({
    description:
      'Token bruto — exibido apenas na criação. Use na URL /portaria/:token',
  })
  accessToken: string;

  @ApiProperty({
    example: 'http://localhost:5173/portaria/abc123',
  })
  portariaUrl: string;

  @ApiPropertyOptional()
  label?: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiPropertyOptional()
  revokedAt?: Date | null;
}

export class IntercomAccessTokenListItemDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiPropertyOptional()
  label?: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiPropertyOptional()
  revokedAt?: Date | null;

  @ApiProperty({
    description:
      'Indica se o link/QR pode ser exibido novamente (tokens criados após suporte a consulta).',
  })
  canRevealLink: boolean;
}

export class IntercomAccessTokenDetailDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiPropertyOptional()
  label?: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiPropertyOptional()
  revokedAt?: Date | null;

  @ApiProperty({
    example: 'http://localhost:5173/portaria/abc123',
    description:
      'Ausente se o token foi criado antes do armazenamento consultável ou se revogado.',
  })
  portariaUrl?: string | null;
}

export class RegisterDeviceDto {
  @ApiProperty({ maxLength: 128 })
  @IsString()
  @MaxLength(128)
  deviceId: string;

  @ApiProperty({ enum: DevicePlatform })
  @IsEnum(DevicePlatform)
  platform: DevicePlatform;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(512)
  pushToken?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  residentId?: string;
}

export class RegisterDeviceResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  deviceId: string;

  @ApiProperty({ enum: DevicePlatform })
  platform: DevicePlatform;
}

export class IntercomSessionHistoryItemDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  visitorName: string;

  @ApiProperty({ format: 'uuid' })
  unitId: string;

  @ApiProperty({ example: 'Bloco A · 101' })
  unitLabel: string;

  @ApiProperty({ enum: IntercomSessionStatus })
  status: IntercomSessionStatus;

  @ApiPropertyOptional({ description: 'Nome do morador que atendeu.' })
  answeredByName?: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiPropertyOptional()
  endedAt?: Date | null;
}

export class CancelIntercomSessionDto {
  @ApiProperty({
    description: 'JWT guest retornado ao criar a sessão.',
  })
  @IsString()
  guestWsToken: string;
}

export class EndIntercomSessionDto {
  @ApiPropertyOptional({
    description: 'Obrigatório quando o visitante encerra via API pública.',
  })
  @IsOptional()
  @IsString()
  guestWsToken?: string;
}
