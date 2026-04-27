import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'novo.sindico@condosync.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'senha-super-segura' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({ example: 'João Silva' })
  @IsOptional()
  @IsString()
  fullName?: string;
}

export class RegisterResponseDto {
  @ApiProperty()
  userId: string;

  @ApiProperty()
  email: string;

  @ApiProperty({
    description:
      'Quando true, o provedor exigiu confirmação por e-mail; o cliente deve aguardar antes de tentar login.',
  })
  requiresEmailConfirmation: boolean;

  @ApiProperty({ nullable: true, type: String })
  accessToken: string | null;

  @ApiProperty({ nullable: true, type: String })
  refreshToken: string | null;
}

export class ForgotPasswordDto {
  @ApiProperty({
    example: 'sindico@condosync.com',
    description:
      'E-mail da conta. O link de redefinição será enviado ao WhatsApp cadastrado no perfil do morador vinculado.',
  })
  @IsEmail()
  email: string;
}

export class RefreshTokenDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.refresh...' })
  @IsString()
  @MinLength(10)
  refreshToken: string;
}
