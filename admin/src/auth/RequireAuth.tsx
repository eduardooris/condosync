import { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './auth.context';

/**
 * Gate de acesso: força login + valida role master-admin.
 *
 *   1. Hidratando (1ª render): nada (evita flicker)
 *   2. Sem token: redireciona pro /login (guardando rota de origem)
 *   3. Com token mas sem role: tela "acesso restrito" (com botão sair)
 *   4. OK: renderiza children
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const location = useLocation();

  if (auth.hydrating) {
    return (
      <div className="flex h-dvh items-center justify-center text-fg-dim">
        Carregando…
      </div>
    );
  }

  if (!auth.tokens) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!auth.session?.hasMasterRole) {
    return (
      <div className="flex h-dvh items-center justify-center p-6">
        <div className="w-full max-w-sm rounded-lg border border-border bg-bg-surface p-6">
          <h1 className="text-lg font-semibold">Acesso restrito</h1>
          <p className="mt-2 text-sm text-fg-dim leading-relaxed">
            Sua conta ({auth.session?.email ?? 'sem email'}) não tem a role{' '}
            <code className="font-mono text-xs">master-admin</code>. Peça pro
            responsável atribuir essa role no Keycloak (Realm{' '}
            <code className="font-mono text-xs">main</code> → Users → seu user →
            Role mapping).
          </p>
          <button
            type="button"
            onClick={() => void auth.signOut()}
            className="mt-4 inline-flex h-9 items-center rounded bg-accent px-3 text-sm font-medium text-white transition hover:bg-accent-strong"
          >
            Sair
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
