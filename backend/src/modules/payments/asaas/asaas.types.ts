/**
 * Tipos espelhando os payloads/responses da Asaas API v3 que usamos.
 *
 * Cobertura intencionalmente parcial — só os campos que de fato lemos/usamos.
 * Para o catálogo completo, ver https://docs.asaas.com/reference/.
 */

// ── Subcontas (`POST /accounts`) ────────────────────────────────────────────

export type AsaasPersonType = 'FISICA' | 'JURIDICA';

export interface AsaasCreateAccountInput {
  /** Razão social (PJ) ou nome completo (PF/MEI). */
  name: string;
  email: string;
  /** Só dígitos (Asaas remove máscara automaticamente, mas mandamos limpo). */
  cpfCnpj: string;
  /** Formato sem máscara, com DDI (`55` + DDD + número). */
  mobilePhone: string;
  /** Obrigatório desde 30/mai/2024 — renda mensal (PF) ou faturamento (PJ). */
  incomeValue: number;
  birthDate?: string;
  address: string;
  addressNumber: string;
  complement?: string;
  province: string;
  postalCode: string;
}

export interface AsaasCreateAccountResponse {
  id: string;
  /** Pública. Usada para split. */
  walletId: string;
  /** Sensível. Mostrada **uma única vez** — guardar imediatamente. */
  apiKey: string;
  name: string;
  email: string;
  cpfCnpj: string;
  /** Acesso ao painel/onboarding. */
  loginEmail?: string;
}

export type AsaasAccountApprovalStatus =
  | 'PENDING'
  | 'AWAITING_DOCUMENTS'
  | 'AWAITING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED';

export interface AsaasAccountStatusResponse {
  id: string;
  commercialInfo: AsaasAccountApprovalStatus;
  bankAccountInfo: AsaasAccountApprovalStatus;
  documentation: AsaasAccountApprovalStatus;
  general: AsaasAccountApprovalStatus;
  rejectReason?: string | null;
}

/**
 * `GET /myAccount/onboardingLink` — chamada COM a apiKey da subconta.
 * Retorna URL temporária para o titular enviar documentos (KYC).
 */
export interface AsaasOnboardingLinkResponse {
  url: string;
}

/**
 * `GET /accounts` (master apiKey) — listagem paginada das subcontas
 * vinculadas a esta conta master. Aceita filtros por `cpfCnpj`, `email`,
 * `name`, paginação `offset`/`limit`.
 *
 * Usado pelo pré-check em `PaymentAccountsService.create()` para evitar
 * tentar criar uma subconta com cpfCnpj que já existe na nossa master
 * (Asaas rejeitaria com erro 422).
 */
export interface AsaasAccountSummary {
  id: string;
  walletId: string;
  name: string;
  email: string;
  cpfCnpj: string;
  /** Data de criação (ISO). */
  dateCreated: string;
}

export interface AsaasListAccountsResponse {
  object: 'list';
  hasMore: boolean;
  totalCount: number;
  limit: number;
  offset: number;
  data: AsaasAccountSummary[];
}

// ── Customers (`POST /customers`) ───────────────────────────────────────────

export interface AsaasCreateCustomerInput {
  name: string;
  cpfCnpj: string;
  email?: string;
  mobilePhone?: string;
  /** Idempotência: se passarmos o `Resident.id`, Asaas dedup pelo par. */
  externalReference?: string;
  /**
   * `true` impede o Asaas de criar/enviar as 8 notificações default
   * (email, SMS, voz, WhatsApp). Usamos para evitar duplicação com o
   * WhatsApp via Evolution API (que já é parte do nosso fluxo de
   * cobrança) e para zerar os custos por notif:
   *   • SMS/email — pacote R$ 0,99 cada
   *   • Voz/robô   — R$ 0,55 por chamada
   *   • WhatsApp Asaas — R$ 0,55 por mensagem
   */
  notificationDisabled?: boolean;
}

export interface AsaasCustomerResponse {
  id: string;
  name: string;
  cpfCnpj: string;
  email: string | null;
  mobilePhone: string | null;
  externalReference: string | null;
}

// ── Cobranças (`POST /payments`) ────────────────────────────────────────────

export type AsaasBillingType =
  | 'BOLETO'
  | 'CREDIT_CARD'
  | 'PIX'
  | 'UNDEFINED'
  | 'DEBIT_CARD'
  | 'TRANSFER';

export type AsaasPaymentStatus =
  | 'PENDING'
  | 'AWAITING_PAYMENT'
  | 'AWAITING_RISK_ANALYSIS'
  | 'CONFIRMED'
  | 'RECEIVED'
  | 'RECEIVED_IN_CASH'
  | 'OVERDUE'
  | 'REFUNDED'
  | 'CHARGEBACK_REQUESTED'
  | 'CHARGEBACK_DISPUTE'
  | 'AWAITING_CHARGEBACK_REVERSAL'
  | 'DUNNING_REQUESTED'
  | 'DUNNING_RECEIVED'
  | 'AWAITING_CANCELLATION'
  | 'PAYMENT_DELETED'
  | 'REFUND_IN_PROGRESS';

export interface AsaasSplit {
  walletId: string;
  fixedValue?: number;
  percentualValue?: number;
}

export interface AsaasCreatePaymentInput {
  /** ID do Customer Asaas (não do Resident local). */
  customer: string;
  billingType: AsaasBillingType;
  /** Valor em reais (decimal). */
  value: number;
  /** `YYYY-MM-DD`. */
  dueDate: string;
  description?: string;
  /** Idempotência: `Charge.id` local — repostar com mesmo valor é seguro. */
  externalReference?: string;
  /** Split para SaaS-fee (fase 2). Não preenchido na v1. */
  split?: AsaasSplit[];
  /** Multa por atraso (% sobre o valor). */
  fine?: { value: number; type?: 'FIXED' | 'PERCENTAGE' };
  /** Juros mensal por atraso (%). */
  interest?: { value: number; type?: 'PERCENTAGE' };
}

export interface AsaasPaymentResponse {
  id: string;
  customer: string;
  billingType: AsaasBillingType;
  status: AsaasPaymentStatus;
  value: number;
  netValue: number | null;
  dueDate: string;
  description: string | null;
  externalReference: string | null;
  /** URL pública (Asaas Checkout) — abre Pix/boleto/cartão na mesma página. */
  invoiceUrl: string;
  /** Disponível para `billingType=BOLETO` ou `UNDEFINED` após gerar. */
  bankSlipUrl: string | null;
  /** Disponível para `billingType=PIX` — recuperar com `GET /payments/:id/pixQrCode`. */
  paymentDate: string | null;
  clientPaymentDate: string | null;
}

export interface AsaasPixQrCodeResponse {
  /** PNG em base64 (sem prefixo `data:image/png;base64,`). */
  encodedImage: string;
  /** "Copia-cola" Pix BR Code. */
  payload: string;
  /** ISO 8601. */
  expirationDate: string;
}

// ── Webhooks (`POST /webhooks`) ─────────────────────────────────────────────

export type AsaasWebhookEvent =
  | 'PAYMENT_CREATED'
  | 'PAYMENT_UPDATED'
  | 'PAYMENT_CONFIRMED'
  | 'PAYMENT_RECEIVED'
  | 'PAYMENT_OVERDUE'
  | 'PAYMENT_DELETED'
  | 'PAYMENT_REFUNDED'
  | 'PAYMENT_RESTORED'
  | 'PAYMENT_RECEIVED_IN_CASH'
  | 'PAYMENT_RECEIVED_IN_CASH_UNDONE';

export interface AsaasCreateWebhookInput {
  name: string;
  url: string;
  email: string;
  enabled: boolean;
  /** Asaas envia em série (recomendado para idempotência). */
  sendType: 'SEQUENTIALLY' | 'NON_SEQUENTIALLY';
  /** Token único — Asaas devolve no header `asaas-access-token` ao chamar. */
  authToken: string;
  /** Lista whitelist. Eventos fora não são enviados. */
  events: AsaasWebhookEvent[];
  /** Versão da API. Default Asaas = 3. Mandamos explícito por segurança. */
  apiVersion: number;
  /**
   * Fila pausada por falhas consecutivas — campo **documentado** em
   * https://docs.asaas.com/reference/criar-novo-webhook (boolean, default false).
   */
  interrupted: boolean;
  /**
   * Mesmo conceito que `interrupted`, mas com nome novo que o servidor
   * passou a exigir em mai/2026 (erro `invalid_poolInterrupted`). A doc
   * oficial **não cita** este campo — descoberta empírica via 422.
   * Enviamos os dois com o mesmo valor pra cobrir transição.
   */
  poolInterrupted: boolean;
}

export interface AsaasWebhookResponse {
  id: string;
  name: string;
  url: string;
  events: AsaasWebhookEvent[];
  enabled: boolean;
  /** Asaas seta `true` após falhas repetidas — não envia mais até liberar. */
  interrupted?: boolean;
  /** Email cadastrado pra alertas de erro. */
  email?: string;
}

/** GET /webhooks — Asaas devolve em envelope `data`. */
export interface AsaasWebhookListResponse {
  object: 'list';
  hasMore: boolean;
  totalCount: number;
  limit: number;
  offset: number;
  data: AsaasWebhookResponse[];
}

// ── Erros (envelope padrão Asaas) ───────────────────────────────────────────

export interface AsaasErrorResponse {
  errors: Array<{ code: string; description: string }>;
}
