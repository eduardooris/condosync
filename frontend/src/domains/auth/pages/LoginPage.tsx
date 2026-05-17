import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { LogIn, Mail, Lock, Sparkles, Loader2 } from 'lucide-react';
import { BrandMark } from '@/shared/components/ui/BrandMark';
import { useState } from 'react';
import type { AxiosError } from 'axios';
import { authService } from '@/domains/auth/services/auth.service';
import { condominiumsService } from '@/domains/condominiums/services/condominiums.service';
import { loginSchema, type LoginInput } from '@/domains/auth/schemas/login.schema';
import { Button } from '@/shared/components/ui/Button';
import { FieldError } from '@/shared/components/ui/FieldError';
import { Input } from '@/shared/components/ui/Input';
import { Label } from '@/shared/components/ui/Label';
import { useAuthStore } from '@/shared/stores/auth.store';
import { canCreateCondominiumFromJwt, extractRoleFromJwt } from '@/shared/utils/auth';

const features = [
  'Gestão financeira com transparência total+',
  'Cobranças automáticas via WhatsApp',
  'Enquetes e governança digital',
  'Ocorrências com status em tempo real',
];

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const setAuth = useAuthStore((state) => state.setAuth);
  const setActiveCondominium = useAuthStore((state) => state.setActiveCondominium);
  const setPendingMemberships = useAuthStore((state) => state.setPendingMemberships);
  const [showPassword, setShowPassword] = useState(false);
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const flashMessage = (location.state as { flash?: string } | null)?.flash;

  const onSubmit = form.handleSubmit(async (data) => {
    try {
      const login = await authService.login(data);
      const role = extractRoleFromJwt(login.accessToken);
      const canCreateCondominium = canCreateCondominiumFromJwt(login.accessToken);
      // Persistimos o token ANTES das próximas chamadas — o interceptor do
      // axios lê o token do store em request-time. Sem isso, `me` e
      // `listCondominiums` saem sem Authorization e a API responde 401.
      setAuth({
        user: { id: '', name: '', email: data.email },
        token: login.accessToken,
        refreshToken: login.refreshToken,
        role,
        canCreateCondominium,
      });
      const [me, condominiums, pendingMemberships] = await Promise.all([
        authService.me(),
        authService.listCondominiums().catch(() => []),
        condominiumsService.listMyPending().catch(() => []),
      ]);
      const resolvedEmail = me.email?.trim() || data.email.trim();
      const displayName =
        me.fullName?.trim() ||
        (resolvedEmail.includes('@')
          ? resolvedEmail.slice(0, resolvedEmail.indexOf('@'))
          : resolvedEmail) ||
        'Usuário';
      setAuth({
        user: { id: me.id, name: displayName, email: resolvedEmail },
        token: login.accessToken,
        refreshToken: login.refreshToken,
        role,
        canCreateCondominium,
      });
      const first = condominiums[0];
      setPendingMemberships(pendingMemberships);
      setActiveCondominium(
        first
          ? {
              id: first.id,
              name: first.name,
              role: first.role,
              unitId: first.unitId,
            }
          : null,
      );
      if (!first && pendingMemberships.length > 0) {
        toast('Seu acesso está pendente de aprovação pelo administrador do condomínio.', {
          icon: '⏳',
        });
      }
      navigate('/', { replace: true });
    } catch (error) {
      const apiError = error as AxiosError<{ message?: string }> | undefined;
      const message = apiError?.response?.data?.message;
      toast.error(message || 'Falha ao autenticar. Verifique suas credenciais.');
    }
  });

  const eId = 'login-email';
  const pId = 'login-password';

  return (
    <main className="ds-page relative flex min-h-screen min-w-0 overflow-hidden">
      <div className="pointer-events-none absolute -left-32 -top-20 h-96 w-96 rounded-full bg-brand-400/15 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -right-20 top-1/3 h-80 w-80 rounded-full bg-brand-300/10 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute bottom-0 left-1/2 h-64 w-96 -translate-x-1/2 rounded-full bg-brand-600/15 blur-3xl" aria-hidden />

      <div className="hidden flex-1 flex-col justify-between p-12 ds-lg:flex">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <div className="flex items-center gap-3">
            <BrandMark size="md" rounded="xl" />
            <div>
              <span className="block text-ds-lg font-extrabold tracking-tight text-ds-body">CondoSync</span>
              <span className="block text-[10px] font-semibold uppercase tracking-widest text-ds-dim dark:text-brand-300/70">
                Gestão inteligente
              </span>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
          className="space-y-6"
        >
          <div>
            <h1 className="text-ds-display font-extrabold leading-tight tracking-tight text-ds-body">
              Gerencie seu
              <br />
              condomínio com
              <br />
              <span className="bg-gradient-to-r from-brand-700 via-brand-500 to-brand-600 bg-clip-text text-transparent dark:from-brand-300 dark:via-brand-300 dark:to-brand-200">
                inteligência.
              </span>
            </h1>
            <p className="mt-4 max-w-sm text-ds-md leading-relaxed text-ds-dim">
              Plataforma digital para síndicos. Simples, transparente e eficiente.
            </p>
          </div>

          <ul className="space-y-3">
            {features.map((f, i) => (
              <motion.li
                key={f}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.08, duration: 0.3 }}
                className="flex items-center gap-3 text-ds-sm text-ds-dim"
              >
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-400/20">
                  <Sparkles className="h-2.5 w-2.5 text-brand-700 dark:text-brand-300" aria-hidden />
                </div>
                {f}
              </motion.li>
            ))}
          </ul>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-ds-xs text-ds-subtle/70"
        >
          © {new Date().getFullYear()} CondoSync · Atende+
        </motion.p>
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-center px-5 py-12 ds-lg:max-w-md ds-lg:border-l ds-lg:border-ds-stroke ds-lg:bg-gradient-to-b ds-lg:from-white/[0.02] ds-lg:to-transparent">
        <motion.div
          className="ds-page w-full max-w-sm"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <div className="mb-8 flex items-center gap-3 ds-lg:hidden">
            <BrandMark size="sm" rounded="xl" />
            <span className="text-ds-lg font-extrabold tracking-tight text-ds-body">CondoSync</span>
          </div>

          <div className="mb-7">
            <h2 className="text-ds-2xl font-extrabold tracking-tight text-ds-body">Boas-vindas</h2>
            <p className="mt-1 text-ds-sm text-ds-dim">Acesse sua conta para continuar.</p>
            {flashMessage ? (
              <div className="mt-4 rounded-ds-lg border border-ds-success/30 bg-ds-success/10 px-3 py-2 text-ds-xs text-ds-success">
                {flashMessage}
              </div>
            ) : null}
          </div>

          <div className="ds-surface-elevated p-6">
            <form className="space-y-4" onSubmit={onSubmit} noValidate>
              <div>
                <Label htmlFor={eId} className="mb-1.5 flex items-center gap-1.5 text-ds-xs font-semibold text-ds-dim">
                  <Mail className="h-3 w-3" aria-hidden />
                  E-mail
                </Label>
                <Input
                  id={eId}
                  type="email"
                  autoComplete="email"
                  placeholder="seu@email.com"
                  invalid={Boolean(form.formState.errors.email)}
                  aria-describedby={form.formState.errors.email ? `${eId}-err` : undefined}
                  {...form.register('email')}
                />
                {form.formState.errors.email?.message ? (
                  <FieldError id={`${eId}-err`}>{form.formState.errors.email.message}</FieldError>
                ) : null}
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <Label htmlFor={pId} className="flex items-center gap-1.5 text-ds-xs font-semibold text-ds-dim">
                    <Lock className="h-3 w-3" aria-hidden />
                    Senha
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowPassword((v) => !v)}
                    className="h-auto px-0 text-brand-700 hover:text-brand-600 dark:text-brand-300 dark:hover:text-brand-200"
                  >
                    {showPassword ? 'Ocultar' : 'Mostrar'}
                  </Button>
                </div>
                <Input
                  id={pId}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  invalid={Boolean(form.formState.errors.password)}
                  aria-describedby={form.formState.errors.password ? `${pId}-err` : undefined}
                  {...form.register('password')}
                />
                {form.formState.errors.password?.message ? (
                  <FieldError id={`${pId}-err`}>{form.formState.errors.password.message}</FieldError>
                ) : null}
              </div>

              <div className="flex items-center justify-end">
                <Link
                  to="/forgot-password"
                  className="text-ds-xs font-medium text-brand-700 transition hover:text-brand-600 dark:text-brand-300 dark:hover:text-brand-200"
                >
                  Esqueci minha senha
                </Link>
              </div>

              <Button
                type="submit"
                variant="gradient"
                fullWidth
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Entrando…
                  </>
                ) : (
                  <>
                    <LogIn className="h-4 w-4" aria-hidden />
                    Acessar
                  </>
                )}
              </Button>
            </form>
          </div>

          <div className="mt-6 text-center">
            <p className="text-ds-sm text-ds-dim">
              Ainda não tem conta?{' '}
              <Link
                to="/register"
                className="font-semibold text-brand-700 transition hover:text-brand-600 dark:text-brand-300 dark:hover:text-brand-200"
              >
                Criar conta grátis
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </main>
  );
}
