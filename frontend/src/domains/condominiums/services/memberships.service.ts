import { api } from '@/shared/lib/axios';
import type { components } from '@/shared/types/openapi.generated';

export type Membership = components['schemas']['MembershipResponseDto'];
export type MembershipRole = 'ADMIN' | 'SUB_ADMIN' | 'RESPONSIBLE' | 'RESIDENT';

export interface AddMemberInput {
  email: string;
  role: MembershipRole;
}

export const membershipsService = {
  add: (condominiumId: string, payload: AddMemberInput) =>
    api.post<AddMemberInput, Membership>(
      `/condominiums/${condominiumId}/members`,
      payload,
    ),
};
