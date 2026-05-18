import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ExternalLink, Landmark, RefreshCw, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/shared/components/ui/Button';
import { FormField } from '@/shared/components/ui/FormField';
import { Input } from '@/shared/components/ui/Input';
import { NativeSelect } from '@/shared/components/ui/NativeSelect';
import { SetupShell } from '@/domains/setup/components/SetupShell';
import { useSetupStore } from '@/domains/setup/store/setup.store';
import { useAuthStore } from '@/shared/stores/auth.store';
import { usePaymentAccount } from '@/domains/payments/hooks/usePaymentAccount';
import {
  PaymentAccountStatusBadge,
  paymentAccountStatusLabel,
} from '@/domains/payments/components/PaymentAccountStatusBadge';
import type {
  CreatePaymentAccountInput,
  PaymentAccountHolderType,
} from '@/domains/payments/services/payment-accounts.service';
import { cn } from '@/shared/utils/cn';

interface StepPaymentsProps {
  onBack: () => void;
  onContinue: () => void;
}

interface FormValues {
  holderType: PaymentAccountHolderType;
  cpfCnpj: string;
  legalName: string;
  birthDate?: string;
  email: string;
  mobilePhone: string;
  incomeValue: string;
  street: string;
  number: string;
  complement?: string;
  province: string;
  city: string;
  state: string;
  postalCode: string;
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

const HOLDER_TYPE_OPTIONS: {
  value: PaymentAccountHolderType;
  label: string;
  hint: string;
}[] = [
  { value: 'PF', label: 'Pessoa Física', hint: 'Recebe no CPF do síndico' },
  { value: 'MEI', label: 'MEI', hint: 'Microempresa do síndico' },
  { value: 'PJ', label: 'Pessoa Jurídica', hint: 'Recebe no CNPJ do condomínio' },
];

export function StepPayments({ onBack, onContinue }: StepPaymentsProps) {
  const condominiumId = useSetupStore((s) => s.condominiumId) ?? undefined;
  // Dados que o síndico já forneceu na identidade do condomínio + auth.
  // Servem como sugestão pra evitar redigitar tudo na criação da subconta.
  const condoIdentity = useSetupStore((s) => s.identity);
  const authUser = useAuthStore((s) => s.user);
  const {
    account,
    isLoading,
    createMutation,
    refreshMutation,
    refreshOnboardingMutation,
  } = usePaymentAccount(condominiumId);

  // Formulário só aparece quando ainda não criamos (ou se a tentativa anterior foi REJECTED).
  const showForm = !account || account.status === 'REJECTED';

  /**
   * Inferência do tipo de titular a partir do `cnpj` do condomínio:
   *   - 14 dígitos → PJ
   *   - 11 dígitos → PF (síndico recebe em CPF próprio)
   *   - vazio → PF (default — assume síndico informal)
   */
  const inferredHolderType: PaymentAccountHolderType = (() => {
    const len = condoIdentity.cnpj?.length ?? 0;
    if (len === 14) return 'PJ';
    return 'PF';
  })();

  const { register, handleSubmit, control, watch, setValue, formState } =
    useForm<FormValues>({
      // Pré-popula com o que o síndico já preencheu na etapa de identidade
      // do condomínio + perfil dele. Quanto menos redigitação, melhor.
      defaultValues: {
        holderType: inferredHolderType,
        cpfCnpj: condoIdentity.cnpj ?? '',
        legalName:
          inferredHolderType === 'PJ'
            ? condoIdentity.name
            : (authUser?.name ?? ''),
        birthDate: '',
        email: authUser?.email ?? '',
        mobilePhone: condoIdentity.adminContactPhone ?? '',
        incomeValue: '',
        street: condoIdentity.address?.street ?? '',
        number: condoIdentity.address?.number ?? '',
        complement: condoIdentity.address?.complement ?? '',
        province: '',
        city: condoIdentity.address?.city ?? '',
        state: condoIdentity.address?.state?.toUpperCase() ?? '',
        postalCode: digitsOnly(condoIdentity.address?.zip ?? ''),
      },
    });

  const holderType = watch('holderType');
  const cpfCnpjMaxLen = holderType === 'PJ' ? 14 : 11;

  // Indica se o pré-preenchimento (silencioso, via defaultValues) tinha dados
  // relevantes para mostrar um aviso amigável.
  const prefilledFromCondo = Boolean(
    condoIdentity.name ||
      condoIdentity.cnpj ||
      condoIdentity.adminContactPhone ||
      condoIdentity.address?.street,
  );

  const formatBrlInput = (raw: string): string => {
    const d = digitsOnly(raw);
    if (!d) return '';
    const n = Number(d) / 100;
    return n.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  };

  const onSubmit = handleSubmit(async (values) => {
    const incomeDigits = digitsOnly(values.incomeValue);
    const incomeNumber = incomeDigits ? Number(incomeDigits) / 100 : 0;

    const payload: CreatePaymentAccountInput = {
      holderType: values.holderType,
      cpfCnpj: digitsOnly(values.cpfCnpj),
      legalName: values.legalName.trim(),
      birthDate:
        values.holderType === 'PF' && values.birthDate
          ? values.birthDate
          : undefined,
      email: values.email.trim(),
      mobilePhone: digitsOnly(values.mobilePhone),
      incomeValue: incomeNumber,
      address: {
        street: values.street.trim(),
        number: values.number.trim(),
        complement: values.complement?.trim() || undefined,
        province: values.province.trim(),
        city: values.city.trim(),
        state: values.state.trim().toUpperCase(),
        postalCode: digitsOnly(values.postalCode),
      },
    };

    try {
      await createMutation.mutateAsync(payload);
      toast.success('Cadastro enviado. Falta só confirmar os documentos.');
    } catch (err) {
      // Erros vão pro toast — bloqueamos avançar até resolver.
      const anyErr = err as {
        response?: { data?: { message?: string; code?: string } };
        message?: string;
      };
      const msg =
        anyErr.response?.data?.message ??
        anyErr.message ??
        'Não foi possível criar a conta digital.';
      toast.error(msg, { duration: 7000 });
    }
  });

  // Pre-preenche email pelo condomínio se vier, melhoria de UX.
  useEffect(() => {
    if (account?.holderLegalName) {
      setValue('legalName', account.holderLegalName);
    }
  }, [account?.holderLegalName, setValue]);

  return (
    <SetupShell
      step="payments"
      eyebrow="Passo 3 de 5"
      title="Onde o condomínio vai receber"
      description="As mensalidades caem direto na conta do condomínio (ou do síndico). O CondoSync nunca passa pelo dinheiro — só gera as cobranças."
      onBack={onBack}
      onPrimary={showForm ? () => void onSubmit() : onContinue}
      primaryLabel={showForm ? 'Criar conta digital' : 'Continuar'}
      primaryLoading={createMutation.isPending}
      primaryDisabled={createMutation.isPending}
      secondaryLabel={showForm ? 'Continuar depois' : undefined}
      onSecondary={showForm ? onContinue : undefined}
    >
      <div className="space-y-5">
        {isLoading && !account ? (
          <div className="rounded-ds-2xl border border-ds-stroke-subtle bg-ds-surface p-5 text-ds-sm text-ds-dim">
            Verificando se já existe uma conta digital…
          </div>
        ) : null}

        {/* Quando já existe — só status + ações */}
        {!showForm && account ? (
          <ExistingAccountPanel
            account={account}
            onRefresh={() =>
              refreshMutation.mutateAsync().then(
                (res) =>
                  toast.success(
                    `Status atualizado: ${paymentAccountStatusLabel(res.status)}.`,
                  ),
                () => toast.error('Não foi possível atualizar o status.'),
              )
            }
            isRefreshing={refreshMutation.isPending}
            onRenewOnboarding={() =>
              refreshOnboardingMutation.mutateAsync().then(
                (res) => {
                  if (res.onboardingUrl) {
                    window.open(res.onboardingUrl, '_blank', 'noopener');
                  }
                },
                () => toast.error('Não foi possível gerar novo link.'),
              )
            }
            isRenewingLink={refreshOnboardingMutation.isPending}
          />
        ) : null}

        {/* Formulário de criação */}
        {showForm ? (
          <form className="space-y-5" onSubmit={onSubmit}>
            {prefilledFromCondo ? (
              <div className="flex items-start gap-2 rounded-ds-xl border border-emerald-500/25 bg-emerald-500/[0.06] px-4 py-2.5 text-ds-xs text-emerald-700 dark:text-emerald-300">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  Já adiantamos o nome, documento, telefone e endereço que você
                  informou. Revise abaixo e ajuste se for diferente.
                </span>
              </div>
            ) : null}

            {/* Toggle PF / MEI / PJ */}
            <div className="rounded-ds-2xl border border-ds-stroke-subtle bg-ds-surface p-4">
              <p className="mb-3 flex items-center gap-2 text-ds-sm font-semibold text-ds-body">
                <Landmark className="h-4 w-4 text-brand-500" />
                Tipo de titular
              </p>
              <Controller
                control={control}
                name="holderType"
                render={({ field }) => (
                  <div className="grid grid-cols-1 gap-2 ds-sm:grid-cols-3">
                    {HOLDER_TYPE_OPTIONS.map((opt) => (
                      <button
                        type="button"
                        key={opt.value}
                        onClick={() => field.onChange(opt.value)}
                        className={cn(
                          'rounded-ds-xl border p-3 text-left transition',
                          field.value === opt.value
                            ? 'border-brand-500 bg-brand-500/10 ring-1 ring-brand-500/30'
                            : 'border-ds-stroke bg-ds-surface hover:border-ds-stroke-strong',
                        )}
                      >
                        <p className="text-ds-sm font-semibold text-ds-body">
                          {opt.label}
                        </p>
                        <p className="mt-1 text-ds-xs text-ds-dim">{opt.hint}</p>
                      </button>
                    ))}
                  </div>
                )}
              />
            </div>

            {/* Dados do titular */}
            <div className="rounded-ds-2xl border border-ds-stroke-subtle bg-ds-surface p-5 space-y-4">
              <h2 className="text-ds-md font-semibold text-ds-body">Dados do titular</h2>

              <div className="grid gap-4 ds-sm:grid-cols-2">
                <FormField
                  label={holderType === 'PJ' ? 'CNPJ' : 'CPF'}
                  htmlFor="cpfCnpj"
                  required
                  hint={`Só números (${cpfCnpjMaxLen} dígitos).`}
                >
                  <Input
                    id="cpfCnpj"
                    inputMode="numeric"
                    maxLength={cpfCnpjMaxLen + 4}
                    {...register('cpfCnpj', { required: true })}
                  />
                </FormField>
                <FormField
                  label={holderType === 'PJ' ? 'Razão social' : 'Nome completo'}
                  htmlFor="legalName"
                  required
                >
                  <Input id="legalName" {...register('legalName', { required: true })} />
                </FormField>
              </div>

              {holderType === 'PF' ? (
                <FormField
                  label="Data de nascimento"
                  htmlFor="birthDate"
                  required
                  hint="Obrigatória para PF."
                >
                  <Input
                    id="birthDate"
                    type="date"
                    {...register('birthDate', {
                      required: holderType === 'PF',
                    })}
                  />
                </FormField>
              ) : null}

              <div className="grid gap-4 ds-sm:grid-cols-2">
                <FormField label="E-mail do titular" htmlFor="email" required>
                  <Input
                    id="email"
                    type="email"
                    {...register('email', { required: true })}
                  />
                </FormField>
                <FormField
                  label="Telefone (WhatsApp)"
                  htmlFor="mobilePhone"
                  required
                  hint="Com DDI 55 + DDD. Ex.: 5585991712228."
                >
                  <Input
                    id="mobilePhone"
                    inputMode="numeric"
                    {...register('mobilePhone', { required: true })}
                  />
                </FormField>
              </div>

              <FormField
                label={
                  holderType === 'PJ'
                    ? 'Faturamento mensal (R$)'
                    : 'Renda mensal (R$)'
                }
                htmlFor="incomeValue"
                required
                hint="Exigência regulatória — pode ser uma estimativa."
              >
                <Controller
                  control={control}
                  name="incomeValue"
                  rules={{ required: true }}
                  render={({ field }) => (
                    <Input
                      id="incomeValue"
                      inputMode="decimal"
                      value={field.value}
                      onChange={(e) => field.onChange(formatBrlInput(e.target.value))}
                      placeholder="5.000,00"
                    />
                  )}
                />
              </FormField>
            </div>

            {/* Endereço */}
            <div className="rounded-ds-2xl border border-ds-stroke-subtle bg-ds-surface p-5 space-y-4">
              <h2 className="text-ds-md font-semibold text-ds-body">Endereço do titular</h2>

              <div className="grid gap-4 ds-sm:grid-cols-[1fr_auto]">
                <FormField label="CEP" htmlFor="postalCode" required hint="Só dígitos.">
                  <Input
                    id="postalCode"
                    inputMode="numeric"
                    maxLength={8}
                    {...register('postalCode', { required: true })}
                  />
                </FormField>
                <FormField label="UF" htmlFor="state" required>
                  <NativeSelect id="state" {...register('state', { required: true })}>
                    <option value="">UF</option>
                    {[
                      'AC',
                      'AL',
                      'AP',
                      'AM',
                      'BA',
                      'CE',
                      'DF',
                      'ES',
                      'GO',
                      'MA',
                      'MT',
                      'MS',
                      'MG',
                      'PA',
                      'PB',
                      'PR',
                      'PE',
                      'PI',
                      'RJ',
                      'RN',
                      'RS',
                      'RO',
                      'RR',
                      'SC',
                      'SP',
                      'SE',
                      'TO',
                    ].map((uf) => (
                      <option key={uf} value={uf}>
                        {uf}
                      </option>
                    ))}
                  </NativeSelect>
                </FormField>
              </div>

              <div className="grid gap-4 ds-sm:grid-cols-[3fr_1fr]">
                <FormField label="Rua / Avenida" htmlFor="street" required>
                  <Input id="street" {...register('street', { required: true })} />
                </FormField>
                <FormField label="Número" htmlFor="number" required>
                  <Input id="number" {...register('number', { required: true })} />
                </FormField>
              </div>

              <div className="grid gap-4 ds-sm:grid-cols-2">
                <FormField label="Bairro" htmlFor="province" required>
                  <Input id="province" {...register('province', { required: true })} />
                </FormField>
                <FormField label="Cidade" htmlFor="city" required>
                  <Input id="city" {...register('city', { required: true })} />
                </FormField>
              </div>

              <FormField label="Complemento" htmlFor="complement" hint="Opcional.">
                <Input id="complement" {...register('complement')} />
              </FormField>
            </div>

            <p className="rounded-ds-xl border border-amber-500/30 bg-amber-500/[0.06] p-3 text-ds-xs text-amber-700 dark:text-amber-300">
              <strong>Atenção:</strong> cada CPF/CNPJ só pode ter uma conta
              ativa para recebimento. Se o seu CPF já tem outra conta aberta,
              use o CNPJ do condomínio ou o CPF de outro responsável (subsíndico,
              conselheiro).
            </p>

            {import.meta.env.DEV ? (
              <p className="rounded-ds-xl border border-sky-500/30 bg-sky-500/[0.06] p-3 text-ds-xs text-sky-700 dark:text-sky-300">
                <strong>Ambiente de teste:</strong> para liberar a conta sem
                envio real de documentos, use o endpoint dev{' '}
                <code className="rounded bg-sky-500/10 px-1">
                  /payment-account/dev/force-active
                </code>{' '}
                após criar.
              </p>
            ) : null}

            {/* Validation summary */}
            {formState.isSubmitted && !formState.isValid ? (
              <p className="text-ds-xs text-rose-500">
                Preencha os campos obrigatórios antes de continuar.
              </p>
            ) : null}
          </form>
        ) : null}
      </div>
    </SetupShell>
  );
}

/** Painel exibido após criar a subconta — status + ações. */
function ExistingAccountPanel({
  account,
  onRefresh,
  isRefreshing,
  onRenewOnboarding,
  isRenewingLink,
}: {
  account: NonNullable<ReturnType<typeof usePaymentAccount>['account']>;
  onRefresh: () => void;
  isRefreshing: boolean;
  onRenewOnboarding: () => void;
  isRenewingLink: boolean;
}) {
  const pendingSteps = [
    { label: 'Dados comerciais', status: account.commercialInfoStatus },
    { label: 'Dados bancários', status: account.bankAccountInfoStatus },
    { label: 'Identidade e documentos', status: account.documentationStatus },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-ds-2xl border border-ds-stroke-subtle bg-ds-surface p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-ds-xs uppercase tracking-widest text-ds-dim">
              Conta digital
            </p>
            <p className="mt-1 text-ds-md font-semibold text-ds-body">
              {account.holderLegalName}
            </p>
            <p className="mt-0.5 text-ds-xs text-ds-dim">
              {account.holderCpfCnpjMasked} · {account.holderType}
            </p>
          </div>
          <PaymentAccountStatusBadge status={account.status} />
        </div>

        {account.status === 'ACTIVE' ? (
          <p className="mt-4 flex items-start gap-2 rounded-ds-lg bg-emerald-500/10 p-3 text-ds-sm text-emerald-700 dark:text-emerald-300">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Tudo pronto. Quando os moradores pagarem, o valor cai
              direto na conta cadastrada.
            </span>
          </p>
        ) : (
          <p className="mt-3 text-ds-sm text-ds-dim">
            {account.rejectReason
              ? `Cadastro recusado: ${account.rejectReason}`
              : 'Falta concluir o envio dos documentos para liberar os recebimentos.'}
          </p>
        )}
      </div>

      {account.status !== 'ACTIVE' ? (
        <div className="rounded-ds-2xl border border-ds-stroke-subtle bg-ds-surface p-5 space-y-3">
          <p className="text-ds-sm font-semibold text-ds-body">
            Próximos passos para liberar
          </p>
          <ul className="space-y-2 text-ds-sm">
            {pendingSteps.map((s) => {
              const ok = s.status === 'APPROVED';
              return (
                <li key={s.label} className="flex items-center gap-2">
                  <span
                    className={cn(
                      'h-2 w-2 rounded-full',
                      ok ? 'bg-emerald-500' : 'bg-amber-500',
                    )}
                  />
                  <span className={cn(ok ? 'text-ds-dim line-through' : 'text-ds-body')}>
                    {s.label}
                  </span>
                </li>
              );
            })}
          </ul>

          <div className="flex flex-wrap gap-2 pt-2">
            {account.onboardingUrl ? (
              <a
                href={account.onboardingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 items-center gap-2 rounded-ds-md bg-brand-500 px-4 text-ds-sm font-semibold text-white hover:bg-brand-600"
              >
                <ExternalLink className="h-4 w-4" />
                Enviar documentos agora
              </a>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              onClick={onRenewOnboarding}
              disabled={isRenewingLink}
            >
              {isRenewingLink ? 'Gerando…' : 'Gerar novo link'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={onRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
              {isRefreshing ? 'Atualizando…' : 'Verificar status'}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
