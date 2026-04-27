import { api } from '@/shared/lib/axios';
import type { Bulletin } from '@/shared/types/api';

interface CreateBulletinInput {
  title: string;
  body: string;
  priority: 'INFO' | 'ATTENTION' | 'URGENT';
  expiresAt?: string;
}

export const bulletinService = {
  list: (condominiumId: string) =>
    api.get<Bulletin[], Bulletin[]>(`/condominiums/${condominiumId}/bulletin`),
  create: (condominiumId: string, payload: CreateBulletinInput) =>
    api.post<CreateBulletinInput, Bulletin>(`/condominiums/${condominiumId}/bulletin`, payload),
};
