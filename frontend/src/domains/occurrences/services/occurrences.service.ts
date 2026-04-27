import { api } from '@/shared/lib/axios';
import type { Occurrence } from '@/shared/types/api';

interface CreateOccurrenceInput {
  unitId: string;
  title: string;
  category: string;
  description: string;
  isAnonymous?: boolean;
}

interface UpdateOccurrenceStatusInput {
  status: 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'ARCHIVED';
}

export const occurrencesService = {
  list: (condominiumId: string) =>
    api.get<Occurrence[], Occurrence[]>(`/condominiums/${condominiumId}/occurrences`),
  create: (condominiumId: string, payload: CreateOccurrenceInput) =>
    api.post<CreateOccurrenceInput, Occurrence>(`/condominiums/${condominiumId}/occurrences`, payload),
  updateStatus: (condominiumId: string, id: string, payload: UpdateOccurrenceStatusInput) =>
    api.patch<UpdateOccurrenceStatusInput, Occurrence>(
      `/condominiums/${condominiumId}/occurrences/${id}/status`,
      payload,
    ),
};
