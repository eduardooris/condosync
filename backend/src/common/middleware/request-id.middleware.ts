import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Request, Response, NextFunction } from 'express';

export const REQUEST_ID_HEADER = 'x-request-id';

/**
 * Garante que toda requisição tenha um identificador único usado
 * em logs (`pino-http`) e no envelope `ErrorResponseDto`.
 *
 * - Reaproveita o header `x-request-id` se o proxy (nginx) já tiver
 *   atribuído (boa prática para correlacionar com logs do edge).
 * - Caso contrário gera um UUID v4.
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const incoming = req.headers[REQUEST_ID_HEADER];
    const id =
      typeof incoming === 'string' && incoming.trim().length > 0
        ? incoming
        : randomUUID();

    req.headers[REQUEST_ID_HEADER] = id;
    (req as Request & { id: string }).id = id;
    res.setHeader(REQUEST_ID_HEADER, id);
    next();
  }
}
