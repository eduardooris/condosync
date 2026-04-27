import { api } from '@/shared/lib/axios';
import type { Unit } from '@/shared/types/api';

export type UnitType = 'APARTMENT' | 'HOUSE' | 'COMMERCIAL' | 'STUDIO';
export type UnitStatus = 'OCCUPIED' | 'VACANT' | 'UNDER_MAINTENANCE';

export interface CreateUnitInput {
  block: string;
  number: string;
  type?: UnitType;
  status?: UnitStatus;
}

export interface UpdateUnitInput {
  block?: string;
  number?: string;
  type?: UnitType;
  status?: UnitStatus;
}

export interface ImportUnitsResult {
  count: number;
}

export interface UnitOnboardingChecklistItem {
  unitId: string;
  block: string;
  number: string;
  hasResidents: boolean;
  hasFinancialResponsible: boolean;
  hasActiveAppAccess: boolean;
  hasPendingInvitation: boolean;
  hasCurrentMonthCharge: boolean;
  score: number;
  isReady: boolean;
}

export const unitsService = {
  list: (condominiumId: string) =>
    api.get<Unit[], Unit[]>(`/condominiums/${condominiumId}/units`),
  create: (condominiumId: string, payload: CreateUnitInput) =>
    api.post<CreateUnitInput, Unit>(`/condominiums/${condominiumId}/units`, payload),
  update: (condominiumId: string, unitId: string, payload: UpdateUnitInput) =>
    api.patch<UpdateUnitInput, Unit>(`/condominiums/${condominiumId}/units/${unitId}`, payload),
  importCsv: (condominiumId: string, csv: string) =>
    api.post<{ csv: string }, ImportUnitsResult>(
      `/condominiums/${condominiumId}/units/import`,
      { csv },
    ),
  onboardingChecklist: (condominiumId: string) =>
    api.get<UnitOnboardingChecklistItem[], UnitOnboardingChecklistItem[]>(
      `/condominiums/${condominiumId}/units/onboarding-checklist`,
    ),
};
