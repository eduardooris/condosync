import { ApiProperty } from '@nestjs/swagger';

export class ResendWhatsappResponseDto {
  @ApiProperty({
    example: true,
    description: 'Indica se o job foi enfileirado com sucesso.',
  })
  enqueued: true;
}
