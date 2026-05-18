import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import { tokenStore } from '@/auth/token-store';
import { refreshSession } from '@/auth/keycloak';

const BASE = `${import.meta.env.VITE_API_BASE_URL.replace(/\/$/, '')}/api/v1`;

/**
 * Cliente HTTP do back-office. Injeta `Authorization` automaticamente.
 *
 * Em 401, tenta um único refresh do access_token. Se o refresh também
 * falhar, limpa o store — o `RequireAuth` detecta e manda pro /login.
 *
 * Refresh é serializado via `pendingRefresh`: se 5 requests dão 401 quase
 * simultâneos, só UM refresh acontece — os outros aguardam o mesmo Promise.
 */
export const http: AxiosInstance = axios.create({
  baseURL: BASE,
  timeout: 30_000,
});

http.interceptors.request.use((config) => {
  const tokens = tokenStore.get();
  if (tokens?.accessToken) {
    config.headers.Authorization = `Bearer ${tokens.accessToken}`;
  }
  return config;
});

let pendingRefresh: Promise<void> | null = null;

http.interceptors.response.use(
  (r) => r,
  async (err: AxiosError) => {
    const original = err.config as InternalAxiosRequestConfig & { _retried?: boolean };
    if (err.response?.status !== 401 || !original || original._retried) {
      return Promise.reject(err);
    }
    original._retried = true;
    try {
      if (!pendingRefresh) {
        pendingRefresh = refreshSession().then(() => undefined);
        pendingRefresh.finally(() => {
          pendingRefresh = null;
        });
      }
      await pendingRefresh;
    } catch {
      // refresh falhou — store já foi limpo por keycloak.ts
      return Promise.reject(err);
    }
    // Re-executa com o novo token (vai pegar via interceptor de request).
    return http.request(original);
  },
);

export function extractApiError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as
      | { message?: string | string[]; error?: string }
      | undefined;
    const msg = data?.message;
    if (Array.isArray(msg)) return msg.join(' • ');
    if (typeof msg === 'string') return msg;
    if (data?.error) return data.error;
    return err.message;
  }
  return err instanceof Error ? err.message : 'Erro desconhecido';
}
