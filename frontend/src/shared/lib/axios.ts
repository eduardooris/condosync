import axios from 'axios';
import { useAuthStore } from '@/shared/stores/auth.store';
import { getPublicOrigin } from '@/shared/lib/public-origin';

const ORIGIN = getPublicOrigin();

// O backend tem prefixo global `api/v1` (ver `backend/src/main.ts`). Os
// services chamam endpoints relativos (ex.: `/condominiums/:id/charges`).
export const API_PREFIX = '/api/v1';

export const api = axios.create({
  baseURL: `${ORIGIN.replace(/\/$/, '')}${API_PREFIX}`,
});

const authApi = axios.create({
  baseURL: `${ORIGIN.replace(/\/$/, '')}${API_PREFIX}`,
});

let refreshPromise: Promise<string | null> | null = null;

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const originalRequest = error.config as (typeof error.config & { _retry?: boolean }) | undefined;
    if (!originalRequest || error.response?.status !== 401 || originalRequest._retry) {
      if (error.response?.status === 401) {
        useAuthStore.getState().logout();
      }
      return Promise.reject(error);
    }

    const { refreshToken, setTokens, logout } = useAuthStore.getState();
    if (!refreshToken) {
      logout();
      return Promise.reject(error);
    }

    originalRequest._retry = true;
    try {
      if (!refreshPromise) {
        refreshPromise = authApi
          .post('/auth/refresh', { refreshToken })
          .then((res) => {
            const nextAccess = String(res.data?.accessToken ?? '');
            const nextRefresh = String(res.data?.refreshToken ?? '');
            if (!nextAccess || !nextRefresh) {
              throw new Error('Resposta de refresh inválida.');
            }
            setTokens({ token: nextAccess, refreshToken: nextRefresh });
            return nextAccess;
          })
          .catch(() => {
            logout();
            return null;
          })
          .finally(() => {
            refreshPromise = null;
          });
      }

      const newAccessToken = await refreshPromise;
      if (!newAccessToken) {
        return Promise.reject(error);
      }
      originalRequest.headers = originalRequest.headers ?? {};
      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
      return api.request(originalRequest);
    } catch {
      logout();
      return Promise.reject(error);
    }
  },
);
