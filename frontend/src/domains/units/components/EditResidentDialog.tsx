import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Button } from '@/shared/components/ui/Button';
import { DialogFooter, FormDialog } from '@/shared/components/ui/Dialog';
import { FormField } from '@/shared/components/ui/FormField';
import { Input } from '@/shared/components/ui/Input';
import { queryKeys } from '@/shared/lib/queryKeys';
import { residentsService } from '@/domains/residents/services/residents.service';
import {
  editResidentFormSchema,
  type EditResidentFormInput,
} from '@/domains/residents/schemas/resident.schema';
import type { Resident, Unit } from '@/shared/types/api';
import { formatCpf } from '@/shared/utils/documents';
import { digitsOnly, formatWhatsappInput } from '@/shared/utils/phone';

interface EditResidentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  condominiumId: string;
  unit: Pick<Unit, 'id' | 'block' | 'number'>;
  resident: Resident | null;
}

export function EditResidentDialog({
  open,
  onOpenChange,
  condominiumId,
  unit,
  resident,
}: EditResidentDialogProps) {
  const queryClient = useQueryClient();

  const form = useForm<EditResidentFormInput>({
    resolver: zodResolver(editResidentFormSchema),
  });

  useEffect(() => {
    if (!open || !resident) return;
    form.reset({
      fullName: resident.fullName,
      cpf: resident.cpf.replace(/\D/g, ''),
      phoneWhatsapp: resident.phoneWhatsapp?.replace(/\D/g, '') ?? '',
      email: resident.email ?? '',
    });
  }, [open, resident, form]);

  const updateMutation = useMutation({
    mutationFn: (payload: EditResidentFormInput) =>
      residentsService.update(condominiumId, unit.id, resident!.id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.residents.byUnit(condominiumId, unit.id),
      });
      toast.success('Morador atualizado.');
      onOpenChange(false);
    },
    onError: () => toast.error('Não foi possível atualizar. Tente novamente.'),
  });

  const handleClose = () => {
    onOpenChange(false);
    form.reset();
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) handleClose();
        else onOpenChange(true);
      }}
      title="Editar morador"
      description={`Unidade ${unit.block} · ${unit.number}`}
    >
      <form
        className="space-y-4"
        onSubmit={form.handleSubmit((payload) => updateMutation.mutate(payload))}
      >
        <FormField
          label="Nome completo"
          htmlFor="edit-fullName"
          required
          error={form.formState.errors.fullName?.message}
        >
          <Input
            id="edit-fullName"
            invalid={Boolean(form.formState.errors.fullName)}
            {...form.register('fullName')}
          />
        </FormField>
        <FormField
          label="CPF"
          htmlFor="edit-cpf"
          required
          hint="11 dígitos"
          error={form.formState.errors.cpf?.message}
        >
          <Controller
            control={form.control}
            name="cpf"
            render={({ field }) => (
              <Input
                id="edit-cpf"
                inputMode="numeric"
                placeholder="000.000.000-00"
                invalid={Boolean(form.formState.errors.cpf)}
                value={formatCpf(field.value ?? '')}
                onChange={(e) => field.onChange(digitsOnly(e.target.value))}
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref}
              />
            )}
          />
        </FormField>
        <FormField
          label="WhatsApp"
          htmlFor="edit-wa"
          hint="DDD + número"
          error={form.formState.errors.phoneWhatsapp?.message}
        >
          <Controller
            control={form.control}
            name="phoneWhatsapp"
            render={({ field }) => (
              <Input
                id="edit-wa"
                inputMode="tel"
                placeholder="(85) 99171-2228"
                invalid={Boolean(form.formState.errors.phoneWhatsapp)}
                value={formatWhatsappInput(field.value ?? '')}
                onChange={(e) => field.onChange(digitsOnly(e.target.value))}
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref}
              />
            )}
          />
        </FormField>
        <FormField label="E-mail" htmlFor="edit-email" error={form.formState.errors.email?.message}>
          <Input
            id="edit-email"
            type="email"
            invalid={Boolean(form.formState.errors.email)}
            {...form.register('email')}
          />
        </FormField>
        <DialogFooter>
          <Button variant="secondary" type="button" onClick={handleClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? 'Salvando…' : 'Salvar alterações'}
          </Button>
        </DialogFooter>
      </form>
    </FormDialog>
  );
}
