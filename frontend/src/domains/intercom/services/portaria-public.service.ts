import { publicApi } from '@/shared/lib/publicApi';
import type {
  CreateIntercomSessionResponse,
  IntercomSessionStatusResponse,
  PortariaUnit,
} from '@/shared/types/intercom';

export const portariaPublicService = {
  listUnits: (accessToken: string) =>
    publicApi.get<PortariaUnit[], PortariaUnit[]>(
      `/portaria/${encodeURIComponent(accessToken)}/units`,
    ),

  createSession: (
    accessToken: string,
    body: { unitId: string; visitorName: string },
  ) =>
    publicApi.post<CreateIntercomSessionResponse, CreateIntercomSessionResponse>(
      `/portaria/${encodeURIComponent(accessToken)}/sessions`,
      body,
    ),

  sessionStatus: (sessionId: string) =>
    publicApi.get<IntercomSessionStatusResponse, IntercomSessionStatusResponse>(
      `/portaria/sessions/${sessionId}/status`,
    ),

  cancelSession: (sessionId: string, guestWsToken: string) =>
    publicApi.post<IntercomSessionStatusResponse, IntercomSessionStatusResponse>(
      `/portaria/sessions/${sessionId}/cancel`,
      { guestWsToken },
    ),

  endSession: (sessionId: string, guestWsToken: string) =>
    publicApi.post<IntercomSessionStatusResponse, IntercomSessionStatusResponse>(
      `/portaria/sessions/${sessionId}/end`,
      { guestWsToken },
    ),
};
