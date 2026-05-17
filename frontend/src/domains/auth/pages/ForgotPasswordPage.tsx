import { motion, useReducedMotion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Loader2, Mail } from 'lucide-react';
import { BrandMark } from '@/shared/components/ui/BrandMark';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { authService } from '@/domains/auth/services/auth.service';
import {
  forgotPasswordSchema,
  type ForgotPasswordFormInput,
} from '@/domains/auth/schemas/forgot-password.schema';
import { Button } from '@/shared/components/ui/Button';
import { FieldError } from '@/shared/components/ui/FieldError';
import { Input } from '@/shared/components/ui/Input';
import { Label } from '@/shared/components/ui/Label';

/** Mascara e-mail na tela de sucesso (evita expor endereço completo). */
function maskEmailHint(email: string): string {
  const trimmed = email.trim();
  const at = trimmed.indexOf('@');
  if (at <= 0) return '••••';
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  const vis = local.slice(0, 2);
  return `${vis}•••@${domain}`;
}

export function ForgotPasswordPage() {
  const reduce = useReducedMotion();
  const [submittedHint, setSubmittedHint] = useState<string | null>(null);
  const form = useForm<ForgotPasswordFormInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = form.handleSubmit(async (data) => {
    try {
      await authService.forgotPassword({ email: data.email });
      setSubmittedHint(maskEmailHint(data.email));
    } catch {
      toast.error('Não foi possível processar a solicitação. Tente novamente em instantes.');
    }
  });

  return (
    <main className="ds-page relative flex min-h-screen min-w-0 flex-col items-center justify-center overflow-hidden px-5 py-12">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="ds-blob absolute -left-32 top-10 h-72 w-72 rounded-full bg-brand-400/15 blur-3xl" />
        <div className="ds-blob absolute -right-32 bottom-10 h-80 w-80 rounded-full bg-brand-600/15 blur-3xl" />
      </div>

      <Link to="/login" className="absolute left-5 top-5 flex items-center gap-2 text-ds-xs font-semibold text-ds-dim transition hover:text-ds-body ds-md:left-10 ds-md:top-7">
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
        {submittedHint ? (
          <div className="ds-surface-elevated p-8 text-center">
            <motion.div
              initial={reduce ? false : { scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 220, damping: 18 }}
              className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-emerald-300 to-emerald-500 shadow-lg shadow-emerald-500/40"
            >
              <CheckCircle2 className="h-7 w-7 text-white" strokeWidth={2.25} aria-hidden />
            </motion.div>
            <h1 className="text-ds-xl font-bold tracking-tight text-ds-body">Verifique o WhatsApp</h1>
            <p className="mx-auto mt-2 max-w-sm text-ds-sm leading-relaxed text-ds-dim">
              Se existir conta para <strong>{submittedHint}</strong>, enviamos um link para redefinir a senha ao
              WhatsApp cadastrado no perfil do morador vinculado a essa conta. O link expira em 1 hora.
            </p>
            <p className="mx-auto mt-3 max-w-sm text-ds-xs text-ds-subtle">
              O envio não é por e-mail: use o mesmo número de WhatsApp que consta no cadastro do morador ou do
              responsável financeiro.
            </p>
            <Link to="/login" className="mt-6 inline-block">
              <Button variant="secondary">Voltar para o login</Button>
            </Link>
          </div>
        ) : (
          <div className="ds-surface-elevated p-8">
            <div className="mb-5 flex flex-col gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-800 dark:text-brand-300">
                Recuperar acesso
              </p>
              <h1 className="text-ds-2xl font-bold tracking-tight text-ds-body">Esqueceu a senha?</h1>
              <p className="text-ds-sm leading-relaxed text-ds-dim">
                Informe o <strong>e-mail da sua conta</strong>. Se encontrarmos o cadastro, enviaremos o link de
                redefinição por <strong>WhatsApp</strong> (número do morador ou responsável financeiro vinculado ao seu
                usuário).
              </p>
            </div>
            <form className="space-y-4" onSubmit={onSubmit} noValidate>
              <div>
                <Label htmlFor="forgot-email" className="mb-1.5 flex items-center gap-1.5 text-ds-xs font-semibold text-ds-dim">
                  <Mail className="h-3 w-3" aria-hidden />
                  E-mail da conta
                </Label>
                <Input
                  id="forgot-email"
                  type="email"
                  autoComplete="email"
                  placeholder="seu@email.com"
                  invalid={Boolean(form.formState.errors.email)}
                  {...form.register('email')}
                />
                {form.formState.errors.email?.message ? (
                  <FieldError>{form.formState.errors.email.message}</FieldError>
                ) : null}
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
                    Enviando…
                  </>
                ) : (
                  'Enviar link por WhatsApp'
                )}
              </Button>
            </form>
          </div>
        )}
      </motion.div>
    </main>
  );
}
