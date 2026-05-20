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

/** Resposta de GET /master/payment-accounts/:id/secrets — dados sensíveis. */
export interface PaymentAccountSecrets {
  paymentAccountId: string;
  condominiumId: string;
  asaasAccountId: string;
  asaasWalletId: string;
  asaasApiKey: string;
  asaasWebhookToken: string;
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

// ── Condomínios ─────────────────────────────────────────────────────────────

export interface CondominiumSummary {
  id: string;
  name: string;
  cnpj: string | null;
  photoUrl: string | null;
  monthlyFeeAmount: string;
  archivedAt: string | null;
  unitCount: number;
  memberCount: number;
  paymentAccountStatus: PaymentAccountStatus | null;
  createdAt: string;
}

export type MembershipRole = 'ADMIN' | 'SUB_ADMIN' | 'RESIDENT' | 'RESPONSIBLE';
export type MembershipStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface CondominiumMember {
  userId: string;
  email: string | null;
  fullName: string | null;
  role: MembershipRole;
  status: MembershipStatus;
  unitId: string | null;
  joinedAt: string;
}

export interface CondominiumDetail {
  id: string;
  name: string;
  cnpj: string | null;
  photoUrl: string | null;
  monthlyFeeAmount: string;
  billingGenerationDay: number | null;
  billingDueDay: number | null;
  pixKeyType: string | null;
  adminContactPhone: string | null;
  archivedAt: string | null;
  createdAt: string;
  paymentAccount: {
    id: string;
    status: PaymentAccountStatus;
    asaasAccountId: string;
    holderLegalName: string;
    holderType: 'PF' | 'MEI' | 'PJ';
  } | null;
  metrics: {
    totalUnits: number;
    vacantUnits: number;
    occupiedUnits: number;
    chargesTotal: number;
    chargesPaid: number;
    chargesPending: number;
    chargesOverdue: number;
  };
  members: CondominiumMember[];
}

// ── Usuários ────────────────────────────────────────────────────────────────

export interface UserSummary {
  id: string;
  email: string;
  fullName: string | null;
  phoneWhatsapp: string | null;
  condominiumCount: number;
  createdAt: string;
}

export interface UserMembership {
  condominiumId: string;
  condominiumName: string | null;
  role: MembershipRole;
  status: MembershipStatus;
  unitId: string | null;
  joinedAt: string;
}

export interface UserDetail {
  id: string;
  email: string;
  fullName: string | null;
  phoneWhatsapp: string | null;
  createdAt: string;
  memberships: UserMembership[];
}
