/** Espelha o que `MasterPaymentsController` retorna — não tem geração
 *  automática (OpenAPI) ainda; quando tiver, este arquivo vira lixo. */

export type PaymentAccountStatus =
  | 'DRAFT'
  | 'PENDING_DOCS'
  | 'PENDING_REVIEW'
  | 'ACTIVE'
  | 'BLOCKED'
  | 'REJECTED';

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'AWAITING_DOCS' | 'REJECTED';

export interface PaymentAccountSummary {
  id: string;
  condominiumId: string;
  condominiumName: string | null;
  holderType: 'PF' | 'MEI' | 'PJ';
  holderLegalName: string;
  holderEmail: string;
  status: PaymentAccountStatus;
  commercialInfoStatus: ApprovalStatus;
  bankAccountInfoStatus: ApprovalStatus;
  documentationStatus: ApprovalStatus;
  rejectReason: string | null;
  asaasAccountId: string;
  lastStatusCheckAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentAccountDetail extends PaymentAccountSummary {
  holderMobilePhone: string;
  holderCpfCnpj: string;
  asaasWalletId: string;
  onboardingUrl: string | null;
  metrics: {
    totalCharges: number;
    paidCharges: number;
    pendingCharges: number;
  };
}

export type ChargeStatus = 'PENDING' | 'PAID' | 'OVERDUE' | 'EXEMPT' | 'CANCELED';

export interface ChargeRow {
  id: string;
  condominiumId: string | null;
  condominiumName: string | null;
  unitId: string;
  unitLabel: string | null;
  billingMonth: string;
  amount: string;
  dueDate: string;
  status: ChargeStatus;
  paidAt: string | null;
  paidMethod: string | null;
  asaasPaymentId: string | null;
  asaasLastEvent: string | null;
  asaasSyncedAt: string | null;
  createdAt: string;
}

export interface WebhookEventRow {
  id: string;
  event: string;
  asaasPaymentId: string | null;
  paymentAccountId: string;
  receivedAt: string;
  processedAt: string | null;
  processingError: string | null;
  payloadPreview: {
    id?: string;
    status?: string;
    value?: number;
    billingType?: string;
  };
}

export interface WebhookEventDetail extends WebhookEventRow {
  payloadRaw: Record<string, unknown>;
  dedupKey: string;
}
