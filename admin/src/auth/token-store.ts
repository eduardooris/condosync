/**
 * Store de tokens — singleton, fora do React.
 *
 * Por que fora do React: o axios interceptor precisa ler/escrever tokens
 * em qualquer momento, inclusive durante refresh em paralelo a re-renders.
 * Context React não dá isso de forma confiável.
 *
 * Storage: localStorage (chave dedicada do admin pra não bater com o app
 * principal). Subscribers são notificados pra UI reagir a login/logout.
 */

export interface Tokens {
  accessToken: string;
  refreshToken: string;
  /** Epoch ms quando o accessToken expira (estimado em login). */
  expiresAt: number;
}

const KEY = 'condosync.admin.tokens.v1';

type Listener = (tokens: Tokens | null) => void;
const listeners = new Set<Listener>();

function read(): Tokens | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Tokens;
    if (
      typeof parsed.accessToken !== 'string' ||
      typeof parsed.refreshToken !== 'string'
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export const tokenStore = {
  get(): Tokens | null {
    return read();
  },
  set(tokens: Tokens): void {
    window.localStorage.setItem(KEY, JSON.stringify(tokens));
    listeners.forEach((l) => l(tokens));
  },
  clear(): void {
    window.localStorage.removeItem(KEY);
    listeners.forEach((l) => l(null));
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
