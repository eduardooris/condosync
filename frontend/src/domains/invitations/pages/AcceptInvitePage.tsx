import { Link, useNavigate, useParams } from 'react-router-dom';
import { Controller } from 'react-hook-form';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  IdCard,
  Loader2,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
  User,
} from 'lucide-react';
import { useAcceptInvite } from '@/domains/invitations/hooks/useAcceptInvite';
import { Button } from '@/shared/components/ui/Button';
import { FieldError } from '@/shared/components/ui/FieldError';
import { Input } from '@/shared/components/ui/Input';
import { Label } from '@/shared/components/ui/Label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/Select';
import { Spinner } from '@/shared/components/ui/Spinner';

const roleLabels: Record<string, string> = {
  ADMIN: 'Síndico',
  SUB_ADMIN: 'Subsíndico',
  RESPONSIBLE: 'Responsável financeiro',
  RESIDENT: 'Morador',
};

function formatCpfInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  }
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function formatWhatsappInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length === 0) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function AcceptInvitePage() {
  const { token = '' } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { form, previewQuery, acceptMutation, submit } = useAcceptInvite(
    token,
    navigate,
  );
  const preview = previewQuery.data;
  const isLoading = previewQuery.isLoading;
  const isError = previewQuery.isError;
  const error = previewQuery.error;

  if (isLoading) {
    return (
      <PageShell>
        <Spinner size="lg" />
      </PageShell>
    );
  }

  if (isError || !preview) {
    return (
      <PageShell>
        <div className="ds-surface-elevated mx-auto max-w-md p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-ds-danger/15 text-ds-danger">
            <Clock className="h-7 w-7" />
          </div>
          <h1 className="text-ds-2xl font-bold tracking-tight text-ds-body">
            Convite inválido ou expirado
          </h1>
          <p className="mt-3 text-ds-sm text-ds-dim">
            {(error as Error | undefined)?.message ??
              'Verifique se o link está correto ou solicite um novo convite ao administrador do condomínio.'}
          </p>
          <Link to="/login" className="mt-6 inline-block">
            <Button variant="ghost">Voltar ao login</Button>
          </Link>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32 }}
        className="mx-auto w-full max-w-xl"
      >
        <header className="mb-6 flex flex-col items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-ds-xl bg-gradient-to-br from-brand-300/30 to-brand-500/10 text-brand-700 ring-1 ring-brand-400/30 dark:text-brand-300">
            <Building2 className="h-5 w-5" />
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-800 dark:text-brand-300">
            Convite recebido
          </p>
          <h1 className="text-ds-2xl font-bold tracking-tight text-ds-body ds-md:text-[28px]">
            {preview.condominiumName}
          </h1>
          <p className="text-ds-md leading-relaxed text-ds-dim">
            Você foi convidado para entrar como{' '}
            <span className="font-semibold text-ds-body">
              {roleLabels[preview.role] ?? preview.role}
            </span>
            .
            {preview.requiresApproval ? (
              <>
                {' '}Após aceitar, sua entrada será analisada por um
                administrador.
              </>
            ) : null}
          </p>
        </header>

        <div className="ds-surface-elevated p-6">
          <form className="space-y-4" onSubmit={submit} noValidate>
            <Field
              id="invite-name"
              label="Nome completo"
              icon={<User className="h-3 w-3" />}
              error={form.formState.errors.fullName?.message}
            >
              <Input
                id="invite-name"
                placeholder="Como você gostaria de ser chamado"
                autoComplete="name"
                invalid={Boolean(form.formState.errors.fullName)}
                {...form.register('fullName')}
              />
            </Field>

            <Field
              id="invite-email"
              label="E-mail"
              icon={<Mail className="h-3 w-3" />}
              error={form.formState.errors.email?.message}
            >
              <Input
                id="invite-email"
                type="email"
                autoComplete="email"
                placeholder="seu@email.com"
                invalid={Boolean(form.formState.errors.email)}
                disabled={preview.type === 'EMAIL_DIRECT'}
                value={
                  preview.type === 'EMAIL_DIRECT'
                    ? (preview.email ?? '')
                    : form.watch('email') ?? ''
                }
                onChange={(e) => form.setValue('email', e.target.value)}
              />
              {preview.type === 'EMAIL_DIRECT' ? (
                <p className="mt-1.5 text-ds-xs text-ds-subtle">
                  E-mail definido pelo administrador (não pode ser alterado).
                </p>
              ) : null}
            </Field>
            {preview.type === 'GENERIC_LINK' && !preview.unitId ? (
              <div className="space-y-1.5">
                <Label htmlFor="invite-unit">Unidade</Label>
                <Controller
                  control={form.control}
                  name="unitId"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger id="invite-unit">
                        <SelectValue placeholder="Selecione sua unidade" />
                      </SelectTrigger>
                      <SelectContent>
                        {(preview.units ?? []).map((unit) => (
                          <SelectItem key={unit.id} value={unit.id}>
                            {unit.block} - {unit.number}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {form.formState.errors.unitId ? (
                  <FieldError>{form.formState.errors.unitId.message}</FieldError>
                ) : null}
              </div>
            ) : null}

            {preview.type === 'GENERIC_LINK' ? (
              <>
                <Field
                  id="invite-cpf"
                  label="CPF"
                  icon={<IdCard className="h-3 w-3" />}
                  error={form.formState.errors.cpf?.message}
                >
                  <Controller
                    control={form.control}
                    name="cpf"
                    render={({ field }) => (
                      <Input
                        id="invite-cpf"
                        inputMode="numeric"
                        autoComplete="off"
                        placeholder="000.000.000-00"
                        invalid={Boolean(form.formState.errors.cpf)}
                        value={formatCpfInput(field.value ?? '')}
                        onChange={(e) =>
                          field.onChange(e.target.value.replace(/\D/g, ''))
                        }
                      />
                    )}
                  />
                </Field>
                <Field
                  id="invite-whatsapp"
                  label="WhatsApp"
                  icon={<Phone className="h-3 w-3" />}
                  error={form.formState.errors.phoneWhatsapp?.message}
                >
                  <Controller
                    control={form.control}
                    name="phoneWhatsapp"
                    render={({ field }) => (
                      <Input
                        id="invite-whatsapp"
                        inputMode="tel"
                        autoComplete="tel"
                        placeholder="(11) 98765-4321"
                        invalid={Boolean(form.formState.errors.phoneWhatsapp)}
                        value={formatWhatsappInput(field.value ?? '')}
                        onChange={(e) =>
                          field.onChange(e.target.value.replace(/\D/g, ''))
                        }
                      />
                    )}
                  />
                </Field>
              </>
            ) : null}

            <Field
              id="invite-password"
              label="Senha"
              icon={<Lock className="h-3 w-3" />}
              error={form.formState.errors.password?.message}
            >
              <Input
                id="invite-password"
                type="password"
                autoComplete="new-password"
                placeholder="Mínimo 8 caracteres"
                invalid={Boolean(form.formState.errors.password)}
                {...form.register('password')}
              />
            </Field>

            <Field
              id="invite-confirm"
              label="Confirmar senha"
              icon={<ShieldCheck className="h-3 w-3" />}
              error={form.formState.errors.confirmPassword?.message}
            >
              <Input
                id="invite-confirm"
                type="password"
                autoComplete="new-password"
                placeholder="Repita a senha"
                invalid={Boolean(form.formState.errors.confirmPassword)}
                {...form.register('confirmPassword')}
              />
            </Field>

            <div className="pt-2">
              <Button
                type="submit"
                variant="gradient"
                fullWidth
                disabled={acceptMutation.isPending}
              >
                {acceptMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Enviando…
                  </>
                ) : (
                  <>
                    {preview.requiresApproval ? (
                      <>
                        <CheckCircle2 className="h-4 w-4" aria-hidden />
                        Solicitar entrada
                      </>
                    ) : (
                      <>
                        Aceitar convite
                        <ArrowRight className="h-4 w-4" aria-hidden />
                      </>
                    )}
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>

        <p className="mt-6 text-center text-ds-sm text-ds-dim">
          Já tem conta?{' '}
          <Link
            to="/login"
            className="font-semibold text-brand-700 transition hover:text-brand-600 dark:text-brand-300 dark:hover:text-brand-200"
          >
            Faça login
          </Link>
        </p>
      </motion.div>
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="ds-page relative flex min-h-screen min-w-0 items-center justify-center overflow-hidden bg-ds-deep px-5 py-10 ds-md:px-10">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="ds-blob absolute -left-24 top-10 h-72 w-72 rounded-full bg-brand-400/15 blur-3xl" />
        <div className="ds-blob absolute -right-32 top-1/3 h-96 w-96 rounded-full bg-brand-500/15 blur-3xl" />
        <div className="ds-blob absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-brand-600/15 blur-3xl" />
      </div>
      <div className="relative z-10 w-full min-w-0">{children}</div>
    </main>
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
      <Label
        htmlFor={id}
        className="mb-1.5 flex items-center gap-1.5 text-ds-xs font-semibold text-ds-dim"
      >
        {icon}
        {label}
      </Label>
      {children}
      {error ? <FieldError>{error}</FieldError> : null}
    </div>
  );
}
