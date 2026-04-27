import { useState } from 'react';
import toast from 'react-hot-toast';
import { Pencil } from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/Dialog';
import { FormField } from '@/shared/components/ui/FormField';
import { Input } from '@/shared/components/ui/Input';
import { useCharges } from '@/domains/charges/hooks/useCharges';
import type { Charge } from '@/shared/types/api';

interface EditChargeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  condominiumId: string;
  charge: Charge | null;
}

export function EditChargeDialog({
  open,
  onOpenChange,
  condominiumId,
  charge,
}: EditChargeDialogProps) {
  if (!charge) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <DialogContent>
          <EditChargeForm
            key={charge.id}
            charge={charge}
            condominiumId={condominiumId}
            onOpenChange={onOpenChange}
          />
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

function EditChargeForm({
  charge,
  condominiumId,
  onOpenChange,
}: {
  charge: Charge;
  condominiumId: string;
  onOpenChange: (open: boolean) => void;
}) {
  const { updateMutation } = useCharges(condominiumId);
  const [amountText, setAmountText] = useState(() => String(charge.amount).replace('.', ','));
  const [dueDate, setDueDate] = useState(() => charge.dueDate ?? '');

  const amountNumber = Number(amountText.replace(/\./g, '').replace(',', '.'));
  const amountValid = Number.isFinite(amountNumber) && amountNumber > 0;
  const dueDateValid = /^\d{4}-\d{2}-\d{2}$/.test(dueDate);

  const original = {
    amount: Number(charge.amount),
    dueDate: charge.dueDate,
  };
  const dirty =
    (amountValid && amountNumber !== original.amount) ||
    (dueDateValid && dueDate !== original.dueDate);

  async function handleSave() {
    if (!amountValid || !dueDateValid) return;
    const payload: { amount?: number; dueDate?: string } = {};
    if (amountNumber !== original.amount) {
      payload.amount = Number(amountNumber.toFixed(2));
    }
    if (dueDate !== original.dueDate) {
      payload.dueDate = dueDate;
    }
    if (Object.keys(payload).length === 0) {
      onOpenChange(false);
      return;
    }
    try {
      await updateMutation.mutateAsync({ id: charge.id, payload });
      toast.success('Cobrança atualizada.');
      onOpenChange(false);
    } catch (err) {
      toast.error(extractError(err) ?? 'Não foi possível atualizar.');
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Pencil className="h-4 w-4 text-brand-700 dark:text-brand-300" aria-hidden />
          Editar cobrança
        </DialogTitle>
        <DialogDescription>
          Ajuste valor e vencimento. Para baixar pagamento ou isentar, use os botões da lista.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <FormField label="Valor (R$)" htmlFor="edit-amount" required>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ds-sm font-semibold text-ds-subtle">
              R$
            </span>
            <Input
              id="edit-amount"
              value={amountText}
              onChange={(e) => setAmountText(e.target.value)}
              inputMode="decimal"
              invalid={!amountValid}
              className="pl-10"
            />
          </div>
        </FormField>

        <FormField label="Vencimento" htmlFor="edit-due" required>
          <Input
            id="edit-due"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            invalid={!dueDateValid}
          />
        </FormField>
      </div>

      <DialogFooter>
        <Button
          variant="secondary"
          onClick={() => onOpenChange(false)}
          disabled={updateMutation.isPending}
        >
          Cancelar
        </Button>
        <Button
          variant="gradient"
          onClick={handleSave}
          disabled={!dirty || updateMutation.isPending}
        >
          {updateMutation.isPending ? 'Salvando…' : 'Salvar'}
        </Button>
      </DialogFooter>
    </>
  );
}

function extractError(err: unknown): string | null {
  if (typeof err !== 'object' || !err) return null;
  const anyErr = err as {
    response?: { data?: { message?: string | string[] } };
    message?: string;
  };
  const msg = anyErr.response?.data?.message ?? anyErr.message;
  if (Array.isArray(msg)) return msg.join(' • ');
  return msg ?? null;
}
