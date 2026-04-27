import { api } from '@/shared/lib/axios';
import type { Poll, PollMyParticipationItem, PollResult } from '@/shared/types/api';

interface CreatePollInput {
  title: string;
  description?: string;
  quorumPercent: number;
  closesAt: string;
  isAnonymous: boolean;
  options: Array<{ label: string; sortOrder?: number }>;
}

interface VoteInput {
  optionId: string;
}

export const pollsService = {
  myParticipation: (condominiumId: string) =>
    api.get<{ items: PollMyParticipationItem[] }, { items: PollMyParticipationItem[] }>(
      `/condominiums/${condominiumId}/polls/participation`,
    ),
  list: (condominiumId: string) => api.get<Poll[], Poll[]>(`/condominiums/${condominiumId}/polls`),
  create: (condominiumId: string, payload: CreatePollInput) =>
    api.post<CreatePollInput, Poll>(`/condominiums/${condominiumId}/polls`, payload),
  close: (condominiumId: string, pollId: string) =>
    api.post<undefined, Poll>(`/condominiums/${condominiumId}/polls/${pollId}/close`, undefined),
  results: (condominiumId: string, pollId: string) =>
    api.get<PollResult, PollResult>(`/condominiums/${condominiumId}/polls/${pollId}/results`),
  vote: (pollId: string, payload: VoteInput) =>
    api.post<VoteInput, unknown>(`/polls/${pollId}/vote`, payload),
};
