import { useState } from 'react';
import { UserRoundPlus } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/shared/stores/auth.store';
import { canManageCondominiumStructure } from '@/shared/utils/roles';
import { useVisitors } from '@/domains/visitors/hooks/useVisitors';
import {
  formatUnitBlockNumber,
  useUnitsForCurrentMember,
} from '@/domains/units/hooks/useUnits';
import { visitorSchema, type VisitorFormInput } from '@/domains/visitors/schemas/visitors.schema';
import { PageHeader } from '@/shared/components/ui/PageHeader';
import { Button } from '@/shared/components/ui/Button';
import { FormDialog, DialogFooter } from '@/shared/components/ui/Dialog';
import { FormField } from '@/shared/components/ui/FormField';
import { Input } from '@/shared/components/ui/Input';
import { Spinner } from '@/shared/components/ui/Spinner';
import { GlassCard } from '@/shared/components/ui/GlassCard';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/Select';
import { formatCpfOrCnpj } from '@/shared/utils/documents';
import { digitsOnly } from '@/shared/utils/phone';

export function VisitorsPage() {
  const condo = useAuthStore((s) => s.activeCondominium);
  const role = useAuthStore((s) => s.role);
  const canManage = canManageCondominiumStructure(role);
  const [visitorDialog, setVisitorDialog] = useState(false);
  const { units, isLoading: unitsLoading } = useUnitsForCurrentMember(condo?.id);
  const {
    visitorsQuery,
    createVisitorMutation,
    updateVisitorStatusMutation,
  } = useVisitors(condo?.id);

  const visitorForm = useForm<VisitorFormInput>({
    resolver: zodResolver(visitorSchema),
    defaultValues: {
      unitId: '',
      visitorName: '',
      visitorDocument: '',
      expectedAt: '',
      notes: '',
    },
  });
  if (!condo?.id) {
    return <p className="ds-page text-ds-sm text-ds-dim">Selecione um condomínio no topo da página.</p>;
  }
  if (visitorsQuery.isLoading || unitsLoading) return <Spinner />;

  const visitors = visitorsQuery.data ?? [];
  const unitLabelById = new Map(units.map((unit) => [unit.id, formatUnitBlockNumber(unit)]));

  return (
    <div className="ds-page space-y-6">
      <PageHeader
        title="Visitantes e correspondências"
        description="Controle simples de visitantes previstos e pacotes recebidos."
        actions={
          <Button variant="secondary" onClick={() => setVisitorDialog(true)}>
            <UserRoundPlus className="h-4 w-4" />
            Novo visitante
          </Button>
        }
      />
      <div className="space-y-3">
        {visitors.map((v) => (
          <GlassCard key={v.id} className="space-y-2">
            <p className="text-ds-sm font-semibold">{v.visitorName}</p>
            <p className="text-ds-xs text-ds-dim">
              Unidade: {unitLabelById.get(v.unitId) ?? 'Unidade não identificada'} · Previsto:{' '}
              {new Date(v.expectedAt).toLocaleString('pt-BR')}
            </p>
            <p className="text-ds-xs text-ds-dim">Status: {v.status}</p>
            {canManage ? (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    updateVisitorStatusMutation.mutate(
                      { id: v.id, status: 'ARRIVED' },
                      {
                        onSuccess: () => toast.success('Visitante marcado como chegado.'),
                        onError: () => toast.error('Não foi possível atualizar o visitante.'),
                      },
                    )
                  }
                >
                  Marcar chegada
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    updateVisitorStatusMutation.mutate(
                      { id: v.id, status: 'CANCELED' },
                      {
                        onSuccess: () => toast.success('Visitante cancelado.'),
                        onError: () => toast.error('Não foi possível atualizar o visitante.'),
                      },
                    )
                  }
                >
                  Cancelar
                </Button>
              </div>
            ) : null}
          </GlassCard>
        ))}
      </div>

      <FormDialog
        open={visitorDialog}
        onOpenChange={setVisitorDialog}
        title="Novo visitante"
        description="Pré-cadastro para facilitar a entrada na portaria."
      >
        <form
          className="space-y-4"
          onSubmit={visitorForm.handleSubmit((payload) => {
            createVisitorMutation.mutate(payload, {
              onSuccess: () => {
                toast.success('Visitante cadastrado com sucesso.');
                visitorForm.reset();
                setVisitorDialog(false);
              },
              onError: () => toast.error('Não foi possível cadastrar o visitante.'),
            });
          })}
        >
          <FormField label="Unidade" htmlFor="visitor-unit" required>
            <Controller
              control={visitorForm.control}
              name="unitId"
              rules={{ required: true }}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="visitor-unit">
                    <SelectValue placeholder="Selecione a unidade" />
                  </SelectTrigger>
                  <SelectContent>
                    {units.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {formatUnitBlockNumber(u)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>
          <FormField label="Nome do visitante" htmlFor="visitor-name" required>
            <Input id="visitor-name" {...visitorForm.register('visitorName', { required: true })} />
          </FormField>
          <div className="grid grid-cols-1 gap-3 ds-sm:grid-cols-2">
            <FormField
              label="Documento"
              htmlFor="visitor-document"
              hint="CPF ou CNPJ (opcional)."
            >
              <Controller
                control={visitorForm.control}
                name="visitorDocument"
                render={({ field }) => (
                  <Input
                    id="visitor-document"
                    inputMode="numeric"
                    placeholder="000.000.000-00"
                    value={formatCpfOrCnpj(field.value ?? '')}
                    onChange={(e) => field.onChange(digitsOnly(e.target.value))}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                  />
                )}
              />
            </FormField>
            <FormField label="Data/hora prevista" htmlFor="visitor-expected" required>
              <Input id="visitor-expected" type="datetime-local" {...visitorForm.register('expectedAt', { required: true })} />
            </FormField>
          </div>
          <FormField label="Observações" htmlFor="visitor-notes">
            <Input id="visitor-notes" {...visitorForm.register('notes')} />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setVisitorDialog(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createVisitorMutation.isPending}>
              {createVisitorMutation.isPending ? 'Salvando…' : 'Cadastrar visitante'}
            </Button>
          </DialogFooter>
        </form>
      </FormDialog>

    </div>
  );
}
