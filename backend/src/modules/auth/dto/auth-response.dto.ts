import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoginResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken: string;

  @ApiProperty({ example: 'b9c6f0a1-e7c3-4a1f-8c5e-6f9c2c2d3a01' })
  refreshToken: string;
}

export class MeResponseDto {
  @ApiProperty({ example: 'd1a6ee0d-8b86-4c36-bbe2-066d88f5d886' })
  id: string;

  @ApiProperty({ example: 'sindico@condosync.com' })
  email: string;

  @ApiPropertyOptional({ example: 'Eduardo Oris', nullable: true })
  fullName: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'WhatsApp da conta (redefinição de senha). Pode ser null se só o morador tiver número.',
    example: '11987654321',
  })
  phoneWhatsapp?: string | null;

  @ApiProperty({ example: '2026-01-10T13:42:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-04-22T11:00:00.000Z' })
  updatedAt: Date;
}
