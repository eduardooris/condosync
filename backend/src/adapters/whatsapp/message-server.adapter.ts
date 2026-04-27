import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '../../config/env.schema';
import { formatBrazilWhatsappForSending } from '../../common/utils/br-documents';
import { IWhatsAppAdapter } from './whatsapp.adapter';

@Injectable()
export class MessageServerAdapter implements IWhatsAppAdapter {
  private readonly logger = new Logger(MessageServerAdapter.name);
  private cachedInstanceId: string | null = null;

  constructor(private readonly config: ConfigService<Env, true>) {}

  private timeoutMs(): number {
    return Number(
      this.config.get('MESSAGE_SERVER_TIMEOUT_MS', { infer: true }) ?? 10_000,
    );
  }

  private baseUrl(): string {
    return (
      this.config.get('MESSAGE_SERVER_BASE_URL', { infer: true }) ??
      'http://localhost:8080'
    ).replace(/\/$/, '');
  }

  private apiKey(): string | undefined {
    const key = this.config.get('MESSAGE_SERVER_API_KEY', { infer: true });
    if (!key || key.trim().length === 0) return undefined;
    return key.trim();
  }

  private companyId(): string {
    return (
      this.config.get('MESSAGE_SERVER_COMPANY_ID', { infer: true }) ??
      'condosync'
    ).trim();
  }

  private instanceName(): string {
    return (
      this.config.get('MESSAGE_SERVER_INSTANCE_NAME', { infer: true }) ??
      'CondoSync'
    ).trim();
  }

  private staticInstanceId(): string | undefined {
    const v = this.config.get('MESSAGE_SERVER_INSTANCE_ID', { infer: true });
    if (!v || v.trim().length === 0) return undefined;
    return v.trim();
  }

  /**
   * Wrapper conveniente para `postRaw` que mapeia respostas != 2xx em
   * `BadGatewayException`. Use `postRaw` quando precisar inspecionar
   * o status da resposta (ex.: tratar 409 como sinal de "já existe").
   */
  private async post(path: string, body: unknown): Promise<Response> {
    const res = await this.postRaw(path, body);
    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`message-server erro ${res.status}: ${text}`);
      throw new BadGatewayException(
        `Falha de comunicação com message-server (HTTP ${res.status}).`,
      );
    }
    return res;
  }

  private async postRaw(path: string, body: unknown): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs());
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      const key = this.apiKey();
      if (key) {
        headers.Authorization = `Bearer ${key}`;
      }
      return await fetch(`${this.baseUrl()}${path}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err: unknown) {
      const isAbort =
        err instanceof Error &&
        (err.name === 'AbortError' || err.message.includes('aborted'));
      if (isAbort) {
        this.logger.warn(
          `message-server timeout (${this.timeoutMs()}ms) em ${path}`,
        );
        throw new BadGatewayException('Tempo esgotado no serviço de WhatsApp.');
      }
      this.logger.error(
        `Falha inesperada chamando message-server: ${(err as Error).message}`,
      );
      throw new BadGatewayException(
        'Falha inesperada de comunicação com o WhatsApp.',
      );
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Resolve (e cacheia) o `instance_id` para a empresa atual.
   *
   * Ordem de preferência:
   *  1. `MESSAGE_SERVER_INSTANCE_ID` se configurado explicitamente.
   *  2. Cache em memória da última resolução bem-sucedida.
   *  3. Tenta `POST /v1/instances`. Se vier 409 (já existe) faz
   *     fallback em `POST /v1/instances/reconnect` que devolve o
   *     `instance_id` da instância existente — cobre o caso real
   *     em que a empresa só pode ter uma instância ativa.
   */
  private async ensureInstance(): Promise<string> {
    const explicit = this.staticInstanceId();
    if (explicit) return explicit;
    if (this.cachedInstanceId) return this.cachedInstanceId;

    const createRes = await this.postRaw('/v1/instances', {
      company_id: this.companyId(),
      name: this.instanceName(),
    });

    if (createRes.ok) {
      const data = (await createRes.json()) as { instance_id?: string };
      if (!data?.instance_id) {
        throw new BadGatewayException(
          'Resposta inválida do message-server ao criar instância.',
        );
      }
      this.cachedInstanceId = data.instance_id;
      return data.instance_id;
    }

    if (createRes.status === 409) {
      this.logger.log(
        'Instância já existe para a empresa — resolvendo via /v1/instances/reconnect.',
      );
      const reconnect = await this.post('/v1/instances/reconnect', {
        company_id: this.companyId(),
      });
      const data = (await reconnect.json()) as { instance_id?: string };
      if (!data?.instance_id) {
        throw new BadGatewayException(
          'Resposta inválida do message-server ao reconectar instância.',
        );
      }
      this.cachedInstanceId = data.instance_id;
      return data.instance_id;
    }

    const text = await createRes.text();
    this.logger.error(`message-server erro ${createRes.status}: ${text}`);
    throw new BadGatewayException(
      `Falha ao resolver instância no message-server (HTTP ${createRes.status}).`,
    );
  }

  async sendMessage(to: string, message: string): Promise<void> {
    const instanceId = await this.ensureInstance();
    const normalized = formatBrazilWhatsappForSending(to);
    await this.post('/v1/messages/text', {
      instance_id: instanceId,
      to: normalized,
      body: message,
    });
  }

  async sendDocument(
    to: string,
    fileUrl: string,
    caption?: string,
  ): Promise<void> {
    const body = caption?.trim()
      ? `${caption.trim()}\n${fileUrl}`
      : `Documento: ${fileUrl}`;
    await this.sendMessage(to, body);
  }
}
