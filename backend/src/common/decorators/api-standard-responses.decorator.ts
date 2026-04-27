import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { ErrorResponseDto } from '../dto/error-response.dto';

export interface ApiStandardResponsesOptions {
  notFound?: boolean;
  conflict?: boolean;
  unprocessable?: boolean;
}

/**
 * Decorator composto: aplica Bearer auth + as respostas de erro
 * comuns a praticamente todos endpoints autenticados, todas
 * tipadas com `ErrorResponseDto`.
 */
export function ApiStandardResponses(
  options: ApiStandardResponsesOptions = {},
) {
  const decorators = [
    ApiBearerAuth('bearer'),
    ApiBadRequestResponse({
      description: 'Requisição inválida (validação DTO ou regra de negócio).',
      type: ErrorResponseDto,
    }),
    ApiUnauthorizedResponse({
      description: 'Token ausente, inválido ou expirado.',
      type: ErrorResponseDto,
    }),
    ApiForbiddenResponse({
      description: 'Sem permissão (papel insuficiente ou fora do condomínio).',
      type: ErrorResponseDto,
    }),
    ApiInternalServerErrorResponse({
      description: 'Erro inesperado no servidor.',
      type: ErrorResponseDto,
    }),
  ];

  if (options.notFound !== false) {
    decorators.push(
      ApiNotFoundResponse({
        description: 'Recurso não encontrado.',
        type: ErrorResponseDto,
      }),
    );
  }
  if (options.conflict) {
    decorators.push(
      ApiConflictResponse({
        description: 'Conflito de estado (ex.: violação de UNIQUE).',
        type: ErrorResponseDto,
      }),
    );
  }
  if (options.unprocessable) {
    decorators.push(
      ApiUnprocessableEntityResponse({
        description: 'Operação inválida no estado atual do recurso.',
        type: ErrorResponseDto,
      }),
    );
  }

  return applyDecorators(...decorators);
}
