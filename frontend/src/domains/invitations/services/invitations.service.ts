import { api } from '@/shared/lib/axios';
import type { UserRole } from '@/shared/types/auth.types';

export type InvitationType = 'EMAIL_DIRECT' | 'GENERIC_LINK';
export type InvitationStatus = 'ACTIVE' | 'REVOKED' | 'EXHAUSTED';

export interface Invitation {
  id: string;
  type: InvitationType;
  role: UserRole;
  email: string | null;
  unitId: string | null;
  residentId: string | null;
  expiresAt: string;
  maxUses: number;
  usedCount: number;
  status: InvitationStatus;
  createdAt: string;
  /** Presente apenas no retorno da criação (uma única vez). */
  url?: string | null;
}

export interface InvitationPreview {
  condominiumName: string;
  role: UserRole;
  type: InvitationType;
  requiresApproval: boolean;
  email: string | null;
  unitId?: string | null;
  units?: Array<{ id: string; block: string; number: string }>;
}

export interface CreateInvitationInput {
  type: InvitationType;
  email?: string;
  role: UserRole;
  unitId?: string;
  residentId?: string;
  expiresInHours?: number;
  maxUses?: number;
}

export interface AcceptInvitationInput {
  fullName: string;
  password: string;
  email?: string;
  unitId?: string;
}

export interface AcceptInvitationResponse {
  accessToken: string | null;
  refreshToken: string | null;
  requiresApproval: boolean;
}

export const invitationsService = {
  /** ADMIN/SUB_ADMIN — criar convite. URL bruta vem em `url`. */
  create: (condominiumId: string, payload: CreateInvitationInput) =>
    api.post<Invitation, Invitation>(
      `/condominiums/${condominiumId}/invitations`,
      payload,
    ),

  /** ADMIN/SUB_ADMIN — listar convites ativos (sem URL/token bruto). */
  list: (condominiumId: string) =>
    api.get<Invitation[], Invitation[]>(
      `/condominiums/${condominiumId}/invitations`,
    ),

  /** ADMIN/SUB_ADMIN — revogar convite. */
  revoke: (invitationId: string) =>
    api.delete<{ ok: true }, { ok: true }>(`/invitations/${invitationId}`),

  /** PÚBLICO — preview (mostra antes do aceite). */
  preview: (token: string) =>
    api.get<InvitationPreview, InvitationPreview>(`/invitations/${token}`),

  /** PÚBLICO — aceitar convite (cria/vincula usuário). */
  accept: (token: string, payload: AcceptInvitationInput) =>
    api.post<AcceptInvitationResponse, AcceptInvitationResponse>(
      `/invitations/${token}/accept`,
      payload,
    ),
};
