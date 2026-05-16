export type IntercomSessionStatus =
  | 'INITIATED'
  | 'RINGING'
  | 'PREVIEW'
  | 'ANSWERED'
  | 'ENDED'
  | 'MISSED'
  | 'CANCELED_BY_VISITOR'
  | 'REJECTED'
  | 'FAILED';

export type IntercomSessionUpdateReason =
  | 'ANSWERED_BY_OTHER'
  | 'TIMEOUT'
  | 'VISITOR_LEFT'
  | 'REJECTED'
  | 'ENDED';

export interface PortariaUnit {
  id: string;
  block: string;
  number: string;
  label: string;
}

export interface IceServerConfig {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface CreateIntercomSessionResponse {
  sessionId: string;
  guestWsToken: string;
  wsUrl: string;
  iceServers: IceServerConfig[];
  ringExpiresAt: string;
  status: IntercomSessionStatus;
}

export interface IntercomSessionStatusResponse {
  sessionId: string;
  status: IntercomSessionStatus;
  reason?: IntercomSessionUpdateReason;
  endedAt?: string | null;
}

export interface IntercomAccessTokenCreated {
  id: string;
  accessToken: string;
  portariaUrl: string;
  label?: string | null;
  createdAt: string;
  revokedAt?: string | null;
}

export interface IntercomAccessTokenListItem {
  id: string;
  label?: string | null;
  createdAt: string;
  revokedAt?: string | null;
  portariaPathHint: string;
}

export interface IntercomSessionHistoryItem {
  id: string;
  visitorName: string;
  unitId: string;
  unitLabel: string;
  status: IntercomSessionStatus;
  answeredByName?: string | null;
  createdAt: string;
  endedAt?: string | null;
}

export interface IntercomSignalMessage {
  sessionId: string;
  type: string;
  sdp?: string;
  candidate?: RTCIceCandidateInit;
  fromRole?: 'guest' | 'resident';
}
