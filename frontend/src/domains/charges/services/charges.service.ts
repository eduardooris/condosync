import { api } from '@/shared/lib/axios';
import type { Charge } from '@/shared/types/api';

export interface CreateChargeInput {
  unitId: string;
  /** Competência YYYY-MM */
  billingMonth: string;
  /**
   * Em string com 2 casas decimais (ex.: "180.00"). O backend usa `decimal` em DB
   * e valida como string. Quando omitido, herda `monthlyFeeAmount` do condomínio.
   */
  amount?: string;
  /** YYYY-MM-DD. Quando omitido, calcula a partir do `billingDueDay`. */
  dueDate?: string;
  /** Descrição opcional para cobrança avulsa. */
  description?: string;
}

export interface UpdateChargeInput {
  amount?: number;
  dueDate?: string;
}

export interface GenerateMonthAsaasFailure {
  chargeId: string;
  unitId: string;
  unitLabel: string;
  message: string;
}

export interface GenerateMonthResult {
  created: number;
  skipped: number;
  asaasEmitted: number;
  asaasFailed: number;
  failures: GenerateMonthAsaasFailure[];
}

export interface EmitPendingAsaasResult {
  emitted: number;
  failed: number;
  failures: GenerateMonthAsaasFailure[];
}

export interface MarkPaidInput {
  paidAt?: string;
  method?: string;
  note?: string;
}

export const chargesService = {
  list: (condId: string) =>
    api.get<Charge[], Charge[]>(`/condominiums/${condId}/charges`),

  /** Cobranças das unidades em que o usuário é morador (US-08). */
  listMine: (condId: string) =>
    api.get<Charge[], Charge[]>(`/condominiums/${condId}/charges/mine`),

  /** Gera cobranças do mês para todas as unidades ocupadas. */
  generateMonth: (condId: string, billingMonth?: string) =>
    api.post<GenerateMonthResult, GenerateMonthResult>(
      `/condominiums/${condId}/charges/generate`,
      billingMonth ? { billingMonth } : {},
    ),

  /** Cria uma cobrança manual para UMA unidade específica. */
  createOne: (condId: string, payload: CreateChargeInput) =>
    api.post<Charge, Charge>(`/condominiums/${condId}/charges`, payload),

  /** Atualiza valor/vencimento de uma cobrança ainda não liquidada. */
  update: (condId: string, chargeId: string, payload: UpdateChargeInput) =>
    api.patch<Charge, Charge>(
      `/condominiums/${condId}/charges/${chargeId}`,
      payload,
    ),

  markPaid: (id: string, payload?: MarkPaidInput) =>
    api.patch<MarkPaidInput, Charge>(`/charges/${id}/mark-paid`, {
      paidAt: payload?.paidAt ?? new Date().toISOString(),
      ...(payload?.method ? { method: payload.method } : {}),
      ...(payload?.note?.trim() ? { note: payload.note.trim() } : {}),
    }),

  emitAsaasPending: (condId: string) =>
    api.post<undefined, EmitPendingAsaasResult>(
      `/condominiums/${condId}/charges/emit-asaas-pending`,
      undefined,
    ),

  /**
   * Síndico rejeita a solicitação de baixa do morador.
   * Limpa `payment_request_*` da cobrança e notifica o morador.
   */
  rejectPaymentRequest: (chargeId: string, reason: string) =>
    api.post<{ reason: string }, Charge>(
      `/charges/${chargeId}/payment-request/reject`,
      { reason },
    ),

  exempt: (id: string, reason: string) =>
    api.patch<{ reason: string }, Charge>(`/charges/${id}/exempt`, { reason }),

  /** Reenvia mensagem (segunda via) ao responsável — fila WhatsApp. */
  resendWhatsapp: (condId: string, chargeId: string) =>
    api.post<undefined, { enqueued: true }>(
      `/condominiums/${condId}/charges/${chargeId}/resend-whatsapp`,
      undefined,
    ),
};
