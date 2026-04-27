import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({
    description:
      'Token recebido no WhatsApp (parâmetro da URL de redefinição).',
    minLength: 32,
  })
  @IsString()
  @MinLength(32)
  token: string;

  @ApiProperty({ example: 'nova-senha-segura', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;
}
