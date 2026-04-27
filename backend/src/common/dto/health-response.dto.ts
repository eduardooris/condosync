import { ApiProperty } from '@nestjs/swagger';

export class HealthResponseDto {
  @ApiProperty({ example: 'ok' })
  status: string;

  @ApiProperty({
    example: { database: 'ok', redis: 'ok' },
    required: false,
    description: 'Estado resumido das dependências na probe de readiness.',
  })
  checks?: Record<string, 'ok' | 'unavailable'>;
}
