import { api } from '@/shared/lib/axios';
import type { Resident } from '@/shared/types/api';

export interface CreateResidentInput {
  fullName: string;
  cpf: string;
  phoneWhatsapp: string;
  email: string;
  isFinancialResponsible: boolean;
}

export interface UpdateResidentInput {
  fullName?: string;
  cpf?: string;
  phoneWhatsapp?: string;
  email?: string;
  isFinancialResponsible?: boolean;
}

export interface MyResidentProfile {
  id: string;
  unitId: string;
  fullName: string;
  phoneWhatsapp: string;
  isFinancialResponsible: boolean;
  block: string;
  number: string;
}

export interface UpdateMyResidentProfileInput {
  fullName?: string;
  phoneWhatsapp?: string;
}

export const residentsService = {
  list: (condominiumId: string, unitId: string) =>
    api.get<Resident[], Resident[]>(`/condominiums/${condominiumId}/units/${unitId}/residents`),
  create: (condominiumId: string, unitId: string, payload: CreateResidentInput) =>
    api.post<CreateResidentInput, Resident>(
      `/condominiums/${condominiumId}/units/${unitId}/residents`,
      payload,
    ),
  update: (condominiumId: string, unitId: string, residentId: string, payload: UpdateResidentInput) =>
    api.patch<UpdateResidentInput, Resident>(
      `/condominiums/${condominiumId}/units/${unitId}/residents/${residentId}`,
      payload,
    ),
  setResponsible: (condominiumId: string, unitId: string, residentId: string) =>
    api.post<undefined, Resident>(
      `/condominiums/${condominiumId}/units/${unitId}/residents/${residentId}/set-responsible`,
      undefined,
    ),
  remove: (condominiumId: string, unitId: string, residentId: string) =>
    api.delete<{ ok: true }, { ok: true }>(
      `/condominiums/${condominiumId}/units/${unitId}/residents/${residentId}`,
    ),
  myProfile: (condominiumId: string) =>
    api.get<MyResidentProfile, MyResidentProfile>(
      `/condominiums/${condominiumId}/residents/me`,
    ),
  patchMyProfile: (
    condominiumId: string,
    payload: UpdateMyResidentProfileInput,
  ) =>
    api.patch<UpdateMyResidentProfileInput, MyResidentProfile>(
      `/condominiums/${condominiumId}/residents/me`,
      payload,
    ),
};
