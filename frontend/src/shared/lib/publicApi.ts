import axios from 'axios';
import { API_PREFIX } from '@/shared/lib/axios';
import { getPublicOrigin } from '@/shared/lib/public-origin';

/** HTTP público (portaria) — sem interceptor de refresh JWT. */
export const publicApi = axios.create({
  baseURL: `${getPublicOrigin()}${API_PREFIX}`,
});

publicApi.interceptors.response.use((response) => response.data);
