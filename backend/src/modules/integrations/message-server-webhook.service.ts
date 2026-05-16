import { createHmac, timingSafeEqual } from 'crypto';
import {
  BadGatewayException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Env } from '../../config/env.schema';
import { MessageServerEvent } from '../../database/entities/message-server-event.entity';

type MessageServerEnvelope = {
  event_id: string;
  event_type: string;
  tenant_id?: string;
  payload: Record<string, unknown>;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@Injectable()
export class MessageServerWebhookService {
  private readonly logger = new Logger(MessageServerWebhookService.name);

  constructor(
    private readonly config: ConfigService<Env, true>,
    @InjectRepository(MessageServerEvent)
    private readonly eventsRepo: Repository<MessageServerEvent>,
  ) {}

  verifySignature(rawBody: string, signatureHeader: string | undefined): void {
    const secret = this.config.get('MESSAGE_SERVER_WEBHOOK_SECRET', {
      infer: true,
    });
    const isProd =
      this.config.get('NODE_ENV', { infer: true }) === 'production';
    if (!secret || secret.trim().length === 0) {
      if (isProd) {
        throw new UnauthorizedException(
          'MESSAGE_SERVER_WEBHOOK_SECRET não configurado.',
        );
      }
      return;
    }
    if (!signatureHeader) {
      throw new UnauthorizedException('Assinatura webhook ausente.');
    }

    const expected = this.sign(secret, rawBody);
    const received = Buffer.from(signatureHeader);
    const target = Buffer.from(expected);
    if (
      received.length !== target.length ||
      !timingSafeEqual(received, target)
    ) {
      throw new UnauthorizedException('Assinatura webhook inválida.');
    }
  }

  verifyBearer(authorizationHeader: string | undefined): void {
    const apiKey = this.config.get('MESSAGE_SERVER_API_KEY', { infer: true });
    const isProd =
      this.config.get('NODE_ENV', { infer: true }) === 'production';
    if (!apiKey || apiKey.trim().length === 0) {
      if (isProd) {
        throw new UnauthorizedException(
          'MESSAGE_SERVER_API_KEY não configurada.',
        );
      }
      return;
    }
    if (!authorizationHeader) {
      throw new UnauthorizedException('Authorization ausente.');
    }
    const normalized = authorizationHeader.trim();
    if (!normalized.toLowerCase().startsWith('bearer ')) {
      throw new UnauthorizedException('Authorization inválido.');
    }
    const token = normalized.slice(7).trim();
    if (token !== apiKey.trim()) {
      throw new UnauthorizedException('Token do webhook inválido.');
    }
  }

  async ingest(body: MessageServerEnvelope): Promise<{ duplicated: boolean }> {
    if (!body?.event_id || !body?.event_type || !body?.payload) {
      throw new Error('Envelope inválido do message-server.');
    }
    const exists = await this.eventsRepo.findOne({
      where: { eventId: body.event_id },
      select: ['id'],
    });
    if (exists) return { duplicated: true };

    const row = this.eventsRepo.create({
      eventId: body.event_id,
      eventType: body.event_type,
      tenantId: body.tenant_id ?? null,
      payload: body.payload,
    });
    await this.eventsRepo.save(row);
    this.logger.log(`Evento message-server recebido: ${body.event_type}`);
    return { duplicated: false };
  }

  async getLatestQRCode(options?: { newerThan?: Date }): Promise<{
    code: string;
    createdAt: Date;
    expiresAt?: string;
    instanceId?: string;
  }> {
    const qb = this.eventsRepo
      .createQueryBuilder('e')
      .where('e.eventType = :type', { type: 'instance.qrcode.updated' })
      .orderBy('e.createdAt', 'DESC')
      .limit(20);
    if (options?.newerThan) {
      qb.andWhere('e.createdAt > :ts', { ts: options.newerThan });
    }
    const rows = await qb.getMany();

    const now = Date.now();
    for (const row of rows) {
      const code = String(
        (row.payload?.code as string | undefined) ?? '',
      ).trim();
      if (!code) continue;
      const expiresAtStr =
        typeof row.payload?.expires_at === 'string'
          ? row.payload.expires_at
          : undefined;
      if (expiresAtStr) {
        const expiresAtMs = Date.parse(expiresAtStr);
        if (Number.isFinite(expiresAtMs) && expiresAtMs <= now) continue;
      }
      return {
        code,
        createdAt: row.createdAt,
        expiresAt: expiresAtStr,
        instanceId:
          typeof row.payload?.instance_id === 'string'
            ? row.payload.instance_id
            : undefined,
      };
    }

    throw new NotFoundException(
      'Nenhum QR code valido disponivel. Chame POST /qr/refresh para gerar um novo.',
    );
  }

  async getLatestQRCodeImageUrl(): Promise<{
    imageUrl: string;
    createdAt: Date;
    expiresAt?: string;
    instanceId?: string;
  }> {
    const latest = await this.getLatestQRCode();
    return {
      imageUrl: this.toQrImageUrl(latest.code),
      createdAt: latest.createdAt,
      expiresAt: latest.expiresAt,
      instanceId: latest.instanceId,
    };
  }

  /**
   * Resolve em uma única chamada o QR pronto para o operador escanear.
   *
   * Estratégia:
   *  1. Se já existe QR válido (não expirado) no histórico de eventos,
   *     devolve direto.
   *  2. Caso contrário, dispara um novo ciclo no message-server (cria
   *     instância ou reconecta) e faz polling curto aguardando o
   *     evento `instance.qrcode.updated` chegar via webhook.
   *  3. Se a instância já estiver pareada (CONNECTED), o message-server
   *     não vai produzir QR; nesse caso devolvemos `status: 'connected'`
   *     em vez de erro.
   */
  async getCurrentQR(): Promise<{
    status: 'ready' | 'connected';
    imageUrl?: string;
    code?: string;
    createdAt?: Date;
    expiresAt?: string;
    instanceId?: string;
  }> {
    try {
      const latest = await this.getLatestQRCode();
      return {
        status: 'ready',
        imageUrl: this.toQrImageUrl(latest.code),
        code: latest.code,
        createdAt: latest.createdAt,
        expiresAt: latest.expiresAt,
        instanceId: latest.instanceId,
      };
    } catch (err) {
      if (!(err instanceof NotFoundException)) throw err;
    }

    const refreshStartedAt = new Date();
    const refresh = await this.ensureInstanceAndTriggerQR();

    // Polling curto: webhook normalmente entrega em < 2s.
    const deadline = Date.now() + 8_000;
    while (Date.now() < deadline) {
      await sleep(500);
      try {
        const latest = await this.getLatestQRCode({
          newerThan: refreshStartedAt,
        });
        return {
          status: 'ready',
          imageUrl: this.toQrImageUrl(latest.code),
          code: latest.code,
          createdAt: latest.createdAt,
          expiresAt: latest.expiresAt,
          instanceId: latest.instanceId ?? refresh.instanceId,
        };
      } catch (err) {
        if (!(err instanceof NotFoundException)) throw err;
      }
    }

    // Sem QR após o polling. Pode significar que a instância já estava
    // pareada (não gera novo QR) — ou que o webhook ainda não entregou.
    // Devolvemos `connected` quando o reconnect retornou ok mas nenhum
    // QR apareceu, evitando travar o operador com erro genérico.
    if (refresh.status === 'reconnected') {
      return { status: 'connected', instanceId: refresh.instanceId };
    }
    throw new NotFoundException(
      'Nao foi possivel obter QR a tempo. Tente novamente em instantes.',
    );
  }

  private toQrImageUrl(code: string): string {
    return `https://api.qrserver.com/v1/create-qr-code/?size=360x360&data=${encodeURIComponent(code)}`;
  }

  async ensureInstanceAndTriggerQR(): Promise<{
    status: 'created' | 'reconnected';
    instanceId?: string;
  }> {
    const base = this.config
      .get('MESSAGE_SERVER_BASE_URL', { infer: true })
      .replace(/\/$/, '');
    const apiKey = this.config.get('MESSAGE_SERVER_API_KEY', { infer: true });
    const companyId = this.config.get('MESSAGE_SERVER_COMPANY_ID', {
      infer: true,
    });
    const instanceName = this.config.get('MESSAGE_SERVER_INSTANCE_NAME', {
      infer: true,
    });

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKey?.trim()) headers.Authorization = `Bearer ${apiKey.trim()}`;

    const createRes = await fetch(`${base}/v1/instances`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        company_id: companyId,
        name: instanceName,
      }),
    });

    if (createRes.ok) {
      const data = (await createRes.json().catch(() => ({}))) as {
        instance_id?: string;
      };
      return { status: 'created', instanceId: data.instance_id };
    }

    // Quando ja existe instancia para a empresa, reaproveita via reconnect:
    // recria a sessao whatsmeow em memoria e dispara um novo QR.
    if (createRes.status === 409) {
      const reconnectRes = await fetch(`${base}/v1/instances/reconnect`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ company_id: companyId }),
      });
      if (!reconnectRes.ok) {
        const text = await reconnectRes.text();
        throw new BadGatewayException(
          `Falha ao reconectar instancia (HTTP ${reconnectRes.status}): ${text}`,
        );
      }
      const data = (await reconnectRes.json().catch(() => ({}))) as {
        instance_id?: string;
      };
      return { status: 'reconnected', instanceId: data.instance_id };
    }

    const text = await createRes.text();
    throw new BadGatewayException(
      `Falha ao solicitar novo QR no message-server (HTTP ${createRes.status}): ${text}`,
    );
  }

  private sign(secret: string, rawBody: string): string {
    const mac = createHmac('sha256', secret);
    mac.update(rawBody);
    return `sha256=${mac.digest('hex')}`;
  }
}
