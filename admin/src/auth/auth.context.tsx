import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { tokenStore, type Tokens } from './token-store';
import { signInWithPassword, signOut as kcSignOut } from './keycloak';

/** Realm role exigida — espelha `MasterRoleGuard.REQUIRED_ROLE` no backend. */
export const REQUIRED_ROLE = 'master-admin';

interface SessionInfo {
  email: string | undefined;
  realmRoles: string[];
  hasMasterRole: boolean;
}

interface AuthContextValue {
  tokens: Tokens | null;
  session: SessionInfo | null;
  /** True na primeiríssima renderização — evita flicker pro form de login. */
  hydrating: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [tokens, setTokens] = useState<Tokens | null>(() => tokenStore.get());
  const [hydrating, setHydrating] = useState(true);

  // Sincroniza React state com mudanças no singleton (login/logout em outra aba).
  useEffect(() => {
    return tokenStore.subscribe(setTokens);
  }, []);

  // Marca hidratação como completa no próximo tick.
  useEffect(() => {
    setHydrating(false);
  }, []);

  const session = useMemo<SessionInfo | null>(() => {
    if (!tokens) return null;
    const claims = decodeJwt(tokens.accessToken);
    const roles = (claims?.realm_access?.roles ?? []).filter(
      (r): r is string => typeof r === 'string',
    );
    return {
      email: typeof claims?.email === 'string' ? claims.email : undefined,
      realmRoles: roles,
      hasMasterRole: roles.includes(REQUIRED_ROLE),
    };
  }, [tokens]);

  const signIn = useCallback(async (email: string, password: string) => {
    await signInWithPassword(email, password);
    // tokenStore.subscribe atualiza `tokens` automaticamente.
  }, []);

  const doSignOut = useCallback(async () => {
    await kcSignOut();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ tokens, session, hydrating, signIn, signOut: doSignOut }),
    [tokens, session, hydrating, signIn, doSignOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>.');
  return ctx;
}

interface JwtClaims {
  email?: unknown;
  realm_access?: { roles?: unknown[] };
}

function decodeJwt(jwt: string): JwtClaims | null {
  try {
    const payload = jwt.split('.')[1];
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json) as JwtClaims;
  } catch {
    return null;
  }
}
