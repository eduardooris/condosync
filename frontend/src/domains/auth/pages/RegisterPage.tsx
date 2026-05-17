import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  User,
} from 'lucide-react';
import { BrandMark } from '@/shared/components/ui/BrandMark';
import { useMemo, useState } from 'react';
import { authService } from '@/domains/auth/services/auth.service';
import {
  registerSchema,
  type RegisterFormInput,
} from '@/domains/auth/schemas/register.schema';
import { Button } from '@/shared/components/ui/Button';
import { FieldError } from '@/shared/components/ui/FieldError';
import { Input } from '@/shared/components/ui/Input';
import { Label } from '@/shared/components/ui/Label';
import { useAuthStore } from '@/shared/stores/auth.store';
import { canCreateCondominiumFromJwt, extractRoleFromJwt } from '@/shared/utils/auth';
import { cn } from '@/shared/utils/cn';

type Stage = 'identity' | 'credentials' | 'review' | 'success';

const stageOrder: Stage[] = ['identity', 'credentials', 'review'];
const stageLabels: Record<Exclude<Stage, 'success'>, string> = {
  identity: 'Você',
  credentials: 'Acesso',
  review: 'Confirmação',
};

function passwordStrength(password: string): { score: number; label: string; tone: string } {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  if (password.length >= 14) score += 1;
  const label =
    score <= 1 ? 'Fraca' : score === 2 ? 'Razoável' : score === 3 ? 'Boa' : 'Excelente';
  const tone =
    score <= 1
      ? 'bg-ds-danger'
      : score === 2
        ? 'bg-ds-warning'
        : score === 3
          ? 'bg-ds-info'
          : 'bg-ds-success';
  return { score: Math.min(score, 5), label, tone };
}

export function RegisterPage() {
  const reduce = useReducedMotion();
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const setActiveCondominium = useAuthStore((s) => s.setActiveCondominium);

  const [stage, setStage] = useState<Stage>('identity');
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<RegisterFormInput>({
    resolver: zodResolver(registerSchema),
    mode: 'onChange',
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
      confirmPassword: '',
      acceptTerms: false,
    },
  });

  const password = useWatch({ control: form.control, name: 'password' }) ?? '';
  const strength = useMemo(() => passwordStrength(password), [password]);

  const onAdvance = async () => {
    if (stage === 'identity') {
      const ok = await form.trigger(['fullName', 'email']);
      if (ok) setStage('credentials');
      return;
    }
    if (stage === 'credentials') {
      const ok = await form.trigger(['password', 'confirmPassword']);
      if (ok) setStage('review');
    }
  };

  const onBack = () => {
    if (stage === 'credentials') setStage('identity');
    else if (stage === 'review') setStage('credentials');
  };

  const onSubmit = form.handleSubmit(async (data) => {
    setSubmitting(true);
    try {
      const result = await authService.register({
        fullName: data.fullName,
        email: data.email,
        password: data.password,
      });

      if (result.requiresEmailConfirmation || !result.accessToken) {
        setStage('success');
        return;
      }

      const role = extractRoleFromJwt(result.accessToken);
      const canCreateCondominium = canCreateCondominiumFromJwt(result.accessToken);
      setAuth({
        user: { id: result.userId, name: data.fullName, email: result.email },
        token: result.accessToken,
        refreshToken: result.refreshToken,
        role,
        canCreateCondominium,
      });
      setActiveCondominium(null);
      toast.success('Conta criada! Vamos configurar seu condomínio.');
      // ProtectedLayout decide entre /setup e /no-condo com base em
      // canCreateCondominium (do JWT) e nas memberships APROVADOS/PENDING.
      navigate('/', { replace: true });
    } catch {
      toast.error('Não foi possível criar sua conta. Verifique os dados e tente novamente.');
    } finally {
      setSubmitting(false);
    }
  });

  const currentIndex = stage === 'success' ? stageOrder.length : stageOrder.indexOf(stage);
  const progress = stage === 'success' ? 100 : ((currentIndex + 1) / stageOrder.length) * 100;

  return (
    <main className="ds-page relative flex min-h-screen min-w-0 flex-col overflow-hidden bg-ds-deep">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="ds-blob absolute -left-24 top-10 h-72 w-72 rounded-full bg-brand-400/15 blur-3xl" />
        <div className="ds-blob absolute -right-32 top-1/3 h-96 w-96 rounded-full bg-brand-500/15 blur-3xl" />
        <div className="ds-blob absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-brand-600/15 blur-3xl" />
      </div>

      <header className="relative z-10 flex items-center justify-between px-5 pt-5 ds-md:px-10 ds-md:pt-7">
        <Link to="/login" className="flex items-center gap-2.5">
          <BrandMark size="sm" rounded="lg" />
          <div className="leading-tight">
            <p className="text-ds-md font-bold tracking-tight text-ds-body">CondoSync</p>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-ds-dim dark:text-brand-300/70">
              Criar conta
            </p>
          </div>
        </Link>
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 rounded-ds-lg border border-ds-stroke px-3 py-1.5 text-ds-xs font-semibold text-ds-dim transition hover:border-ds-stroke-strong hover:text-ds-body"
        >
          Já tenho conta
        </Link>
      </header>

      {stage !== 'success' ? (
        <div className="relative z-10 mt-6 px-5 ds-md:px-10">
          <div className="mx-auto flex max-w-xl items-center gap-3">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-ds-dim dark:text-brand-300/70">
              Passo {currentIndex + 1} de {stageOrder.length}
            </span>
            <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-ds-surface dark:bg-white/[0.05]">
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-brand-300 to-brand-500"
                initial={false}
                animate={{ width: `${progress}%` }}
                transition={{ duration: reduce ? 0 : 0.4, ease: [0.25, 0.1, 0.25, 1] }}
              />
            </div>
            <span className="text-[11px] font-semibold uppercase tracking-widest text-ds-dim dark:text-brand-300/70">
              {stageLabels[stage as Exclude<Stage, 'success'>]}
            </span>
          </div>
        </div>
      ) : null}

      <section className="relative z-10 flex flex-1 items-center justify-center px-5 py-10 ds-md:px-10">
        <div className="mx-auto w-full min-w-0 max-w-xl">
          <AnimatePresence mode="wait">
            {stage === 'identity' ? (
              <StageWrapper key="identity" reduce={reduce}>
                <StageHeader
                  icon={<User className="h-5 w-5" />}
                  eyebrow="Vamos nos conhecer"
                  title="Quem é você?"
                  description="Comece com seu nome e e-mail principal. Usaremos para personalizar a experiência."
                />
                <div className="ds-surface-elevated mt-6 space-y-4 p-6">
                  <Field
                    id="reg-name"
                    label="Nome completo"
                    icon={<User className="h-3 w-3" />}
                    error={form.formState.errors.fullName?.message}
                  >
                    <Input
                      id="reg-name"
                      placeholder="Como você gostaria de ser chamado"
                      autoComplete="name"
                      invalid={Boolean(form.formState.errors.fullName)}
                      {...form.register('fullName')}
                    />
                  </Field>
                  <Field
                    id="reg-email"
                    label="E-mail"
                    icon={<Mail className="h-3 w-3" />}
                    error={form.formState.errors.email?.message}
                  >
                    <Input
                      id="reg-email"
                      type="email"
                      autoComplete="email"
                      placeholder="seu@email.com"
                      invalid={Boolean(form.formState.errors.email)}
                      {...form.register('email')}
                    />
                  </Field>
                </div>
                <FooterNav onNext={onAdvance} nextLabel="Continuar" />
              </StageWrapper>
            ) : null}

            {stage === 'credentials' ? (
              <StageWrapper key="credentials" reduce={reduce}>
                <StageHeader
                  icon={<ShieldCheck className="h-5 w-5" />}
                  eyebrow="Sua segurança importa"
                  title="Crie uma senha forte"
                  description="Escolha uma senha que só você consiga lembrar. Combine letras, números e, se possível, símbolos."
                />
                <div className="ds-surface-elevated mt-6 space-y-4 p-6">
                  <Field
                    id="reg-password"
                    label="Senha"
                    icon={<Lock className="h-3 w-3" />}
                    error={form.formState.errors.password?.message}
                  >
                    <Input
                      id="reg-password"
                      type="password"
                      autoComplete="new-password"
                      placeholder="Mínimo 8 caracteres"
                      invalid={Boolean(form.formState.errors.password)}
                      {...form.register('password')}
                    />
                    {password ? (
                      <div className="mt-2 space-y-1">
                        <div className="flex h-1 gap-1">
                          {Array.from({ length: 5 }, (_, i) => (
                            <div
                              key={i}
                              className={cn(
                                'h-1 flex-1 rounded-full transition-colors',
                                i < strength.score ? strength.tone : 'bg-white/[0.05]',
                              )}
                            />
                          ))}
                        </div>
                        <p className="text-[11px] font-medium uppercase tracking-widest text-ds-subtle">
                          Força: <span className="text-ds-dim">{strength.label}</span>
                        </p>
                      </div>
                    ) : null}
                  </Field>
                  <Field
                    id="reg-confirm"
                    label="Confirme sua senha"
                    icon={<Lock className="h-3 w-3" />}
                    error={form.formState.errors.confirmPassword?.message}
                  >
                    <Input
                      id="reg-confirm"
                      type="password"
                      autoComplete="new-password"
                      placeholder="Repita a senha"
                      invalid={Boolean(form.formState.errors.confirmPassword)}
                      {...form.register('confirmPassword')}
                    />
                  </Field>
                </div>
                <FooterNav onBack={onBack} onNext={onAdvance} nextLabel="Continuar" />
              </StageWrapper>
            ) : null}

            {stage === 'review' ? (
              <StageWrapper key="review" reduce={reduce}>
                <StageHeader
                  icon={<Sparkles className="h-5 w-5" />}
                  eyebrow="Quase lá"
                  title="Tudo certo?"
                  description="Confira os dados antes de criar sua conta. Você poderá editar tudo no painel depois."
                />
                <div className="ds-surface-elevated mt-6 space-y-3 p-6">
                  <ReviewRow label="Nome" value={form.getValues('fullName')} />
                  <ReviewRow label="E-mail" value={form.getValues('email')} />
                  <ReviewRow label="Senha" value="••••••••" />
                  <label className="mt-2 flex cursor-pointer items-start gap-2.5 rounded-ds-lg border border-ds-stroke bg-white/[0.02] p-3 transition hover:border-ds-stroke-strong">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 cursor-pointer rounded border-ds-stroke bg-transparent text-ds-action focus:ring-ds-focus"
                      {...form.register('acceptTerms')}
                    />
                    <span className="text-ds-xs leading-relaxed text-ds-dim">
                      Li e concordo com os{' '}
                      <a
                        className="font-semibold text-brand-700 hover:text-brand-600 dark:text-brand-300 dark:hover:text-brand-200"
                        href="#"
                      >
                        Termos de uso
                      </a>{' '}
                      e a{' '}
                      <a
                        className="font-semibold text-brand-700 hover:text-brand-600 dark:text-brand-300 dark:hover:text-brand-200"
                        href="#"
                      >
                        Política de privacidade
                      </a>
                      .
                    </span>
                  </label>
                  {form.formState.errors.acceptTerms?.message ? (
                    <FieldError>{form.formState.errors.acceptTerms.message}</FieldError>
                  ) : null}
                </div>

                <div className="mx-auto mt-6 flex max-w-xl flex-col-reverse gap-2 ds-sm:flex-row ds-sm:items-center ds-sm:justify-end">
                  <Button variant="ghost" type="button" onClick={onBack}>
                    <ArrowLeft className="h-4 w-4" aria-hidden />
                    Voltar
                  </Button>
                  <Button
                    variant="gradient"
                    type="button"
                    onClick={() => void onSubmit()}
                    disabled={submitting}
                    className="min-w-[12rem]"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        Criando conta…
                      </>
                    ) : (
                      <>
                        Criar minha conta
                        <ArrowRight className="h-4 w-4" aria-hidden />
                      </>
                    )}
                  </Button>
                </div>
              </StageWrapper>
            ) : null}

            {stage === 'success' ? (
              <StageWrapper key="success" reduce={reduce}>
                <div className="ds-surface-elevated mx-auto max-w-md p-8 text-center">
                  <motion.div
                    initial={reduce ? false : { scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 220, damping: 18 }}
                    className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-300 to-emerald-500 shadow-lg shadow-emerald-500/40"
                  >
                    <CheckCircle2 className="h-8 w-8 text-white" strokeWidth={2.25} aria-hidden />
                  </motion.div>
                  <h2 className="text-ds-2xl font-bold tracking-tight text-ds-body">
                    Confirme seu e-mail
                  </h2>
                  <p className="mx-auto mt-3 max-w-sm text-ds-sm leading-relaxed text-ds-dim">
                    Enviamos um link para <strong>{form.getValues('email')}</strong>. Clique nele para
                    ativar sua conta e depois faça login para configurar seu condomínio.
                  </p>
                  <div className="mt-6 flex flex-col gap-2 ds-sm:flex-row ds-sm:justify-center">
                    <Button
                      variant="gradient"
                      onClick={() =>
                        navigate('/login', {
                          state: { flash: 'Confirme seu e-mail e faça login para continuar.' },
                          replace: true,
                        })
                      }
                    >
                      Ir para o login
                    </Button>
                  </div>
                </div>
              </StageWrapper>
            ) : null}
          </AnimatePresence>
        </div>
      </section>
    </main>
  );
}

function StageWrapper({ children, reduce }: { children: React.ReactNode; reduce: boolean | null }) {
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduce ? undefined : { opacity: 0, y: -8 }}
      transition={{ duration: 0.32, ease: [0.25, 0.1, 0.25, 1] }}
    >
      {children}
    </motion.div>
  );
}

function StageHeader({
  icon,
  eyebrow,
  title,
  description,
}: {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <header className="flex flex-col items-start gap-3">
      <div className="flex h-11 w-11 items-center justify-center rounded-ds-xl bg-gradient-to-br from-brand-300/30 to-brand-500/10 text-brand-700 ring-1 ring-brand-400/30 dark:text-brand-300">
        {icon}
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-800 dark:text-brand-300">
        {eyebrow}
      </p>
      <h1 className="text-ds-2xl font-bold tracking-tight text-ds-body ds-md:text-[28px]">
        {title}
      </h1>
      <p className="text-ds-md leading-relaxed text-ds-dim">{description}</p>
    </header>
  );
}

function Field({
  id,
  label,
  icon,
  error,
  children,
}: {
  id: string;
  label: string;
  icon?: React.ReactNode;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label htmlFor={id} className="mb-1.5 flex items-center gap-1.5 text-ds-xs font-semibold text-ds-dim">
        {icon}
        {label}
      </Label>
      {children}
      {error ? <FieldError>{error}</FieldError> : null}
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-ds-lg border border-ds-stroke bg-white/[0.015] px-3.5 py-2.5">
      <span className="text-ds-xs font-medium uppercase tracking-widest text-ds-subtle">{label}</span>
      <span className="truncate pl-3 text-ds-sm font-semibold text-ds-body">{value || '—'}</span>
    </div>
  );
}

function FooterNav({
  onBack,
  onNext,
  nextLabel,
}: {
  onBack?: () => void;
  onNext: () => void;
  nextLabel: string;
}) {
  return (
    <div className="mx-auto mt-6 flex max-w-xl flex-col-reverse gap-2 ds-sm:flex-row ds-sm:items-center ds-sm:justify-end">
      {onBack ? (
        <Button variant="ghost" type="button" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Voltar
        </Button>
      ) : null}
      <Button variant="gradient" type="button" onClick={onNext} className="min-w-[10rem]">
        {nextLabel}
        <ArrowRight className="h-4 w-4" aria-hidden />
      </Button>
    </div>
  );
}
