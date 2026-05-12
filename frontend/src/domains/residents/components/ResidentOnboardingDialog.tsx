import { useState } from 'react';
import { useForm, Controller, useWatch, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Button } from '@/shared/components/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/Dialog';
import { queryKeys } from '@/shared/lib/queryKeys';
import { FormField } from '@/shared/components/ui/FormField';
import { Input } from '@/shared/components/ui/Input';
import { residentsService, type CreateResidentInput } from '@/domains/residents/services/residents.service';
import {
  createResidentSchema,
} from '@/domains/residents/schemas/resident.schema';
import type { Unit } from '@/shared/types/api';
import { cn } from '@/shared/utils/cn';

type Step = 1 | 2;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  condominiumId: string;
  unit: Pick<Unit, 'id' | 'block' | 'number'>;
};

const STEPS: { n: Step; label: string }[] = [
  { n: 1, label: 'Cadastro' },
  { n: 2, label: 'Resumo' },
];

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

export function ResidentOnboardingDialog({ open, onOpenChange, condominiumId, unit }: Props) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>(1);

  const form = useForm<CreateResidentInput>({
    resolver: zodResolver(createResidentSchema) as Resolver<CreateResidentInput>,
    defaultValues: {
      fullName: '',
      cpf: '',
      phoneWhatsapp: '',
      email: '',
      isFinancialResponsible: false,
    },
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreateResidentInput) =>
      residentsService.create(condominiumId, unit.id, {
        ...payload,
        isFinancialResponsible: payload.isFinancialResponsible === true,
      }),
    onSuccess: (resident) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.residents.byUnit(condominiumId, unit.id) });
      toast.success('Morador cadastrado.');
      void resident;
      setStep(2);
    },
    onError: (err) => {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : null;
      toast.error(message || 'Não foi possível salvar o morador. Confira os dados e tente novamente.');
    },
  });

  const unitLabel = `${unit.block} — ${unit.number}`;

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setStep(1);
      form.reset({
        fullName: '',
        cpf: '',
        phoneWhatsapp: '',
        email: '',
        isFinancialResponsible: false,
      });
    }
    onOpenChange(v);
  };
  const isFinancialResponsible = useWatch({
    control: form.control,
    name: 'isFinancialResponsible',
  });
  const cpfValue = useWatch({
    control: form.control,
    name: 'cpf',
  });
  const phoneValue = useWatch({
    control: form.control,
    name: 'phoneWhatsapp',
  });
  const completionHints = [
    `Morador cadastrado na unidade ${unitLabel}`,
    isFinancialResponsible
      ? 'Responsável financeiro definido neste cadastro'
      : 'Responsável financeiro não alterado neste cadastro',
    'Acesso ao app deve ser feito via link genérico do condomínio',
  ];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[min(90vh,720px)] min-w-0 overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo morador — passo a passo</DialogTitle>
          <DialogDescription>
            Unidade <strong className="text-ds-body">{unitLabel}</strong>. Em duas etapas você cadastra a pessoa no
            condomínio e define o responsável financeiro.
          </DialogDescription>
        </DialogHeader>

        <ol className="mb-4 flex gap-2 border-b border-ds-stroke/40 pb-3 text-[11px] font-medium text-ds-dim">
          {STEPS.map((s) => (
            <li
              key={s.n}
              className={cn(
                'flex-1 rounded-ds-md px-1.5 py-1 text-center',
                step === s.n && 'bg-brand-500/15 text-brand-200 ring-1 ring-brand-500/30',
                step > s.n && 'text-emerald-400/90',
              )}
            >
              {s.n}. {s.label}
            </li>
          ))}
        </ol>

        {step === 1 && (
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit((payload) =>
              createMutation.mutate({
                ...payload,
                email: payload.email.trim(),
              }),
            )}
          >
            <p className="text-ds-xs text-ds-dim">
              O cadastro no condomínio cria o acesso ao app. O login será enviado por WhatsApp para o número informado.
            </p>

            <FormField
              label="Nome completo"
              htmlFor="onb-fullName"
              required
              error={form.formState.errors.fullName?.message}
            >
              <Input
                id="onb-fullName"
                invalid={Boolean(form.formState.errors.fullName)}
                {...form.register('fullName')}
              />
            </FormField>
            <FormField
              label="CPF"
              htmlFor="onb-cpf"
              required
              hint="11 dígitos, só números (obrigatório se for responsável financeiro)"
              error={form.formState.errors.cpf?.message}
            >
              <Input
                id="onb-cpf"
                invalid={Boolean(form.formState.errors.cpf)}
                value={formatCpfInput(cpfValue ?? '')}
                onChange={(e) => form.setValue('cpf', e.target.value, { shouldValidate: true })}
              />
            </FormField>
            <FormField
              label="WhatsApp"
              htmlFor="onb-wa"
              hint="Informe DDD + número (ex.: 85991712228)"
              error={form.formState.errors.phoneWhatsapp?.message}
            >
              <Input
                id="onb-wa"
                invalid={Boolean(form.formState.errors.phoneWhatsapp)}
                value={formatWhatsappInput(phoneValue ?? '')}
                onChange={(e) =>
                  form.setValue('phoneWhatsapp', e.target.value, { shouldValidate: true })
                }
              />
            </FormField>
            <FormField
              label="E-mail"
              htmlFor="onb-mail"
              required
              hint="Usado como login no app"
              error={form.formState.errors.email?.message}
            >
              <Input id="onb-mail" type="email" invalid={Boolean(form.formState.errors.email)} {...form.register('email')} />
            </FormField>

            <div className="flex items-start gap-3 rounded-ds-md border border-ds-stroke/50 bg-ds-elevated/20 p-3">
              <Controller
                name="isFinancialResponsible"
                control={form.control}
                render={({ field: { value, onChange, ref, onBlur, name } }) => (
                  <input
                    id="onb-resp"
                    ref={ref}
                    name={name}
                    type="checkbox"
                    onBlur={onBlur}
                    checked={value}
                    onChange={(e) => onChange(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-ds-stroke text-brand-500"
                  />
                )}
              />
              <label htmlFor="onb-resp" className="cursor-pointer text-ds-sm text-ds-body">
                <span className="font-semibold">Responsável financeiro desta unidade</span>
                <span className="mt-1 block text-ds-xs text-ds-dim">
                  Apenas um por unidade. Se marcar, este morador passa a ser o ponto de voto em enquetes e o recebedor de avisos de cobrança.
                </span>
              </label>
            </div>

            <DialogFooter className="gap-2 sm:justify-end">
              <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Salvando…' : 'Salvar'}
              </Button>
            </DialogFooter>
          </form>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-ds-sm text-ds-dim">
              Para acesso ao app, use o <strong className="text-ds-body">link genérico do condomínio</strong> na área de
              gestão de equipe. O morador escolhe a unidade e preenche os dados no próprio cadastro.
            </p>

            <DialogFooter className="flex flex-wrap gap-2 sm:justify-end">
              <Button type="button" onClick={() => onOpenChange(false)}>
                Concluir
              </Button>
            </DialogFooter>
          </div>
        )}
        <div className="space-y-4 text-ds-sm text-ds-dim">
          {step === 2 ? (
            <>
              <p>Cadastro finalizado com sucesso. Resumo:</p>
              <ul className="space-y-1 text-ds-xs">
                {completionHints.map((hint) => (
                  <li key={hint} className="rounded-ds-md border border-ds-stroke/40 bg-ds-elevated/20 px-2.5 py-1.5">
                    {hint}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
