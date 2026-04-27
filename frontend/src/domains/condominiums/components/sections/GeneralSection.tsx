import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Button } from '@/shared/components/ui/Button';
import { FormField } from '@/shared/components/ui/FormField';
import { Input } from '@/shared/components/ui/Input';
import { SectionCard, SectionShell } from '@/domains/condominiums/components/SectionShell';
import { condominiumsService } from '@/domains/condominiums/services/condominiums.service';
import type { Condominium } from '@/shared/types/api';
import { queryKeys } from '@/shared/lib/queryKeys';

interface GeneralSectionProps {
  condominium: Condominium;
}

type FormData = {
  name: string;
  cnpj: string;
  street: string;
  number: string;
  city: string;
  state: string;
};

function digits(value: string) {
  return value.replace(/\D/g, '');
}

export function GeneralSection({ condominium }: GeneralSectionProps) {
  const queryClient = useQueryClient();
  const address = (condominium.address ?? {}) as Record<string, string | undefined>;
  const form = useForm<FormData>({
    defaultValues: {
      name: condominium.name,
      cnpj: condominium.cnpj,
      street: address.street ?? '',
      number: address.number ?? '',
      city: address.city ?? '',
      state: address.state ?? '',
    },
  });

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      condominiumsService.update(condominium.id, {
        name: data.name.trim(),
        cnpj: digits(data.cnpj),
        address: {
          street: data.street?.trim() || undefined,
          number: data.number?.trim() || undefined,
          city: data.city?.trim() || undefined,
          state: data.state?.trim() || undefined,
        },
      }),
    onSuccess: () => {
      toast.success('Dados gerais atualizados.');
      queryClient.invalidateQueries({ queryKey: queryKeys.condominium.detail(condominium.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.condominiums.root() });
    },
    onError: () => toast.error('Não foi possível salvar.'),
  });

  return (
    <SectionShell
      title="Geral"
      description="Identidade do condomínio. Esses dados aparecem nos comunicados aos moradores."
    >
      <SectionCard>
        <form className="space-y-4" onSubmit={form.handleSubmit((data) => mutation.mutate(data))}>
          <div className="grid gap-4 ds-md:grid-cols-2">
            <FormField label="Nome" htmlFor="g-name" required>
              <Input id="g-name" {...form.register('name', { required: true })} />
            </FormField>
            <FormField label="CNPJ" htmlFor="g-cnpj" required hint="14 dígitos">
              <Input id="g-cnpj" maxLength={18} {...form.register('cnpj', { required: true })} />
            </FormField>
          </div>

          <div className="grid gap-4 ds-md:grid-cols-[1fr_140px]">
            <FormField label="Rua" htmlFor="g-street">
              <Input id="g-street" {...form.register('street')} />
            </FormField>
            <FormField label="Número" htmlFor="g-number">
              <Input id="g-number" {...form.register('number')} />
            </FormField>
          </div>

          <div className="grid gap-4 ds-md:grid-cols-[1fr_120px]">
            <FormField label="Cidade" htmlFor="g-city">
              <Input id="g-city" {...form.register('city')} />
            </FormField>
            <FormField label="UF" htmlFor="g-state">
              <Input id="g-state" maxLength={2} {...form.register('state')} />
            </FormField>
          </div>

          <div className="flex justify-end pt-1">
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Salvando…' : 'Salvar alterações'}
            </Button>
          </div>
        </form>
      </SectionCard>
    </SectionShell>
  );
}
