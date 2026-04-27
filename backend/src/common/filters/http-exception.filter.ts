import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { QueryFailedError, EntityNotFoundError, TypeORMError } from 'typeorm';
import { REQUEST_ID_HEADER } from '../middleware/request-id.middleware';

interface NormalizedError {
  status: number;
  message: string | string[];
  error: string;
}

/**
 * Filtro global de exceções.
 *
 * Responsabilidades:
 * - Padroniza o envelope de resposta (`ErrorResponseDto`).
 * - Traduz erros do TypeORM em códigos HTTP semânticos.
 * - Encapsula erros de adapters externos (Keycloak/S3/Evolution)
 *   em `502 Bad Gateway` quando vazam para a camada HTTP.
 * - Logs estruturados com `requestId` para correlação.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const requestId =
      (request.headers[REQUEST_ID_HEADER] as string | undefined) ??
      (request as Request & { id?: string }).id;

    const normalized = this.normalize(exception);

    if (normalized.status >= 500) {
      this.logger.error(
        `[${requestId ?? '-'}] ${request.method} ${request.url} -> ${normalized.status} ${normalized.error}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else if (normalized.status >= 400) {
      this.logger.warn(
        `[${requestId ?? '-'}] ${request.method} ${request.url} -> ${normalized.status} ${normalized.error}`,
      );
    }

    response.status(normalized.status).json({
      statusCode: normalized.status,
      error: normalized.error,
      message: normalized.message,
      path: request.url,
      timestamp: new Date().toISOString(),
      requestId,
    });
  }

  // ----------------------------------------------------------------------
  // Normalização por tipo de exceção
  // ----------------------------------------------------------------------

  private normalize(exception: unknown): NormalizedError {
    if (exception instanceof HttpException) {
      return this.fromHttpException(exception);
    }

    if (exception instanceof QueryFailedError) {
      return this.fromQueryFailed(exception);
    }

    if (exception instanceof EntityNotFoundError) {
      return {
        status: HttpStatus.NOT_FOUND,
        error: 'Not Found',
        message: 'Registro não encontrado.',
      };
    }

    if (exception instanceof TypeORMError) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        error: 'Database Error',
        message: 'Falha ao acessar a base de dados.',
      };
    }

    if (this.looksLikeFetchError(exception)) {
      return {
        status: HttpStatus.BAD_GATEWAY,
        error: 'Bad Gateway',
        message: 'Falha de comunicação com serviço externo.',
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      message: 'Erro interno do servidor.',
    };
  }

  private fromHttpException(exception: HttpException): NormalizedError {
    const status = exception.getStatus();
    const raw = exception.getResponse();
    const errorName = this.statusToErrorName(status);

    if (typeof raw === 'string') {
      return { status, error: errorName, message: raw };
    }

    if (raw && typeof raw === 'object') {
      const body = raw as { message?: string | string[]; error?: string };
      return {
        status,
        error: body.error ?? errorName,
        message: body.message ?? exception.message,
      };
    }

    return { status, error: errorName, message: exception.message };
  }

  /**
   * Mapeia códigos do PostgreSQL para HTTP.
   * Ref.: https://www.postgresql.org/docs/current/errcodes-appendix.html
   */
  private fromQueryFailed(error: QueryFailedError): NormalizedError {
    const driverError = error as QueryFailedError & {
      code?: string;
      detail?: string;
      constraint?: string;
    };
    const code = driverError.code;

    switch (code) {
      case '23505': // unique_violation
        return {
          status: HttpStatus.CONFLICT,
          error: 'Conflict',
          message: this.formatUniqueViolation(driverError),
        };
      case '23503': // foreign_key_violation
        return {
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          error: 'Unprocessable Entity',
          message:
            'Operação inválida: registro relacionado não encontrado ou em uso.',
        };
      case '23502': // not_null_violation
        return {
          status: HttpStatus.BAD_REQUEST,
          error: 'Bad Request',
          message: 'Campo obrigatório ausente.',
        };
      case '22001': // string_data_right_truncation
        return {
          status: HttpStatus.BAD_REQUEST,
          error: 'Bad Request',
          message: 'Valor maior que o tamanho permitido.',
        };
      case '22P02': // invalid_text_representation
        return {
          status: HttpStatus.BAD_REQUEST,
          error: 'Bad Request',
          message: 'Formato de valor inválido.',
        };
      case '23514': // check_violation
        return {
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          error: 'Unprocessable Entity',
          message: 'Restrição de integridade violada.',
        };
      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          error: 'Database Error',
          message: 'Falha ao executar operação no banco de dados.',
        };
    }
  }

  private formatUniqueViolation(
    err: QueryFailedError & { constraint?: string; detail?: string },
  ): string {
    if (err.constraint) {
      return `Já existe um registro com os mesmos valores (${err.constraint}).`;
    }
    return 'Já existe um registro com esses valores.';
  }

  private statusToErrorName(status: number): string {
    switch (status) {
      case 400:
        return 'Bad Request';
      case 401:
        return 'Unauthorized';
      case 403:
        return 'Forbidden';
      case 404:
        return 'Not Found';
      case 409:
        return 'Conflict';
      case 422:
        return 'Unprocessable Entity';
      case 429:
        return 'Too Many Requests';
      case 502:
        return 'Bad Gateway';
      case 503:
        return 'Service Unavailable';
      default:
        return status >= 500 ? 'Internal Server Error' : 'Error';
    }
  }

  /**
   * Heurística para detectar erros de fetch/HTTP cliente que escaparam
   * de adapters externos sem tratamento próprio (S3, Evolution etc.).
   */
  private looksLikeFetchError(exception: unknown): boolean {
    if (!(exception instanceof Error)) return false;
    const name = exception.name?.toLowerCase() ?? '';
    const message = exception.message?.toLowerCase() ?? '';
    return (
      name.includes('fetch') ||
      name === 'aborterror' ||
      message.includes('fetch failed') ||
      message.includes('econnrefused') ||
      message.includes('etimedout')
    );
  }
}
