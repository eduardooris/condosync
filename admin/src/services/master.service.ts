import { http } from '@/lib/http';
import type {
  ChargeRow,
  CondominiumDetail,
  CondominiumSummary,
  PaymentAccountDetail,
  PaymentAccountSecrets,
  PaymentAccountSummary,
  UserDetail,
  UserSummary,
  WebhookEventDetail,
  WebhookEventRow,
} from '@/lib/types';

export const masterService = {
  // ── Payment accounts ──
  listPaymentAccounts: async (): Promise<PaymentAccountSummary[]> => {
    const { data } = await http.get<PaymentAccountSummary[]>('/master/payment-accounts');
    return data;
  },
  getPaymentAccount: async (id: string): Promise<PaymentAccountDetail> => {
    const { data } = await http.get<PaymentAccountDetail>(
      `/master/payment-accounts/${id}`,
    );
    return data;
  },
  getPaymentAccountSecrets: async (
    id: string,
  ): Promise<PaymentAccountSecrets> => {
    const { data } = await http.get<PaymentAccountSecrets>(
      `/master/payment-accounts/${id}/secrets`,
    );
    return data;
  },

  // ── Charges ──
  listCharges: async (params: {
    status?: string;
    condominiumId?: string;
    asaasPaymentId?: string;
    search?: string;
    limit?: number;
  }): Promise<ChargeRow[]> => {
    const { data } = await http.get<ChargeRow[]>('/master/charges', { params });
    return data;
  },

  // ── Webhook events ──
  listWebhookEvents: async (params: {
    event?: string;
    status?: 'processed' | 'failed' | 'pending';
    paymentAccountId?: string;
    asaasPaymentId?: string;
    limit?: number;
  }): Promise<WebhookEventRow[]> => {
    const { data } = await http.get<WebhookEventRow[]>('/master/webhook-events', {
      params,
    });
    return data;
  },
  getWebhookEvent: async (id: string): Promise<WebhookEventDetail> => {
    const { data } = await http.get<WebhookEventDetail>(`/master/webhook-events/${id}`);
    return data;
  },
  reprocessWebhookEvent: async (id: string): Promise<{ ok: boolean }> => {
    const { data } = await http.post<{ ok: boolean }>(
      `/master/webhook-events/${id}/reprocess`,
    );
    return data;
  },

  /**
   * Idempotente: para cada subconta ACTIVE, garante que o webhook Asaas
   * inclui todos os eventos exigidos (PAYMENT_RECEIVED_IN_CASH, etc.).
   * Subcontas que já estão OK são puladas.
   */
  refreshAllAsaasWebhooks: async (): Promise<{
    checked: number;
    refreshed: number;
  }> => {
    const { data } = await http.post<{ checked: number; refreshed: number }>(
      '/master/payment-accounts/refresh-webhooks',
    );
    return data;
  },

  /** Atualiza o webhook de uma subconta específica (idempotente). */
  refreshAsaasWebhookForAccount: async (
    accountId: string,
  ): Promise<{ ok: boolean; refreshed: boolean }> => {
    const { data } = await http.post<{ ok: boolean; refreshed: boolean }>(
      `/master/payment-accounts/${accountId}/refresh-webhook`,
    );
    return data;
  },

  // ── Condomínios (cross-tenant) ──
  listCondominiums: async (params: {
    search?: string;
    archived?: 'only' | 'include';
  }): Promise<CondominiumSummary[]> => {
    const { data } = await http.get<CondominiumSummary[]>('/master/condominiums', { params });
    return data;
  },
  getCondominium: async (id: string): Promise<CondominiumDetail> => {
    const { data } = await http.get<CondominiumDetail>(`/master/condominiums/${id}`);
    return data;
  },

  // ── Usuários (cross-tenant) ──
  listUsers: async (params: { search?: string; limit?: number }): Promise<UserSummary[]> => {
    const { data } = await http.get<UserSummary[]>('/master/users', { params });
    return data;
  },
  getUser: async (id: string): Promise<UserDetail> => {
    const { data } = await http.get<UserDetail>(`/master/users/${id}`);
    return data;
  },

  // ── Ações dev (reaproveita endpoints existentes em /payment-account/dev) ──
  refreshWebhook: async (condominiumId: string) => {
    const { data } = await http.post<{ webhookId: string; url: string; deletedOld: number }>(
      `/condominiums/${condominiumId}/payment-account/dev/webhook/refresh`,
    );
    return data;
  },
  listAsaasWebhooks: async (condominiumId: string) => {
    const { data } = await http.get<{
      expectedUrl: string;
      count: number;
      webhooks: Array<{
        id: string;
        name: string;
        url: string;
        enabled: boolean;
        interrupted: boolean;
        events: string[];
      }>;
    }>(`/condominiums/${condominiumId}/payment-account/dev/webhooks`);
    return data;
  },
  forceActive: async (condominiumId: string) => {
    const { data } = await http.post<{ status: string }>(
      `/condominiums/${condominiumId}/payment-account/dev/force-active`,
    );
    return data;
  },
  simulatePix: async (condominiumId: string, chargeId: string) => {
    const { data } = await http.post<{ asaasPaymentId: string; status: string }>(
      `/condominiums/${condominiumId}/payment-account/dev/charges/${chargeId}/simulate-pix`,
    );
    return data;
  },
  payWithTestCard: async (condominiumId: string, chargeId: string) => {
    const { data } = await http.post<{ asaasPaymentId: string; status: string }>(
      `/condominiums/${condominiumId}/payment-account/dev/charges/${chargeId}/pay-with-test-card`,
    );
    return data;
  },
  receiveInCash: async (condominiumId: string, chargeId: string) => {
    const { data } = await http.post<{ asaasPaymentId: string; status: string }>(
      `/condominiums/${condominiumId}/payment-account/dev/charges/${chargeId}/receive-in-cash`,
    );
    return data;
  },
  undoReceiveInCash: async (condominiumId: string, chargeId: string) => {
    const { data } = await http.post<{ asaasPaymentId: string; status: string }>(
      `/condominiums/${condominiumId}/payment-account/dev/charges/${chargeId}/undo-receive-in-cash`,
    );
    return data;
  },
};
