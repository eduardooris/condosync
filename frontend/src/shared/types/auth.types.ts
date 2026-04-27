export type UserRole = 'ADMIN' | 'SUB_ADMIN' | 'RESPONSIBLE' | 'RESIDENT';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

export interface CondominiumContext {
  id: string;
  name: string;
  /**
   * Role do usuário **neste** condomínio (vem de `user_condominiums.role`).
   * Determina o gating de UI dentro do condomínio ativo. Os 4 papéis
   * possíveis: ADMIN, SUB_ADMIN, RESPONSIBLE, RESIDENT.
   */
  role: UserRole;
  /** Unidade vinculada ao membership (RESIDENT/RESPONSIBLE) — null para ADMIN/SUB_ADMIN. */
  unitId: string | null;
}

/**
 * Membership PENDING — quando o usuário aceita um link genérico de
 * convite, ele entra como pendente e aguarda aprovação por ADMIN/SUB_ADMIN.
 * O front mostra a tela "aguardando aprovação" enquanto isso.
 */
export interface PendingMembership {
  condominiumId: string;
  condominiumName: string;
}
