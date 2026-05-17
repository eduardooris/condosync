import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { FormField } from '@/shared/components/ui/FormField';
import { Input } from '@/shared/components/ui/Input';
import { SetupShell } from '@/domains/setup/components/SetupShell';
import { useSetupStore } from '@/domains/setup/store/setup.store';
import { condominiumsService } from '@/domains/condominiums/services/condominiums.service';
import { useAuthStore } from '@/shared/stores/auth.store';
import { queryKeys } from '@/shared/lib/queryKeys';

type FormData = {
  name: string;
  cnpj: string;
  adminContactPhone?: string;
  street?: string;
  number?: string;
  city?: string;
  state?: string;
};

interface StepIdentityProps {
  onBack: () => void;
  onContinue: () => void;
}

function digits(value: string) {
  return value.replace(/\D/g, '');
}

export function StepIdentity({ onBack, onContinue }: StepIdentityProps) {
  const queryClient = useQueryClient();
  const setActiveCondominium = useAuthStore((s) => s.setActiveCondominium);
  const identity = useSetupStore((s) => s.identity);
  const condominiumId = useSetupStore((s) => s.condominiumId);
  const patchIdentity = useSetupStore((s) => s.patchIdentity);
  const setCondominiumId = useSetupStore((s) => s.setCondominiumId);

  const form = useForm<FormData>({
    defaultValues: {
      name: identity.name,
      cnpj: identity.cnpj,
      adminContactPhone: identity.adminContactPhone ?? '',
      street: identity.address.street ?? '',
      number: identity.address.number ?? '',
      city: identity.address.city ?? '',
      state: identity.address.state ?? '',
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const cleanedCnpj = digits(data.cnpj);
      const address = {
        street: data.street?.trim() || undefined,
        number: data.number?.trim() || undefined,
        city: data.city?.trim() || undefined,
        state: data.state?.trim() || undefined,
      };
      patchIdentity({
        name: data.name.trim(),
        cnpj: cleanedCnpj,
        adminContactPhone: digits(data.adminContactPhone ?? ''),
        address,
      });

      if (condominiumId) {
        return condominiumsService.update(condominiumId, {
          name: data.name.trim(),
          cnpj: cleanedCnpj,
          adminContactPhone: digits(data.adminContactPhone ?? ''),
          address,
        });
      }

      return condominiumsService.create({
        name: data.name.trim(),
        cnpj: cleanedCnpj,
        adminContactPhone: digits(data.adminContactPhone ?? ''),
        address,
      });
    },
    onSuccess: (condo) => {
      setCondominiumId(condo.id);
      // Quem cria um condomínio é sempre ADMIN dele.
      setActiveCondominium({
        id: condo.id,
        name: condo.name,
        role: 'ADMIN',
        unitId: null,
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.condominiums.root() });
      onContinue();
    },
    onError: () => {
      toast.error('Não foi possível salvar. Verifique CNPJ e tente novamente.');
    },
  });

  return (
    <SetupShell
      step="identity"
      eyebrow="Passo 1 de 4"
      title="Como podemos chamar seu condomínio?"
      description="Esses dados aparecem no topo do app e nos comunicados enviados aos moradores."
      onBack={onBack}
      onPrimary={form.handleSubmit((data) => mutation.mutate(data))}
      primaryLoading={mutation.isPending}
      primaryDisabled={!form.formState.isValid && form.formState.isSubmitted}
      primaryLabel={condominiumId ? 'Salvar e continuar' : 'Criar condomínio'}
    >
      <form
        className="space-y-5"
        onSubmit={form.handleSubmit((data) => mutation.mutate(data))}
        noValidate
      >
        <FormField
          label="Nome do condomínio"
          htmlFor="setup-name"
          required
          error={form.formState.errors.name?.message}
        >
          <Input
            id="setup-name"
            placeholder="Ex.: Edifício Aurora"
            invalid={Boolean(form.formState.errors.name)}
            {...form.register('name', {
              required: 'Informe o nome do condomínio',
              minLength: { value: 2, message: 'Mínimo 2 caracteres' },
            })}
          />
        </FormField>

        <FormField
          label="CNPJ"
          htmlFor="setup-cnpj"
          required
          hint="14 dígitos. Pode colar com pontuação."
          error={form.formState.errors.cnpj?.message}
        >
          <Input
            id="setup-cnpj"
            placeholder="00.000.000/0000-00"
            inputMode="numeric"
            maxLength={18}
            invalid={Boolean(form.formState.errors.cnpj)}
            {...form.register('cnpj', {
              required: 'Informe o CNPJ',
              validate: (value) => digits(value).length === 14 || 'CNPJ deve ter 14 dígitos',
            })}
          />
        </FormField>

        <FormField
          label="WhatsApp da administração"
          htmlFor="setup-admin-phone"
          hint="DDD + número. Esse contato será enviado aos moradores nas mensagens de cobrança."
          error={form.formState.errors.adminContactPhone?.message}
        >
          <Input
            id="setup-admin-phone"
            placeholder="85991712228"
            inputMode="numeric"
            invalid={Boolean(form.formState.errors.adminContactPhone)}
            {...form.register('adminContactPhone', {
              validate: (value) =>
                !value || [10, 11].includes(digits(value).length) || 'Informe DDD + número',
            })}
          />
        </FormField>

        <fieldset className="space-y-4 rounded-ds-2xl border border-ds-stroke-subtle bg-ds-surface p-4 dark:bg-white/[0.02]">
          <legend className="px-2 text-[11px] font-semibold uppercase tracking-widest text-ds-dim dark:text-brand-300/70">
            Endereço (opcional)
          </legend>
          <div className="grid gap-3 ds-sm:grid-cols-[1fr_140px]">
            <FormField label="Rua" htmlFor="setup-street">
              <Input id="setup-street" placeholder="Rua das Flores" {...form.register('street')} />
            </FormField>
            <FormField label="Número" htmlFor="setup-number">
              <Input id="setup-number" placeholder="100" {...form.register('number')} />
            </FormField>
          </div>
          <div className="grid gap-3 ds-sm:grid-cols-[1fr_120px]">
            <FormField label="Cidade" htmlFor="setup-city">
              <Input id="setup-city" placeholder="Recife" {...form.register('city')} />
            </FormField>
            <FormField label="UF" htmlFor="setup-state">
              <Input id="setup-state" placeholder="PE" maxLength={2} {...form.register('state')} />
            </FormField>
          </div>
        </fieldset>
      </form>
    </SetupShell>
  );
}
