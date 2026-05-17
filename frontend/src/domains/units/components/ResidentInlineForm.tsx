import { useEffect } from 'react';
import { Controller, useForm, useWatch, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import toast from 'react-hot-toast';
import { ShieldCheck, X } from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import { FormField } from '@/shared/components/ui/FormField';
import { Input } from '@/shared/components/ui/Input';
import { queryKeys } from '@/shared/lib/queryKeys';
import {
  residentsService,
  type CreateResidentInput,
} from '@/domains/residents/services/residents.service';
import { createResidentSchema } from '@/domains/residents/schemas/resident.schema';
import type { Unit } from '@/shared/types/api';

interface ResidentInlineFormProps {
  open: boolean;
  onClose: () => void;
  condominiumId: string;
  unit: Pick<Unit, 'id' | 'block' | 'number'>;
  /** Quando true, ja existe um responsavel financeiro nesta unidade. */
  hasResponsible: boolean;
}

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
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

/**
 * Form inline para cadastrar um morador na unidade atualmente visível.
 * Substitui o antigo ResidentOnboardingDialog: o context da unidade fica
 * sempre visivel no painel (sem modal-dentro-de-modal).
 */
export function ResidentInlineForm({
  open,
  onClose,
  condominiumId,
  unit,
  hasResponsible,
}: ResidentInlineFormProps) {
  const reduce = useReducedMotion();
  const queryClient = useQueryClient();

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

  // Resetar form sempre que o painel fecha — evita carregar dados de uma
  // unidade no formulario de outra quando o usuario navega entre unidades.
  useEffect(() => {
    if (!open) {
      form.reset({
        fullName: '',
        cpf: '',
        phoneWhatsapp: '',
        email: '',
        isFinancialResponsible: false,
      });
    }
  }, [open, form]);

  const createMutation = useMutation({
    mutationFn: (payload: CreateResidentInput) =>
      residentsService.create(condominiumId, unit.id, {
        ...payload,
        email: payload.email.trim(),
        isFinancialResponsible: payload.isFinancialResponsible === true,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.residents.byUnit(condominiumId, unit.id),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.units.onboardingChecklist(condominiumId),
      });
      toast.success('Morador cadastrado.');
      onClose();
    },
    onError: (err) => {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : null;
      toast.error(message || 'Não foi possível cadastrar. Confira os dados e tente novamente.');
    },
  });

  const cpfValue = useWatch({ control: form.control, name: 'cpf' });
  const phoneValue = useWatch({ control: form.control, name: 'phoneWhatsapp' });

  const onSubmit = form.handleSubmit((payload) => createMutation.mutate(payload));

  return (
    <AnimatePresence initial={false}>
      {open ? (
        <motion.div
          key="inline-form"
          initial={reduce ? false : { opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
          transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
          className="overflow-hidden"
        >
          <div className="rounded-ds-2xl border border-brand-500/25 bg-brand-500/[0.06] p-4 shadow-ds-sm ds-md:p-5">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-ds-sm font-semibold text-ds-body">
                  Adicionar morador
                </p>
                <p className="mt-0.5 text-ds-xs text-ds-dim">
                  O acesso ao app é enviado por WhatsApp para o número informado.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-ds-md p-1 text-ds-subtle transition hover:bg-white/5 hover:text-ds-body"
                aria-label="Fechar formulário"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            <form className="space-y-3" onSubmit={onSubmit}>
              <FormField
                label="Nome completo"
                htmlFor="inline-fullName"
                required
                error={form.formState.errors.fullName?.message}
              >
                <Input
                  id="inline-fullName"
                  invalid={Boolean(form.formState.errors.fullName)}
                  autoComplete="off"
                  {...form.register('fullName')}
                />
              </FormField>

              <div className="grid grid-cols-1 gap-3 ds-sm:grid-cols-2">
                <FormField
                  label="CPF"
                  htmlFor="inline-cpf"
                  required
                  hint="11 dígitos"
                  error={form.formState.errors.cpf?.message}
                >
                  <Input
                    id="inline-cpf"
                    inputMode="numeric"
                    autoComplete="off"
                    invalid={Boolean(form.formState.errors.cpf)}
                    value={formatCpfInput(cpfValue ?? '')}
                    onChange={(e) =>
                      form.setValue('cpf', e.target.value, { shouldValidate: true })
                    }
                  />
                </FormField>
                <FormField
                  label="WhatsApp"
                  htmlFor="inline-wa"
                  required
                  hint="DDD + número"
                  error={form.formState.errors.phoneWhatsapp?.message}
                >
                  <Input
                    id="inline-wa"
                    inputMode="tel"
                    autoComplete="off"
                    invalid={Boolean(form.formState.errors.phoneWhatsapp)}
                    value={formatWhatsappInput(phoneValue ?? '')}
                    onChange={(e) =>
                      form.setValue('phoneWhatsapp', e.target.value, { shouldValidate: true })
                    }
                  />
                </FormField>
              </div>

              <FormField
                label="E-mail"
                htmlFor="inline-email"
                required
                hint="Usado como login no app"
                error={form.formState.errors.email?.message}
              >
                <Input
                  id="inline-email"
                  type="email"
                  autoComplete="off"
                  invalid={Boolean(form.formState.errors.email)}
                  {...form.register('email')}
                />
              </FormField>

              <label
                className={
                  hasResponsible
                    ? 'flex cursor-not-allowed items-start gap-2.5 rounded-ds-lg border border-ds-stroke/40 bg-ds-surface/30 p-3 opacity-60'
                    : 'flex cursor-pointer items-start gap-2.5 rounded-ds-lg border border-ds-stroke/60 bg-ds-surface/30 p-3 transition hover:bg-ds-surface/60'
                }
              >
                <Controller
                  name="isFinancialResponsible"
                  control={form.control}
                  render={({ field: { value, onChange, ref, onBlur, name } }) => (
                    <input
                      ref={ref}
                      name={name}
                      type="checkbox"
                      onBlur={onBlur}
                      checked={value}
                      disabled={hasResponsible}
                      onChange={(e) => onChange(e.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-ds-stroke text-brand-500"
                    />
                  )}
                />
                <span className="text-ds-xs">
                  <span className="inline-flex items-center gap-1 font-semibold text-ds-body">
                    <ShieldCheck className="h-3 w-3 text-emerald-400" aria-hidden />
                    Responsável financeiro
                  </span>
                  <span className="mt-0.5 block text-ds-dim">
                    {hasResponsible
                      ? 'Esta unidade já tem um responsável. Para trocar, use "Definir responsável" na lista.'
                      : 'Apenas um por unidade. Recebe avisos de cobrança e vota em enquetes.'}
                  </span>
                </span>
              </label>

              <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                  Cancelar
                </Button>
                <Button type="submit" size="sm" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Salvando…' : 'Adicionar morador'}
                </Button>
              </div>
            </form>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
