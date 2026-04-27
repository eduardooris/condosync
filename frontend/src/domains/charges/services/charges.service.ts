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

export interface GenerateMonthResult {
  created: number;
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

  markPaid: (id: string) =>
    api.patch<{ paidAt: string }, Charge>(`/charges/${id}/mark-paid`, {
      paidAt: new Date().toISOString(),
    }),
  exempt: (id: string, reason: string) =>
    api.patch<{ reason: string }, Charge>(`/charges/${id}/exempt`, { reason }),

  /** Reenvia mensagem (segunda via) ao responsável — fila WhatsApp. */
  resendWhatsapp: (condId: string, chargeId: string) =>
    api.post<undefined, { enqueued: true }>(
      `/condominiums/${condId}/charges/${chargeId}/resend-whatsapp`,
      undefined,
    ),
};
