import { api } from '@/shared/lib/axios';
import type { Condominium } from '@/shared/types/api';
import type { UserRole } from '@/shared/types/auth.types';

/**
 * Condomínio enriquecido com a role do usuário corrente. Retornado por
 * `GET /condominiums/mine` (vide `MyCondominiumResponseDto` no backend).
 */
export interface MyCondominium extends Condominium {
  role: UserRole;
  unitId: string | null;
}

/** Membership PENDING — `GET /condominiums/mine/pending`. */
export interface PendingCondominium {
  condominiumId: string;
  condominiumName: string;
}

export interface CondominiumAddress {
  street?: string;
  number?: string;
  city?: string;
  state?: string;
  zip?: string;
  complement?: string;
}

export type PixKeyType = 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'EVP';

export interface PixSettingsInput {
  pixKeyType?: PixKeyType;
  pixKeyValue?: string;
}

export interface CreateCondominiumInput {
  name: string;
  cnpj: string;
  address?: CondominiumAddress;
  photoUrl?: string;
  monthlyFeeAmount?: number;
  billingGenerationDay?: number;
  billingDueDay?: number;
  pixKeyType?: PixKeyType;
  pixKeyValue?: string;
  adminContactPhone?: string;
}

export interface UpdateCondominiumInput extends PixSettingsInput {
  name?: string;
  cnpj?: string;
  address?: CondominiumAddress;
  photoUrl?: string;
  monthlyFeeAmount?: number;
  billingGenerationDay?: number;
  billingDueDay?: number;
  adminContactPhone?: string;
}

export const condominiumsService = {
  listMine: () =>
    api.get<MyCondominium[], MyCondominium[]>('/condominiums/mine'),
  listMyPending: () =>
    api.get<PendingCondominium[], PendingCondominium[]>(
      '/condominiums/mine/pending',
    ),
  getOne: (id: string) => api.get<Condominium, Condominium>(`/condominiums/${id}`),
  create: (payload: CreateCondominiumInput) =>
    api.post<CreateCondominiumInput, Condominium>('/condominiums', {
      monthlyFeeAmount: 0,
      billingGenerationDay: 1,
      billingDueDay: 10,
      ...payload,
    }),
  update: (id: string, payload: UpdateCondominiumInput) =>
    api.patch<UpdateCondominiumInput, Condominium>(`/condominiums/${id}`, payload),
};
