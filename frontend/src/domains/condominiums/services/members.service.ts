import { api } from '@/shared/lib/axios';
import type { UserRole } from '@/shared/types/auth.types';

export type MembershipStatus = 'PENDING' | 'APPROVED';

export interface Member {
  membershipId: string;
  userId: string;
  email: string;
  fullName: string | null;
  role: UserRole;
  status: MembershipStatus;
  unitId: string | null;
  createdAt: string;
}

export interface UpdateMemberInput {
  role?: UserRole;
  unitId?: string | null;
}

export interface ApproveMemberInput {
  role: UserRole;
  unitId?: string;
}

export const membersService = {
  listApproved: (condominiumId: string) =>
    api.get<Member[], Member[]>(`/condominiums/${condominiumId}/members`),

  listPending: (condominiumId: string) =>
    api.get<Member[], Member[]>(
      `/condominiums/${condominiumId}/members/pending`,
    ),

  approve: (
    condominiumId: string,
    membershipId: string,
    payload: ApproveMemberInput,
  ) =>
    api.post<Member, Member>(
      `/condominiums/${condominiumId}/members/${membershipId}/approve`,
      payload,
    ),

  reject: (condominiumId: string, membershipId: string) =>
    api.post<{ ok: true }, { ok: true }>(
      `/condominiums/${condominiumId}/members/${membershipId}/reject`,
      {},
    ),

  update: (
    condominiumId: string,
    membershipId: string,
    payload: UpdateMemberInput,
  ) =>
    api.patch<Member, Member>(
      `/condominiums/${condominiumId}/members/${membershipId}`,
      payload,
    ),

  remove: (condominiumId: string, membershipId: string) =>
    api.delete<{ ok: true }, { ok: true }>(
      `/condominiums/${condominiumId}/members/${membershipId}`,
    ),
};
