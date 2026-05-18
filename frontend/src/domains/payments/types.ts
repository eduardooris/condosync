import type { Charge } from '@/shared/types/api';

/**
 * Extensão do `Charge` com os campos `asaas_*` que o backend devolve quando
 * a cobrança foi emitida via gateway. Mantemos opcional porque cobranças
 * legadas (antes do go-live Asaas) seguem com tudo `null`.
 *
 * Quando o OpenAPI for re-gerado, esses campos vão entrar no schema
 * canônico e este arquivo vira lixo. Por hora, type augmentation localizado.
 */
export interface ChargeWithPaymentMethods extends Charge {
  asaasPaymentId?: string | null;
  asaasInvoiceUrl?: string | null;
  asaasPixPayload?: string | null;
  asaasPixQrBase64?: string | null;
  asaasBankSlipUrl?: string | null;
  asaasTransactionReceiptUrl?: string | null;
  asaasPaidVia?:
    | 'PIX'
    | 'BOLETO'
    | 'CREDIT_CARD'
    | 'DEBIT_CARD'
    | 'CASH'
    | 'TRANSFER'
    | null;
  asaasLastEvent?: string | null;
  asaasSyncedAt?: string | null;
  paidMethod?: string | null;
  paidNote?: string | null;
}

export function hasAsaasPayment(c: Charge): c is ChargeWithPaymentMethods {
  return Boolean((c as ChargeWithPaymentMethods).asaasPaymentId);
}
