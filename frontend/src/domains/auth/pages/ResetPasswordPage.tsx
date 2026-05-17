import { motion, useReducedMotion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, KeyRound, Loader2 } from 'lucide-react';
import { BrandMark } from '@/shared/components/ui/BrandMark';
import { useEffect } from 'react';
import toast from 'react-hot-toast';
import { authService } from '@/domains/auth/services/auth.service';
import {
  resetPasswordSchema,
  type ResetPasswordFormInput,
} from '@/domains/auth/schemas/reset-password.schema';
import { Button } from '@/shared/components/ui/Button';
import { FieldError } from '@/shared/components/ui/FieldError';
import { Input } from '@/shared/components/ui/Input';
import { Label } from '@/shared/components/ui/Label';

export function ResetPasswordPage() {
  const reduce = useReducedMotion();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token')?.trim() ?? '';

  const form = useForm<ResetPasswordFormInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  useEffect(() => {
    if (!token) {
      toast.error('Link inválido. Solicite uma nova recuperação de senha.');
      navigate('/forgot-password', { replace: true });
    }
  }, [token, navigate]);

  const onSubmit = form.handleSubmit(async (data) => {
    if (!token) return;
    try {
      await authService.resetPassword({ token, password: data.password });
      toast.success('Senha atualizada. Faça login com a nova senha.');
      navigate('/login', { replace: true });
    } catch {
      toast.error('Não foi possível redefinir a senha. O link pode ter expirado.');
    }
  });

  if (!token) {
    return null;
  }

  return (
    <main className="ds-page relative flex min-h-screen min-w-0 flex-col items-center justify-center overflow-hidden px-5 py-12">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="ds-blob absolute -left-32 top-10 h-72 w-72 rounded-full bg-brand-400/15 blur-3xl" />
        <div className="ds-blob absolute -right-32 bottom-10 h-80 w-80 rounded-full bg-brand-600/15 blur-3xl" />
      </div>

      <Link
        to="/login"
        className="absolute left-5 top-5 flex items-center gap-2 text-ds-xs font-semibold text-ds-dim transition hover:text-ds-body ds-md:left-10 ds-md:top-7"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        Voltar ao login
      </Link>

      <div className="absolute right-5 top-5 flex items-center gap-2 ds-md:right-10 ds-md:top-7">
        <BrandMark size="sm" rounded="lg" />
        <span className="text-ds-md font-bold text-ds-body">CondoSync</span>
      </div>

      <motion.div
        initial={reduce ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32 }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="ds-surface-elevated p-8">
          <div className="mb-5 flex flex-col gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-800 dark:text-brand-300">
              Nova senha
            </p>
            <h1 className="text-ds-2xl font-bold tracking-tight text-ds-body">Redefinir senha</h1>
            <p className="text-ds-sm leading-relaxed text-ds-dim">
              Escolha uma senha forte. Ela vale para o login com o e-mail da sua conta.
            </p>
          </div>
          <form className="space-y-4" onSubmit={onSubmit} noValidate>
            <div>
              <Label
                htmlFor="reset-password"
                className="mb-1.5 flex items-center gap-1.5 text-ds-xs font-semibold text-ds-dim"
              >
                <KeyRound className="h-3 w-3" aria-hidden />
                Nova senha
              </Label>
              <Input
                id="reset-password"
                type="password"
                autoComplete="new-password"
                invalid={Boolean(form.formState.errors.password)}
                {...form.register('password')}
              />
              {form.formState.errors.password?.message ? (
                <FieldError>{form.formState.errors.password.message}</FieldError>
              ) : null}
            </div>
            <div>
              <Label htmlFor="reset-password-confirm" className="mb-1.5 text-ds-xs font-semibold text-ds-dim">
                Confirmar senha
              </Label>
              <Input
                id="reset-password-confirm"
                type="password"
                autoComplete="new-password"
                invalid={Boolean(form.formState.errors.confirmPassword)}
                {...form.register('confirmPassword')}
              />
              {form.formState.errors.confirmPassword?.message ? (
                <FieldError>{form.formState.errors.confirmPassword.message}</FieldError>
              ) : null}
            </div>
            <Button type="submit" variant="gradient" fullWidth disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Salvando…
                </>
              ) : (
                'Salvar nova senha'
              )}
            </Button>
          </form>
        </div>
      </motion.div>
    </main>
  );
}
