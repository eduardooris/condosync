import { api } from '@/shared/lib/axios';
import type {
  IntercomAccessTokenCreated,
  IntercomAccessTokenListItem,
  IntercomSessionHistoryItem,
} from '@/shared/types/intercom';

export const intercomAdminService = {
  createToken: (condominiumId: string, label?: string) =>
    api.post<IntercomAccessTokenCreated, IntercomAccessTokenCreated>(
      `/condominiums/${condominiumId}/intercom/tokens`,
      label ? { label } : {},
    ),

  listTokens: (condominiumId: string) =>
    api.get<IntercomAccessTokenListItem[], IntercomAccessTokenListItem[]>(
      `/condominiums/${condominiumId}/intercom/tokens`,
    ),

  revokeToken: (condominiumId: string, tokenId: string) =>
    api.delete<void, void>(
      `/condominiums/${condominiumId}/intercom/tokens/${tokenId}`,
    ),

  listSessions: (condominiumId: string) =>
    api.get<IntercomSessionHistoryItem[], IntercomSessionHistoryItem[]>(
      `/condominiums/${condominiumId}/intercom/sessions`,
    ),
};
