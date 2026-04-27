import { useState } from 'react';
import { Package } from 'lucide-react';
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
import { parcelSchema, type ParcelFormInput } from '@/domains/visitors/schemas/visitors.schema';
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

export function CorrespondencesPage() {
  const condo = useAuthStore((s) => s.activeCondominium);
  const role = useAuthStore((s) => s.role);
  const canManage = canManageCondominiumStructure(role);
  const [parcelDialog, setParcelDialog] = useState(false);
  const { units, isLoading: unitsLoading } = useUnitsForCurrentMember(condo?.id);
  const { parcelsQuery, createParcelMutation, updateParcelStatusMutation } =
    useVisitors(condo?.id);
  const parcelForm = useForm<ParcelFormInput>({
    resolver: zodResolver(parcelSchema),
    defaultValues: { unitId: '', carrier: '', trackingCode: '', notes: '' },
  });

  if (!condo?.id) {
    return (
      <p className="ds-page text-ds-sm text-ds-dim">Selecione um condomínio no topo da página.</p>
    );
  }
  if (parcelsQuery.isLoading || unitsLoading) return <Spinner />;
  const parcels = parcelsQuery.data ?? [];
  const unitLabelById = new Map(units.map((unit) => [unit.id, formatUnitBlockNumber(unit)]));

  return (
    <div className="ds-page space-y-6">
      <PageHeader
        title="Correspondências"
        description="Registro de recebimento e retirada de encomendas."
        actions={
          canManage ? (
            <Button onClick={() => setParcelDialog(true)}>
              <Package className="h-4 w-4" />
              Nova correspondência
            </Button>
          ) : undefined
        }
      />

      <div className="space-y-3">
        {parcels.map((p) => (
          <GlassCard key={p.id} className="space-y-2">
            <p className="text-ds-sm font-semibold">{p.carrier}</p>
            <p className="text-ds-xs text-ds-dim">
              Unidade: {unitLabelById.get(p.unitId) ?? 'Unidade não identificada'}{' '}
              · Recebida: {new Date(p.receivedAt).toLocaleString('pt-BR')}
            </p>
            {p.trackingCode ? (
              <p className="text-ds-xs text-ds-dim">
                Código: {p.trackingCode}
              </p>
            ) : null}
            <p className="text-ds-xs text-ds-dim">Status: {p.status}</p>
            {canManage && p.status === 'RECEIVED' ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  updateParcelStatusMutation.mutate(
                    { id: p.id, status: 'DELIVERED' },
                    {
                      onSuccess: () =>
                        toast.success('Correspondência marcada como entregue.'),
                      onError: () =>
                        toast.error(
                          'Não foi possível atualizar a correspondência.',
                        ),
                    },
                  )
                }
              >
                Marcar entregue
              </Button>
            ) : null}
          </GlassCard>
        ))}
      </div>

      {canManage ? (
        <FormDialog
          open={parcelDialog}
          onOpenChange={setParcelDialog}
          title="Nova correspondência"
          description="Registro simples para controle de retirada."
        >
          <form
            className="space-y-4"
            onSubmit={parcelForm.handleSubmit((payload) => {
              createParcelMutation.mutate(payload, {
                onSuccess: () => {
                  toast.success('Correspondência registrada com sucesso.');
                  parcelForm.reset();
                  setParcelDialog(false);
                },
                onError: () =>
                  toast.error('Não foi possível registrar a correspondência.'),
              });
            })}
          >
            <FormField label="Unidade" htmlFor="parcel-unit" required>
              <Controller
                control={parcelForm.control}
                name="unitId"
                rules={{ required: true }}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="parcel-unit">
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
            <FormField label="Transportadora" htmlFor="parcel-carrier" required>
              <Input
                id="parcel-carrier"
                {...parcelForm.register('carrier', { required: true })}
              />
            </FormField>
            <div className="grid grid-cols-1 gap-3 ds-sm:grid-cols-2">
              <FormField label="Código de rastreio" htmlFor="parcel-tracking">
                <Input
                  id="parcel-tracking"
                  {...parcelForm.register('trackingCode')}
                />
              </FormField>
              <FormField label="Observações" htmlFor="parcel-notes">
                <Input id="parcel-notes" {...parcelForm.register('notes')} />
              </FormField>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setParcelDialog(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={createParcelMutation.isPending}>
                {createParcelMutation.isPending ? 'Salvando…' : 'Registrar'}
              </Button>
            </DialogFooter>
          </form>
        </FormDialog>
      ) : null}
    </div>
  );
}
