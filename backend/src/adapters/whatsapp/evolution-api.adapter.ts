import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IWhatsAppAdapter } from './whatsapp.adapter';

/**
 * Sentinel lançada quando as variáveis `EVOLUTION_*` não estão
 * configuradas. O processor captura para marcar o job como
 * `discarded` (em vez de "sucesso silencioso" — guia 6.1).
 */
export class WhatsappNotConfiguredError extends Error {
  constructor() {
    super('Evolution API não configurada (EVOLUTION_* ausentes).');
    this.name = 'WhatsappNotConfiguredError';
  }
}

@Injectable()
export class EvolutionApiAdapter implements IWhatsAppAdapter {
  private readonly logger = new Logger(EvolutionApiAdapter.name);

  constructor(
    private readonly config: ConfigService<Record<string, unknown>, true>,
  ) {}

  private timeoutMs(): number {
    return Number(
      this.config.get('EVOLUTION_TIMEOUT_MS', { infer: true }) ?? 10_000,
    );
  }

  private credentials() {
    const base = this.config.get<string>('EVOLUTION_API_URL');
    const key = this.config.get<string>('EVOLUTION_API_KEY');
    const instance = this.config.get<string>('EVOLUTION_INSTANCE');
    if (!base || !key || !instance) return null;
    return { base, key, instance };
  }

  private async post(
    url: string,
    apiKey: string,
    body: unknown,
  ): Promise<void> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs());
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: apiKey,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) {
        const text = await res.text();
        this.logger.error(`Evolution API erro ${res.status}: ${text}`);
        throw new BadGatewayException(
          `Falha de comunicação com WhatsApp (HTTP ${res.status}).`,
        );
      }
    } catch (err: unknown) {
      if (err instanceof BadGatewayException) throw err;
      const isAbort =
        err instanceof Error &&
        (err.name === 'AbortError' || err.message.includes('aborted'));
      if (isAbort) {
        this.logger.warn(
          `Evolution API timeout (${this.timeoutMs()}ms) para ${url}`,
        );
        throw new BadGatewayException(
          'Tempo esgotado ao chamar serviço de WhatsApp.',
        );
      }
      this.logger.error(
        `Falha inesperada chamando Evolution API: ${(err as Error).message}`,
      );
      throw new BadGatewayException(
        'Falha inesperada de comunicação com o WhatsApp.',
      );
    } finally {
      clearTimeout(timer);
    }
  }

  async sendMessage(to: string, message: string): Promise<void> {
    const creds = this.credentials();
    if (!creds) {
      this.logger.warn(
        `WhatsApp não configurado — descartando mensagem para ${to}`,
      );
      throw new WhatsappNotConfiguredError();
    }
    const url = `${creds.base.replace(/\/$/, '')}/message/sendText/${creds.instance}`;
    await this.post(url, creds.key, {
      number: to.replace(/\D/g, ''),
      text: message,
    });
  }

  async sendDocument(
    to: string,
    fileUrl: string,
    caption?: string,
  ): Promise<void> {
    const creds = this.credentials();
    if (!creds) {
      this.logger.warn(
        `WhatsApp não configurado — descartando documento para ${to}`,
      );
      throw new WhatsappNotConfiguredError();
    }
    const url = `${creds.base.replace(/\/$/, '')}/message/sendMedia/${creds.instance}`;
    await this.post(url, creds.key, {
      number: to.replace(/\D/g, ''),
      mediatype: 'document',
      media: fileUrl,
      caption: caption ?? '',
    });
  }
}
