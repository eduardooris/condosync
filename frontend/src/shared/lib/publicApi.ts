import axios from 'axios';
import { API_PREFIX } from '@/shared/lib/axios';

const ORIGIN =
  import.meta.env.VITE_API_BASE_URL ??
  import.meta.env.VITE_API_URL ??
  'http://localhost:3000';

/** HTTP público (portaria) — sem interceptor de refresh JWT. */
export const publicApi = axios.create({
  baseURL: `${ORIGIN.replace(/\/$/, '')}${API_PREFIX}`,
});

publicApi.interceptors.response.use((response) => response.data);
