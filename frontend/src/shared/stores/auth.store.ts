import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  AuthUser,
  CondominiumContext,
  PendingMembership,
  UserRole,
} from '@/shared/types/auth.types';

interface SetAuthPayload {
  user: AuthUser;
  token: string;
  refreshToken?: string | null;
  /**
   * Role inicial inferida do JWT (fallback). É **sobrescrita** quando o
   * usuário entra em um condomínio (vide `setActiveCondominium`).
   */
  role: UserRole;
  /**
   * Capacidade global do usuário (vem do JWT do Keycloak —
   * realm role `condo-admin`). Serve para diferenciar, antes do
   * usuário estar vinculado a um condomínio, se ele é um
   * potencial **síndico** (pode criar condomínios) ou **morador**
   * (precisa ser convidado).
   */
  canCreateCondominium: boolean;
}

interface AuthStore {
  user: AuthUser | null;
  token: string | null;
  refreshToken: string | null;
  role: UserRole | null;
  canCreateCondominium: boolean;
  activeCondominium: CondominiumContext | null;
  /** Memberships PENDING (aguardando aprovação). */
  pendingMemberships: PendingMembership[];
  setAuth: (payload: SetAuthPayload) => void;
  setActiveCondominium: (condominium: CondominiumContext | null) => void;
  setPendingMemberships: (pending: PendingMembership[]) => void;
  setTokens: (tokens: { token: string; refreshToken: string | null }) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      refreshToken: null,
      role: null,
      canCreateCondominium: false,
      activeCondominium: null,
      pendingMemberships: [],
      setAuth: ({ user, token, refreshToken, role, canCreateCondominium }) =>
        set((state) => ({
          user,
          token,
          refreshToken: refreshToken ?? state.refreshToken,
          role,
          canCreateCondominium,
        })),
      setActiveCondominium: (activeCondominium) =>
        set((state) => ({
          activeCondominium,
          // A role do contexto sobrescreve a role global (do JWT).
          // Quando saímos do condomínio, voltamos à role inferida do JWT.
          role: activeCondominium?.role ?? state.role,
        })),
      setPendingMemberships: (pendingMemberships) => set({ pendingMemberships }),
      setTokens: ({ token, refreshToken }) => set({ token, refreshToken }),
      logout: () =>
        set({
          user: null,
          token: null,
          refreshToken: null,
          role: null,
          canCreateCondominium: false,
          activeCondominium: null,
          pendingMemberships: [],
        }),
    }),
    { name: 'condosync-auth' },
  ),
);
