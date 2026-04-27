import { api } from '@/shared/lib/axios';
import type { Document } from '@/shared/types/api';

interface SignedUrlResponse {
  url: string;
  expiresIn: number;
}

interface CreateDocumentInput {
  title: string;
  description?: string;
  category: string;
  documentDate: string;
  visibility: 'ALL' | 'ADMIN_ONLY';
  file: File;
}

export const documentsService = {
  list: (condominiumId: string) =>
    api.get<Document[], Document[]>(`/condominiums/${condominiumId}/documents`),
  signedUrl: (condominiumId: string, id: string) =>
    api.get<SignedUrlResponse, SignedUrlResponse>(
      `/condominiums/${condominiumId}/documents/${id}/url`,
    ),
  create: async (condominiumId: string, payload: CreateDocumentInput) => {
    const body = new FormData();
    body.append('title', payload.title);
    if (payload.description) body.append('description', payload.description);
    body.append('category', payload.category);
    body.append('documentDate', payload.documentDate);
    body.append('visibility', payload.visibility);
    body.append('file', payload.file);
    return api.post<FormData, Document>(`/condominiums/${condominiumId}/documents`, body, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  remove: (condominiumId: string, id: string) =>
    api.delete<unknown, { ok: boolean }>(`/condominiums/${condominiumId}/documents/${id}`),
};
