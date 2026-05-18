import { api } from '@/shared/lib/axios';

export type PaymentAccountHolderType = 'PF' | 'MEI' | 'PJ';

export type PaymentAccountStatus =
  | 'DRAFT'
  | 'PENDING_DOCS'
  | 'PENDING_REVIEW'
  | 'ACTIVE'
  | 'BLOCKED'
  | 'REJECTED';

export type PaymentAccountApprovalStatus =
  | 'PENDING'
  | 'AWAITING_DOCS'
  | 'APPROVED'
  | 'REJECTED';

export interface HolderAddressInput {
  street: string;
  number: string;
  complement?: string;
  province: string;
  city: string;
  state: string;
  /** Só dígitos (8). */
  postalCode: string;
}

export interface CreatePaymentAccountInput {
  holderType: PaymentAccountHolderType;
  cpfCnpj: string;
  legalName: string;
  birthDate?: string;
  email: string;
  mobilePhone: string;
  incomeValue: number;
  address: HolderAddressInput;
}

export interface PaymentAccountResponse {
  id: string;
  condominiumId: string;
  holderType: PaymentAccountHolderType;
  holderCpfCnpjMasked: string;
  holderLegalName: string;
  status: PaymentAccountStatus;
  commercialInfoStatus: PaymentAccountApprovalStatus | null;
  bankAccountInfoStatus: PaymentAccountApprovalStatus | null;
  documentationStatus: PaymentAccountApprovalStatus | null;
  rejectReason: string | null;
  onboardingUrl: string | null;
  createdAt: string;
  updatedAt: string;
  lastStatusCheckAt: string | null;
}

export interface CreatePaymentAccountResponse extends PaymentAccountResponse {
  message: string;
}

export const paymentAccountsService = {
  /** Retorna `null` quando a subconta ainda não foi criada (404 da API). */
  async get(condominiumId: string): Promise<PaymentAccountResponse | null> {
    try {
      return await api.get<PaymentAccountResponse, PaymentAccountResponse>(
        `/condominiums/${condominiumId}/payment-account`,
      );
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status;
      if (status === 404) return null;
      throw err;
    }
  },

  create(
    condominiumId: string,
    payload: CreatePaymentAccountInput,
  ): Promise<CreatePaymentAccountResponse> {
    return api.post<CreatePaymentAccountInput, CreatePaymentAccountResponse>(
      `/condominiums/${condominiumId}/payment-account`,
      payload,
    );
  },

  refresh(condominiumId: string): Promise<PaymentAccountResponse> {
    return api.post<undefined, PaymentAccountResponse>(
      `/condominiums/${condominiumId}/payment-account/refresh`,
      undefined,
    );
  },

  refreshOnboardingLink(
    condominiumId: string,
  ): Promise<PaymentAccountResponse> {
    return api.post<undefined, PaymentAccountResponse>(
      `/condominiums/${condominiumId}/payment-account/onboarding-link`,
      undefined,
    );
  },
};
