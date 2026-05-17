import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import { Button } from '@/shared/components/ui/Button';
import { DialogFooter, FormDialog } from '@/shared/components/ui/Dialog';
import { FormField } from '@/shared/components/ui/FormField';
import { Input } from '@/shared/components/ui/Input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/Select';
import { useUnitsPage } from '@/domains/units/hooks/useUnitsPage';
import { unitFormSchema, type UnitFormInput } from '@/domains/units/schemas/unit.schema';
import type { Unit } from '@/shared/types/api';

const UNIT_TYPES = [
  { value: 'APARTMENT', label: 'Apartamento' },
  { value: 'HOUSE', label: 'Casa' },
  { value: 'COMMERCIAL', label: 'Comercial' },
] as const;

const UNIT_STATUSES = [
  { value: 'OCCUPIED', label: 'Ocupada' },
  { value: 'VACANT', label: 'Vaga' },
] as const;

interface UnitFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  condominiumId: string;
  /** Quando informada, vira modo edição. */
  unit?: Unit | null;
  /** Chamado após criação para permitir que o pai pré-selecione a unidade nova. */
  onCreated?: (unit: Unit) => void;
}

export function UnitFormDialog({
  open,
  onOpenChange,
  condominiumId,
  unit,
  onCreated,
}: UnitFormDialogProps) {
  const isEdit = Boolean(unit);
  const { createMutation, updateMutation } = useUnitsPage(condominiumId, unit?.id ?? null);

  const form = useForm<UnitFormInput>({
    resolver: zodResolver(unitFormSchema),
    defaultValues: { block: '', number: '', type: 'APARTMENT', status: 'VACANT' },
  });

  // Quando o dialog abre em modo edição, popula o form com os dados da unidade.
  useEffect(() => {
    if (!open) return;
    if (unit) {
      form.reset({
        block: unit.block,
        number: unit.number,
        type: unit.type as UnitFormInput['type'],
        status: unit.status as UnitFormInput['status'],
      });
    } else {
      form.reset({ block: '', number: '', type: 'APARTMENT', status: 'VACANT' });
    }
  }, [open, unit, form]);

  const mutation = isEdit ? updateMutation : createMutation;

  const handleClose = () => {
    onOpenChange(false);
    form.reset();
  };

  const onSubmit = form.handleSubmit((payload) =>
    mutation.mutate(payload, {
      onSuccess: (created) => {
        toast.success(isEdit ? 'Unidade atualizada.' : 'Unidade cadastrada.');
        handleClose();
        if (!isEdit && created && onCreated) onCreated(created as Unit);
      },
      onError: () => {
        toast.error(
          isEdit
            ? 'Não foi possível atualizar. Verifique se a unidade ainda tem moradores quando marcada como "Vaga".'
            : 'Não foi possível cadastrar a unidade.',
        );
      },
    }),
  );

  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) handleClose();
        else onOpenChange(true);
      }}
      title={isEdit ? 'Editar unidade' : 'Cadastrar unidade'}
      description={
        isEdit
          ? 'Atualize bloco, número, tipo e status da unidade.'
          : 'Preencha os dados da nova unidade.'
      }
    >
      <form className="space-y-4" onSubmit={onSubmit}>
        <div className="grid grid-cols-1 gap-4 ds-sm:grid-cols-2">
          <FormField
            label="Bloco"
            htmlFor="unit-block"
            required
            error={form.formState.errors.block?.message}
          >
            <Input
              id="unit-block"
              placeholder="Ex: A"
              invalid={Boolean(form.formState.errors.block)}
              {...form.register('block')}
            />
          </FormField>
          <FormField
            label="Número"
            htmlFor="unit-number"
            required
            error={form.formState.errors.number?.message}
          >
            <Input
              id="unit-number"
              placeholder="Ex: 101"
              invalid={Boolean(form.formState.errors.number)}
              {...form.register('number')}
            />
          </FormField>
        </div>
        <div className="grid grid-cols-1 gap-4 ds-sm:grid-cols-2">
          <FormField label="Tipo" htmlFor="unit-type">
            <Controller
              control={form.control}
              name="type"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="unit-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIT_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>
          <FormField label="Status" htmlFor="unit-status">
            <Controller
              control={form.control}
              name="status"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="unit-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIT_STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="secondary" type="button" onClick={handleClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Salvando…' : isEdit ? 'Salvar alterações' : 'Cadastrar'}
          </Button>
        </DialogFooter>
      </form>
    </FormDialog>
  );
}
