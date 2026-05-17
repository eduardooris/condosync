import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
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
          <Input
            id="edit-cpf"
            inputMode="numeric"
            invalid={Boolean(form.formState.errors.cpf)}
            {...form.register('cpf')}
          />
        </FormField>
        <FormField
          label="WhatsApp"
          htmlFor="edit-wa"
          hint="DDD + número"
          error={form.formState.errors.phoneWhatsapp?.message}
        >
          <Input
            id="edit-wa"
            inputMode="tel"
            invalid={Boolean(form.formState.errors.phoneWhatsapp)}
            {...form.register('phoneWhatsapp')}
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
