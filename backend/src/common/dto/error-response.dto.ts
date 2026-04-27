import { ApiProperty } from '@nestjs/swagger';

/**
 * Envelope padrão para qualquer resposta de erro emitida pelo
 * `AllExceptionsFilter`. Mantém o contrato estável para clientes
 * (PWA + integrações) e serve de modelo Swagger reutilizável em
 * `@ApiBadRequestResponse({ type: ErrorResponseDto })` etc.
 */
export class ErrorResponseDto {
  @ApiProperty({
    example: 400,
    description: 'Código HTTP do erro retornado.',
  })
  statusCode!: number;

  @ApiProperty({
    example: 'Bad Request',
    description:
      'Identificador textual da família do erro (Nest HttpException).',
  })
  error!: string;

  @ApiProperty({
    example: 'O campo "cpf" é obrigatório.',
    description:
      'Mensagem em português voltada ao usuário final. Pode ser uma string única ou um array (ex.: validações DTO).',
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
  })
  message!: string | string[];

  @ApiProperty({
    example: '/api/v1/condominiums/abc123',
    description: 'Caminho da requisição que originou o erro.',
  })
  path!: string;

  @ApiProperty({
    example: '2026-04-25T20:21:00.000Z',
    description: 'Timestamp ISO-8601 do momento em que o erro foi capturado.',
  })
  timestamp!: string;

  @ApiProperty({
    example: '7c2f4c5a-8a1e-4d4a-9b9b-2a4f0e1f7a99',
    description:
      'Identificador único da requisição (correlation id). Útil para rastrear o erro nos logs.',
    required: false,
  })
  requestId?: string;
}
