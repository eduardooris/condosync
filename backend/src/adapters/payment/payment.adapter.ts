export const PAYMENT_ADAPTER = 'PAYMENT_ADAPTER';

/** V2 — pagamentos externos (Asaas, Efí). MVP usa marcação manual de cobrança paga. */
export interface IPaymentAdapter {
  createPaymentLink?(params: {
    amount: number;
    description: string;
    externalId: string;
  }): Promise<{ url: string }>;
}
