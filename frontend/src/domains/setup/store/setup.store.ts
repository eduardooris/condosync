import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type SetupStep = 'welcome' | 'identity' | 'financial' | 'units' | 'done';

export interface SetupAddressDraft {
  street?: string;
  number?: string;
  city?: string;
  state?: string;
  zip?: string;
  complement?: string;
}

export interface SetupIdentityDraft {
  name: string;
  cnpj: string;
  address: SetupAddressDraft;
  photoUrl?: string;
  adminContactPhone?: string;
}

export interface SetupFinancialDraft {
  monthlyFeeAmount: number;
  billingGenerationDay: number;
  billingDueDay: number;
  pixKeyType: 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'EVP';
  pixKeyValue: string;
}

interface SetupStore {
  step: SetupStep;
  condominiumId: string | null;
  identity: SetupIdentityDraft;
  financial: SetupFinancialDraft;
  unitsCount: number;
  setStep: (step: SetupStep) => void;
  setCondominiumId: (id: string | null) => void;
  patchIdentity: (patch: Partial<SetupIdentityDraft>) => void;
  patchFinancial: (patch: Partial<SetupFinancialDraft>) => void;
  setUnitsCount: (count: number) => void;
  reset: () => void;
}

const initialIdentity: SetupIdentityDraft = {
  name: '',
  cnpj: '',
  address: {},
};

const initialFinancial: SetupFinancialDraft = {
  monthlyFeeAmount: 0,
  billingGenerationDay: 1,
  billingDueDay: 10,
  pixKeyType: 'EVP',
  pixKeyValue: '',
};

export const useSetupStore = create<SetupStore>()(
  persist(
    (set) => ({
      step: 'welcome',
      condominiumId: null,
      identity: initialIdentity,
      financial: initialFinancial,
      unitsCount: 0,
      setStep: (step) => set({ step }),
      setCondominiumId: (condominiumId) => set({ condominiumId }),
      patchIdentity: (patch) =>
        set((state) => ({
          identity: {
            ...state.identity,
            ...patch,
            address: { ...state.identity.address, ...(patch.address ?? {}) },
          },
        })),
      patchFinancial: (patch) =>
        set((state) => ({ financial: { ...state.financial, ...patch } })),
      setUnitsCount: (unitsCount) => set({ unitsCount }),
      reset: () =>
        set({
          step: 'welcome',
          condominiumId: null,
          identity: initialIdentity,
          financial: initialFinancial,
          unitsCount: 0,
        }),
    }),
    { name: 'condosync-setup' },
  ),
);

export const STEP_ORDER: SetupStep[] = ['welcome', 'identity', 'financial', 'units', 'done'];

export function stepIndex(step: SetupStep): number {
  return STEP_ORDER.indexOf(step);
}

export function nextStep(step: SetupStep): SetupStep {
  const idx = stepIndex(step);
  return STEP_ORDER[Math.min(idx + 1, STEP_ORDER.length - 1)] ?? step;
}

export function prevStep(step: SetupStep): SetupStep {
  const idx = stepIndex(step);
  return STEP_ORDER[Math.max(idx - 1, 0)] ?? step;
}
