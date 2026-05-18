import { tokenStore, type Tokens } from './token-store';

const KC_URL = import.meta.env.VITE_KEYCLOAK_URL;
const KC_REALM = import.meta.env.VITE_KEYCLOAK_REALM;
const KC_CLIENT = import.meta.env.VITE_KEYCLOAK_CLIENT_ID;

if (!KC_URL || !KC_REALM || !KC_CLIENT) {
  throw new Error('[admin] VITE_KEYCLOAK_* não configurado — copie .env.example.');
}

const TOKEN_URL = `${KC_URL}/realms/${KC_REALM}/protocol/openid-connect/token`;
const LOGOUT_URL = `${KC_URL}/realms/${KC_REALM}/protocol/openid-connect/logout`;

/**
 * Login via password grant. Mesma estratégia do frontend principal.
 *
 * O Keycloak retorna `expires_in` em segundos — calculamos o `expiresAt`
 * absoluto pra UI poder mostrar countdown / agendar refresh proativo.
 */
export async function signInWithPassword(
  username: string,
  password: string,
): Promise<Tokens> {
  const body = new URLSearchParams({
    grant_type: 'password',
    client_id: KC_CLIENT,
    username,
    password,
    scope: 'openid profile email',
  });
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) {
    const errBody = await safeJson(res);
    const desc =
      (errBody && typeof errBody === 'object' && 'error_description' in errBody
        ? String((errBody as { error_description: unknown }).error_description)
        : null) ?? 'Email ou senha inválidos.';
    throw new Error(desc);
  }
  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
  const tokens: Tokens = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  tokenStore.set(tokens);
  return tokens;
}

/**
 * Refresh do access_token usando o refresh_token. Chamado pelo interceptor
 * axios quando recebe 401 ou proativamente antes de expirar.
 *
 * Em caso de falha (refresh expirado/revogado), limpa tudo — caller decide
 * o que mostrar (geralmente redireciona pra /login).
 */
export async function refreshSession(): Promise<Tokens> {
  const current = tokenStore.get();
  if (!current?.refreshToken) {
    throw new Error('Sem refresh_token armazenado.');
  }
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: KC_CLIENT,
    refresh_token: current.refreshToken,
  });
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) {
    tokenStore.clear();
    throw new Error('Sessão expirou — faça login novamente.');
  }
  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
  const tokens: Tokens = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  tokenStore.set(tokens);
  return tokens;
}

/**
 * Encerra a sessão no Keycloak (revoga o refresh_token) e limpa o store
 * local. Falhas no servidor são silenciosas — o front sempre limpa.
 */
export async function signOut(): Promise<void> {
  const current = tokenStore.get();
  if (current?.refreshToken) {
    try {
      const body = new URLSearchParams({
        client_id: KC_CLIENT,
        refresh_token: current.refreshToken,
      });
      await fetch(LOGOUT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });
    } catch {
      /* logout de servidor é best-effort */
    }
  }
  tokenStore.clear();
}

async function safeJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}
