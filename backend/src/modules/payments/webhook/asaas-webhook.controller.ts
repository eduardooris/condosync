import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Request } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'node:crypto';
import { Public } from '../../../common/decorators/public.decorator';
import { Throttle } from '@nestjs/throttler';
import { PaymentAccount } from '../../../database/entities/payment-account.entity';
import { PaymentWebhookEvent } from '../../../database/entities/payment-webhook-event.entity';
import { QUEUE_ASAAS_WEBHOOK } from '../../../queues/queue-names';
import { AsaasWebhookGuard } from './asaas-webhook.guard';

/**
 * Recebe callbacks da Asaas. Estratégia: **gravar + enfileirar + 200**.
 *
 *   1. Guard valida o `asaas-access-token` e injeta `req.paymentAccount`.
 *   2. Calcula `dedup_key = sha256(event + payment.id + payment.status + dateCreated)`.
 *   3. INSERT em `payment_webhook_events` com `orIgnore` na constraint UNIQUE.
 *      Resultado duplicado → tudo bem, devolve 200 (Asaas para de retentar).
 *   4. Enfileira na BullMQ pro processor cuidar do trabalho real.
 *   5. Responde 200 em <100ms — Asaas timeouta em 30s e retenta.
 *
 * Endpoint **público** (sem JWT). Auth via header `asaas-access-token`.
 */
@ApiExcludeController()
@Controller('integrations/asaas/webhook')
export class AsaasWebhookController {
  constructor(
    @InjectRepository(PaymentWebhookEvent)
    private readonly eventsRepo: Repository<PaymentWebhookEvent>,
    @InjectQueue(QUEUE_ASAAS_WEBHOOK)
    private readonly queue: Queue,
  ) {}

  /**
   * Health-check do endpoint — Asaas só faz POST, mas é útil pra você
   * abrir a URL no navegador / curl e confirmar que o caminho passa por
   * ngrok → backend → controller (em vez de 404 confuso).
   */
  @Public()
  @Get()
  @HttpCode(HttpStatus.OK)
  health(): { ok: true; expects: 'POST'; note: string } {
    return {
      ok: true,
      expects: 'POST',
      note: 'Endpoint operacional. Asaas envia POST com header asaas-access-token.',
    };
  }

  @Public()
  // Asaas chega em rajada quando há reconciliação massiva — 240 req/min é OK.
  @Throttle({ default: { limit: 240, ttl: 60_000 } })
  @UseGuards(AsaasWebhookGuard)
  @Post()
  @HttpCode(HttpStatus.OK)
  async receive(
    @Req() req: Request & { paymentAccount?: PaymentAccount },
    @Body()
    body: {
      event?: string;
      payment?: {
        id?: string;
        status?: string;
        dateCreated?: string;
      };
    },
  ): Promise<{ ok: true }> {
    const account = req.paymentAccount;
    if (!account || !body?.event) {
      // Guard já lança 401 quando token falha — esse `if` só protege
      // body malformado (event obrigatório no contrato Asaas).
      return { ok: true };
    }

    const payment = body.payment ?? {};
    const dedupKey = createHash('sha256')
      .update(
        [
          body.event,
          payment.id ?? '',
          payment.status ?? '',
          payment.dateCreated ?? '',
        ].join('|'),
      )
      .digest('hex');

    // INSERT com ON CONFLICT DO NOTHING — duplicatas devolvem 200 silenciosamente.
    // Cast em `payloadRaw` porque TypeORM exige `QueryDeepPartialEntity` mesmo
    // para `jsonb` (jsonb aceita qualquer JSON, mas o tipo TS é restritivo).
    const result = await this.eventsRepo
      .createQueryBuilder()
      .insert()
      .into(PaymentWebhookEvent)
      .values({
        paymentAccountId: account.id,
        event: body.event,
        asaasPaymentId: payment.id ?? null,
        dedupKey,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        payloadRaw: body as any,
      })
      .orIgnore()
      .returning(['id'])
      .execute();
    const inserted = result.raw?.[0]?.id as string | undefined;

    if (inserted) {
      // Enfileira só novos. Job carrega só o id local — processor lê do banco.
      await this.queue.add(
        'process',
        { eventId: inserted },
        { attempts: 5, backoff: { type: 'exponential', delay: 5_000 } },
      );
    }
    return { ok: true };
  }
}
