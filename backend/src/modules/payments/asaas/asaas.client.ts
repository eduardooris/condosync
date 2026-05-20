import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Env } from '../../../config/env.schema';
import {
  AsaasErrorResponse,
  AsaasCreateAccountInput,
  AsaasCreateAccountResponse,
  AsaasAccountStatusResponse,
  AsaasListAccountsResponse,
  AsaasOnboardingLinkResponse,
  AsaasCreateCustomerInput,
  AsaasCustomerResponse,
  AsaasCreatePaymentInput,
  AsaasPaymentResponse,
  AsaasPixQrCodeResponse,
  AsaasCreateWebhookInput,
  AsaasWebhookResponse,
  AsaasWebhookListResponse,
} from './asaas.types';
import {
  asaasAuthFailed,
  asaasCpfCnpjInUse,
  asaasDuplicate,
  asaasForbidden,
  asaasNotConfigured,
  asaasUpstreamError,
  asaasUpstreamTimeout,
  asaasValidation,
} from './asaas.errors';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

interface RequestOptions {
  /** Sobrescreve a apiKey master — usado para chamar na conta de uma subconta. */
  apiKey?: string;
  /** Body JSON (qualquer objeto serializável). */
  body?: unknown;
  /** Querystring shallow. Valores `undefined`/`null` são removidos. */
  query?: Record<string, string | number | boolean | undefined | null>;
}

/**
 * Cliente HTTP de baixo nível para a Asaas API v3.
 *
 * Princípios de design:
 *
 *   • **Stateless** — não cacheia subconta nem token. O caller passa `apiKey`
 *     resolvida (master ou subconta) a cada request. Isso simplifica testes
 *     e elimina riscos de "vazar" key da subconta A na subconta B.
 *   • **Retry só em 5xx/timeout** — backoff exponencial com jitter.
 *     4xx (validação, auth, duplicate) não retrya — apenas mapeia para
 *     exception de domínio (`asaas.errors.ts`).
 *   • **Logs sanitizados** — masking de cpfCnpj e nunca loga apiKey.
 *   • **AbortSignal** — usa AbortController nativo para timeout determinístico.
 */
@Injectable()
export class AsaasClient implements OnModuleInit {
  private baseUrl!: string;
  private masterApiKey: string | null = null;
  private timeoutMs!: number;
  private retryMax!: number;
  private enabled!: boolean;

  constructor(
    private readonly config: ConfigService<Env, true>,
    @InjectPinoLogger(AsaasClient.name)
    private readonly logger: PinoLogger,
  ) {}

  onModuleInit(): void {
    this.baseUrl = this.config
      .get('ASAAS_API_BASE_URL', { infer: true })
      .replace(/\/$/, '');
    this.masterApiKey =
      this.config.get('ASAAS_MASTER_API_KEY', { infer: true }) ?? null;
    this.timeoutMs = this.config.get('ASAAS_REQUEST_TIMEOUT_MS', {
      infer: true,
    });
    this.retryMax = this.config.get('ASAAS_RETRY_MAX', { infer: true });
    this.enabled = this.config.get('ASAAS_ACCOUNTS_ENABLED', { infer: true });

    if (this.enabled) {
      const asaasEnv = this.config.get('ASAAS_ENV', { infer: true });
      const keyHint = this.masterApiKey?.includes('_hmlg_')
        ? 'sandbox'
        : 'production';
      this.logger.info(
        { asaasEnv, baseUrl: this.baseUrl, keyHint },
        'asaas.client inicializado',
      );
    }
  }

  // ── Subcontas ───────────────────────────────────────────────────────────

  /** `POST /accounts` — cria uma subconta. Usa a apiKey **master**. */
  createSubaccount(
    input: AsaasCreateAccountInput,
  ): Promise<AsaasCreateAccountResponse> {
    return this.request<AsaasCreateAccountResponse>('POST', '/accounts', {
      body: input,
    });
  }

  /** `GET /accounts/:id` — status de aprovação. Usa a master. */
  getAccountStatus(id: string): Promise<AsaasAccountStatusResponse> {
    return this.request<AsaasAccountStatusResponse>(
      'GET',
      `/accounts/${id}`,
      {},
    );
  }

  /**
   * `GET /accounts` — lista subcontas da master, com filtros opcionais.
   * Usado para pré-checar duplicidade de `cpfCnpj` antes de criar uma nova.
   * Limite default da Asaas é 10 — passamos 1 (só queremos saber se existe).
   */
  listSubaccounts(
    filter: { cpfCnpj?: string; email?: string; limit?: number } = {},
  ): Promise<AsaasListAccountsResponse> {
    return this.request<AsaasListAccountsResponse>('GET', '/accounts', {
      query: {
        cpfCnpj: filter.cpfCnpj,
        email: filter.email,
        limit: filter.limit ?? 1,
      },
    });
  }

  /**
   * `GET /myAccount/onboardingLink` — chamado COM a apiKey da subconta.
   * Devolve URL temporária para o titular enviar docs (válida ~horas).
   */
  getOnboardingLink(apiKey: string): Promise<AsaasOnboardingLinkResponse> {
    return this.request<AsaasOnboardingLinkResponse>(
      'GET',
      '/myAccount/onboardingLink',
      { apiKey },
    );
  }

  // ── Customers (na subconta) ─────────────────────────────────────────────

  createCustomer(
    apiKey: string,
    input: AsaasCreateCustomerInput,
  ): Promise<AsaasCustomerResponse> {
    return this.request<AsaasCustomerResponse>('POST', '/customers', {
      apiKey,
      body: input,
    });
  }

  // ── Cobranças (na subconta) ─────────────────────────────────────────────

  createPayment(
    apiKey: string,
    input: AsaasCreatePaymentInput,
  ): Promise<AsaasPaymentResponse> {
    return this.request<AsaasPaymentResponse>('POST', '/payments', {
      apiKey,
      body: input,
    });
  }

  getPayment(apiKey: string, paymentId: string): Promise<AsaasPaymentResponse> {
    return this.request<AsaasPaymentResponse>(
      'GET',
      `/payments/${paymentId}`,
      { apiKey },
    );
  }

  getPixQrCode(
    apiKey: string,
    paymentId: string,
  ): Promise<AsaasPixQrCodeResponse> {
    return this.request<AsaasPixQrCodeResponse>(
      'GET',
      `/payments/${paymentId}/pixQrCode`,
      { apiKey },
    );
  }

  deletePayment(apiKey: string, paymentId: string): Promise<{ deleted: true }> {
    return this.request<{ deleted: true }>(
      'DELETE',
      `/payments/${paymentId}`,
      { apiKey },
    );
  }

  // ── Webhooks (na subconta) ──────────────────────────────────────────────

  createWebhook(
    apiKey: string,
    input: AsaasCreateWebhookInput,
  ): Promise<AsaasWebhookResponse> {
    return this.request<AsaasWebhookResponse>('POST', '/webhooks', {
      apiKey,
      body: input,
    });
  }

  /** Lista todos os webhooks registrados pela subconta (debug/audit). */
  listWebhooks(apiKey: string): Promise<AsaasWebhookListResponse> {
    return this.request<AsaasWebhookListResponse>('GET', '/webhooks', {
      apiKey,
      query: { limit: 100 },
    });
  }

  /** Remove um webhook pelo id (`whk_xxx`). Idempotente do lado do cliente. */
  deleteWebhook(apiKey: string, webhookId: string): Promise<{ deleted: true }> {
    return this.request<{ deleted: true }>(
      'DELETE',
      `/webhooks/${webhookId}`,
      { apiKey },
    );
  }

  // ── Pagamentos "fora do gateway" — recebimentos manuais ─────────────────

  /**
   * Marca um pagamento como recebido em dinheiro. Aciona o evento
   * `PAYMENT_RECEIVED_IN_CASH` no webhook configurado da subconta.
   */
  receivePaymentInCash(
    apiKey: string,
    paymentId: string,
    body: { paymentDate: string; value: number; notifyCustomer?: boolean },
  ): Promise<AsaasPaymentResponse> {
    return this.request<AsaasPaymentResponse>(
      'POST',
      `/payments/${paymentId}/receiveInCash`,
      { apiKey, body },
    );
  }

  /** Reverte um `receiveInCash`. Aciona `PAYMENT_RECEIVED_IN_CASH_UNDONE`. */
  undoReceivePaymentInCash(
    apiKey: string,
    paymentId: string,
  ): Promise<AsaasPaymentResponse> {
    return this.request<AsaasPaymentResponse>(
      'POST',
      `/payments/${paymentId}/undoReceivedInCash`,
      { apiKey },
    );
  }

  /**
   * Paga uma cobrança com cartão (em sandbox, aceita cartões de teste do Asaas).
   * Dispara `PAYMENT_CONFIRMED` + `PAYMENT_RECEIVED` (eventualmente PAYMENT_OVERDUE
   * desabilitado). Em produção, é só pra testes — flows reais devem usar o
   * Checkout hospedado.
   */
  payWithCreditCard(
    apiKey: string,
    paymentId: string,
    body: {
      creditCard: {
        holderName: string;
        number: string;
        expiryMonth: string;
        expiryYear: string;
        ccv: string;
      };
      creditCardHolderInfo: {
        name: string;
        email: string;
        cpfCnpj: string;
        postalCode: string;
        addressNumber: string;
        phone?: string;
      };
      remoteIp?: string;
    },
  ): Promise<AsaasPaymentResponse> {
    return this.request<AsaasPaymentResponse>(
      'POST',
      `/payments/${paymentId}/payWithCreditCard`,
      { apiKey, body },
    );
  }

  /**
   * Endpoint **sandbox-only** que confirma um pagamento Pix sem precisar de
   * Pix real. Dispara o webhook `PAYMENT_CONFIRMED` + `PAYMENT_RECEIVED`
   * com `billingType: "PIX"` e `transactionReceiptUrl` válido — exatamente
   * como aconteceria em produção quando o cliente paga o QR.
   *
   * Não está na doc pública mas é o caminho oficial pra simular Pix em dev.
   */
  confirmPaymentInSandbox(
    apiKey: string,
    paymentId: string,
  ): Promise<AsaasPaymentResponse> {
    return this.request<AsaasPaymentResponse>(
      'POST',
      `/sandbox/payment/${paymentId}/confirm`,
      { apiKey },
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Internas
  // ─────────────────────────────────────────────────────────────────────────

  private async request<T>(
    method: HttpMethod,
    path: string,
    options: RequestOptions,
  ): Promise<T> {
    if (!this.enabled) {
      throw asaasNotConfigured();
    }
    const apiKey = options.apiKey ?? this.masterApiKey;
    if (!apiKey) {
      throw asaasNotConfigured();
    }

    const qs = this.buildQuery(options.query);
    const url = `${this.baseUrl}${path}${qs}`;
    const init: RequestInit & { signal?: AbortSignal } = {
      method,
      headers: {
        access_token: apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': 'condosync-backend/1.0',
      },
    };
    if (options.body !== undefined) {
      init.body = JSON.stringify(options.body);
    }

    let lastErr: unknown = null;
    for (let attempt = 0; attempt <= this.retryMax; attempt += 1) {
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), this.timeoutMs);
      try {
        const resp = await fetch(url, { ...init, signal: ac.signal });
        clearTimeout(timer);
        // 2xx → sucesso direto.
        if (resp.ok) {
          // `DELETE` da Asaas devolve `{deleted, id}`. `204` (sem corpo) também
          // existe em alguns endpoints — tratar.
          if (resp.status === 204) return undefined as T;
          return (await resp.json()) as T;
        }
        // 5xx → retry com backoff.
        if (resp.status >= 500 && attempt < this.retryMax) {
          await this.backoff(attempt);
          continue;
        }
        // 4xx → mapeia para exception (não retrya).
        const body = await this.safeJson(resp);
        throw this.mapHttpError(resp.status, body, method, path);
      } catch (err) {
        clearTimeout(timer);
        // Timeout do AbortController → retry se ainda houver tentativa.
        if (this.isAbortError(err)) {
          this.logger.warn(
            { method, path, attempt },
            'asaas.timeout — retrying',
          );
          if (attempt < this.retryMax) {
            await this.backoff(attempt);
            continue;
          }
          throw asaasUpstreamTimeout();
        }
        // Outros erros lançados pelo `mapHttpError` ou rede: re-throw.
        lastErr = err;
        throw err;
      }
    }
    // Nunca devia chegar aqui — mas TS pede um throw explícito.
    throw lastErr instanceof Error
      ? lastErr
      : asaasUpstreamError('Asaas retry exhausted');
  }

  private mapHttpError(
    status: number,
    body: AsaasErrorResponse | string | null,
    method: HttpMethod,
    path: string,
  ): Error {
    this.logger.warn(
      { method, path, status, asaas_body: body },
      'asaas.4xx',
    );
    if (status === 401) return asaasAuthFailed();
    if (status === 403) return asaasForbidden(body);
    if (status === 409) return asaasDuplicate();
    if (
      status === 400 ||
      status === 422 ||
      status === 404 /* /payments/:id de outro tenant */
    ) {
      if (body && typeof body === 'object' && 'errors' in body) {
        // Inspeção do envelope Asaas para reclassificar casos comuns. A
        // própria Asaas usa o mesmo status 422 para diversos motivos —
        // separamos os mais úteis para UX.
        if (this.isCpfCnpjInUseError(body)) {
          return asaasCpfCnpjInUse(body);
        }
        return asaasValidation(body);
      }
      return asaasUpstreamError(body ?? 'asaas bad request');
    }
    return asaasUpstreamError(body ?? `asaas http ${status}`);
  }

  /**
   * O Asaas retorna o erro de CPF/CNPJ duplicado com `code` que varia
   * (`invalid_cpfCnpj`, `existingCpfCnpj`...) — fazemos match pelo texto
   * da `description` que é estável: contém "CPF" + "uso" (PT-BR).
   */
  private isCpfCnpjInUseError(body: AsaasErrorResponse): boolean {
    return body.errors.some((e) => {
      const desc = (e.description ?? '').toLowerCase();
      return (
        desc.includes('cpf') &&
        (desc.includes('em uso') ||
          desc.includes('já existe') ||
          desc.includes('ja existe') ||
          desc.includes('cadastrado'))
      );
    });
  }

  private async safeJson(
    resp: Response,
  ): Promise<AsaasErrorResponse | string | null> {
    try {
      const text = await resp.text();
      if (!text) return null;
      try {
        return JSON.parse(text) as AsaasErrorResponse;
      } catch {
        return text;
      }
    } catch {
      return null;
    }
  }

  private backoff(attempt: number): Promise<void> {
    // 200ms, 600ms, 1.8s (com jitter ±30%).
    const base = 200 * 3 ** attempt;
    const jitter = base * 0.3 * (Math.random() * 2 - 1);
    const wait = Math.max(50, Math.floor(base + jitter));
    return new Promise((r) => setTimeout(r, wait));
  }

  private isAbortError(err: unknown): boolean {
    return (
      err instanceof Error &&
      (err.name === 'AbortError' || err.name === 'TimeoutError')
    );
  }

  private buildQuery(
    params: RequestOptions['query'],
  ): string {
    if (!params) return '';
    const usp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null || v === '') continue;
      usp.set(k, String(v));
    }
    const s = usp.toString();
    return s ? `?${s}` : '';
  }
}
