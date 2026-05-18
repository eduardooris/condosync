import { useState, type FormEvent } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { Loader2, ShieldCheck, AlertCircle } from 'lucide-react';
import { useAuth } from '@/auth/auth.context';

export function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Já logado? Vai pra rota destino (ou /).
  if (auth.tokens && auth.session?.hasMasterRole) {
    const from = (location.state as { from?: string } | null)?.from ?? '/';
    return <Navigate to={from} replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await auth.signIn(email.trim(), password);
      // Após signIn, AuthContext atualiza e o redirect acima dispara no próximo render.
      // Forçamos via navigate pra evitar dependência de re-render.
      const from = (location.state as { from?: string } | null)?.from ?? '/';
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível entrar.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2 text-fg">
          <div className="h-7 w-7 rounded-md bg-accent flex items-center justify-center">
            <ShieldCheck className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-base font-semibold leading-tight">CondoSync</p>
            <p className="text-xs uppercase tracking-wider text-fg-subtle">
              back-office
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-bg-surface p-6">
          <h1 className="text-lg font-semibold">Acesso interno</h1>
          <p className="mt-1 text-sm text-fg-dim">
            Restrito a operadores com a role <code className="font-mono text-xs">master-admin</code>.
          </p>

          <form onSubmit={handleSubmit} className="mt-5 space-y-3">
            <div>
              <label htmlFor="email" className="block text-xs font-medium text-fg-dim mb-1">
                E-mail
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                disabled={loading}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-10 w-full rounded border border-border bg-bg px-3 text-sm placeholder:text-fg-subtle focus:border-accent focus:outline-none disabled:opacity-50"
                placeholder="voce@dominio.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-medium text-fg-dim mb-1">
                Senha
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                disabled={loading}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-10 w-full rounded border border-border bg-bg px-3 text-sm focus:border-accent focus:outline-none disabled:opacity-50"
              />
            </div>

            {error ? (
              <div className="flex items-start gap-2 rounded border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="mt-1 inline-flex h-10 w-full items-center justify-center gap-2 rounded bg-accent text-sm font-medium text-white transition hover:bg-accent-strong disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Entrar
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-fg-subtle">
          Use as mesmas credenciais do app principal.
        </p>
      </div>
    </div>
  );
}
