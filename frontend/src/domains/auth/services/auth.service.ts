import { api } from '@/shared/lib/axios';
import type { LoginInput } from '@/domains/auth/schemas/login.schema';
import type { RegisterInput } from '@/domains/auth/schemas/register.schema';
import type { ForgotPasswordInput } from '@/domains/auth/schemas/forgot-password.schema';
import type { ResetPasswordInput } from '@/domains/auth/schemas/reset-password.schema';
import type { MeResponse } from '@/shared/types/api';

export type UpdateMePayload = {
  fullName?: string | null;
  phoneWhatsapp?: string | null;
};
import type { MyCondominium } from '@/domains/condominiums/services/condominiums.service';

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
}

interface RegisterResponse {
  userId: string;
  email: string;
  requiresEmailConfirmation: boolean;
  accessToken: string | null;
  refreshToken: string | null;
}
interface PendingCondominium {
  condominiumId: string;
  condominiumName: string;
}

export const authService = {
  login: (payload: LoginInput) => api.post<LoginResponse, LoginResponse>('/auth/login', payload),
  register: (payload: RegisterInput) =>
    api.post<RegisterResponse, RegisterResponse>('/auth/register', payload),
  forgotPassword: (payload: ForgotPasswordInput) =>
    api.post<{ ok: true }, { ok: true }>('/auth/forgot-password', payload),
  resetPassword: (payload: ResetPasswordInput) =>
    api.post<{ ok: true }, { ok: true }>('/auth/reset-password', payload),
  refresh: (refreshToken: string) =>
    api.post<LoginResponse, LoginResponse>('/auth/refresh', { refreshToken }),
  me: () => api.get<MeResponse, MeResponse>('/auth/me'),
  patchMe: (payload: UpdateMePayload) =>
    api.patch<MeResponse, MeResponse>('/auth/me', payload),
  listCondominiums: () =>
    api.get<MyCondominium[], MyCondominium[]>('/condominiums/mine'),
  listPendingCondominiums: () =>
    api.get<PendingCondominium[], PendingCondominium[]>(
      '/condominiums/mine/pending',
    ),
};
