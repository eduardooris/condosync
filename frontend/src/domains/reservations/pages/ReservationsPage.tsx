import { useState } from 'react';
import { CalendarDays, Plus } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/shared/stores/auth.store';
import { canManageCondominiumStructure } from '@/shared/utils/roles';
import { useReservations } from '@/domains/reservations/hooks/useReservations';
import {
  formatUnitBlockNumber,
  useUnitsForCurrentMember,
} from '@/domains/units/hooks/useUnits';
import {
  reservationAreaSchema,
  reservationSchema,
  type ReservationAreaForm,
  type ReservationForm,
} from '@/domains/reservations/schemas/reservations.schema';
import { PageHeader } from '@/shared/components/ui/PageHeader';
import { Button } from '@/shared/components/ui/Button';
import { EmptyState } from '@/shared/components/ui/EmptyState';
import { ListSkeleton } from '@/shared/components/ui/Skeleton';
import { FormDialog, DialogFooter } from '@/shared/components/ui/Dialog';
import { FormField } from '@/shared/components/ui/FormField';
import { Input } from '@/shared/components/ui/Input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/Select';
import { GlassCard } from '@/shared/components/ui/GlassCard';

export function ReservationsPage() {
  const condo = useAuthStore((s) => s.activeCondominium);
  const role = useAuthStore((s) => s.role);
  const canManage = canManageCondominiumStructure(role);
  const [areaDialogOpen, setAreaDialogOpen] = useState(false);
  const [reservationDialogOpen, setReservationDialogOpen] = useState(false);
  const {
    areasQuery,
    reservationsQuery,
    createAreaMutation,
    createReservationMutation,
    approveMutation,
    rejectMutation,
    cancelMutation,
  } = useReservations(condo?.id);
  const { units, isLoading: unitsLoading } = useUnitsForCurrentMember(condo?.id);

  const areaForm = useForm<ReservationAreaForm>({
    resolver: zodResolver(reservationAreaSchema),
    defaultValues: {
      name: '',
      description: '',
      requiresApproval: false,
      maxPerUnitPerWeek: 1,
      slotMinutes: 60,
    },
  });
  const reservationForm = useForm<ReservationForm>({
    resolver: zodResolver(reservationSchema),
    defaultValues: {
      areaId: '',
      unitId: '',
      startAt: '',
      endAt: '',
    },
  });

  if (!condo?.id) {
    return <p className="ds-page text-ds-sm text-ds-dim">Selecione um condomínio no topo da página.</p>;
  }
  if (areasQuery.isLoading || reservationsQuery.isLoading || unitsLoading)
    return <ListSkeleton rows={5} />;

  const areas = areasQuery.data ?? [];
  const reservations = reservationsQuery.data ?? [];
  const areaNameById = new Map(areas.map((area) => [area.id, area.name]));
  const unitLabelById = new Map(units.map((unit) => [unit.id, formatUnitBlockNumber(unit)]));

  return (
    <div className="ds-page space-y-6">
      <PageHeader
        title="Reservas"
        description="MVP para controlar agenda de áreas comuns, regras e aprovações."
        actions={
          <div className="flex gap-2">
            {canManage ? (
              <Button variant="secondary" onClick={() => setAreaDialogOpen(true)}>
                <Plus className="h-4 w-4" />
                Nova área
              </Button>
            ) : null}
            <Button
              onClick={() => setReservationDialogOpen(true)}
              disabled={areas.length === 0}
              title={
                areas.length === 0
                  ? 'Cadastre uma área comum antes de criar reservas'
                  : undefined
              }
            >
              <CalendarDays className="h-4 w-4" />
              Nova reserva
            </Button>
          </div>
        }
      />

      {areas.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="Nenhuma área de reserva cadastrada"
          description="Cadastre primeiro as áreas comuns para começar a receber solicitações."
          action={
            canManage
              ? {
                  label: 'Cadastrar primeira área',
                  onClick: () => setAreaDialogOpen(true),
                }
              : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 ds-lg:grid-cols-2">
          {areas.map((area) => (
            <GlassCard key={area.id} className="space-y-2">
              <h3 className="text-ds-md font-semibold">{area.name}</h3>
              <p className="text-ds-xs text-ds-dim">{area.description || 'Sem descrição.'}</p>
              <p className="text-ds-xs text-ds-dim">
                Regra: {area.slotMinutes} min por slot · máx. {area.maxPerUnitPerWeek} reserva(s) por unidade/semana ·{' '}
                {area.requiresApproval ? 'com aprovação' : 'aprovação automática'}
              </p>
            </GlassCard>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {reservations.map((reservation) => (
          <GlassCard key={reservation.id} className="space-y-2">
            <p className="text-ds-sm font-semibold">
              {reservation.area?.name ?? areaNameById.get(reservation.areaId) ?? 'Área'} · {reservation.status}
            </p>
            <p className="text-ds-xs text-ds-dim">
              Unidade: {unitLabelById.get(reservation.unitId) ?? 'Unidade'} · {new Date(reservation.startAt).toLocaleString('pt-BR')} até{' '}
              {new Date(reservation.endAt).toLocaleString('pt-BR')}
            </p>
            <div className="flex gap-2">
              {canManage && reservation.status === 'PENDING' ? (
                <>
                  <Button
                    size="sm"
                    onClick={() =>
                      approveMutation.mutate(reservation.id, {
                        onSuccess: () => toast.success('Reserva aprovada.'),
                        onError: () => toast.error('Não foi possível aprovar a reserva.'),
                      })
                    }
                  >
                    Aprovar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      rejectMutation.mutate(
                        { reservationId: reservation.id, reason: 'Recusada pela administração.' },
                        {
                          onSuccess: () => toast.success('Reserva recusada.'),
                          onError: () => toast.error('Não foi possível recusar a reserva.'),
                        },
                      )
                    }
                  >
                    Recusar
                  </Button>
                </>
              ) : null}
              {(reservation.status === 'PENDING' || reservation.status === 'APPROVED') ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    cancelMutation.mutate(
                      { reservationId: reservation.id, reason: 'Cancelada pelo usuário.' },
                      {
                        onSuccess: () => toast.success('Reserva cancelada.'),
                        onError: () => toast.error('Não foi possível cancelar a reserva.'),
                      },
                    )
                  }
                >
                  Cancelar
                </Button>
              ) : null}
            </div>
          </GlassCard>
        ))}
      </div>

      <FormDialog
        open={areaDialogOpen}
        onOpenChange={setAreaDialogOpen}
        title="Nova área de reserva"
        description="Defina regras básicas para uso por unidade."
      >
        <form
          className="space-y-4"
          onSubmit={areaForm.handleSubmit((payload) => {
            createAreaMutation.mutate(payload, {
              onSuccess: () => {
                toast.success('Área cadastrada com sucesso.');
                areaForm.reset();
                setAreaDialogOpen(false);
              },
              onError: () => toast.error('Não foi possível cadastrar a área.'),
            });
          })}
        >
          <FormField label="Nome" htmlFor="area-name" required>
            <Input id="area-name" {...areaForm.register('name', { required: true })} />
          </FormField>
          <FormField label="Descrição" htmlFor="area-description">
            <Input id="area-description" {...areaForm.register('description')} />
          </FormField>
          <div className="grid grid-cols-1 gap-3 ds-sm:grid-cols-2">
            <FormField label="Máx/semana por unidade" htmlFor="area-max">
              <Input id="area-max" type="number" min={1} {...areaForm.register('maxPerUnitPerWeek', { valueAsNumber: true })} />
            </FormField>
            <FormField label="Slot (minutos)" htmlFor="area-slot">
              <Input id="area-slot" type="number" min={30} step={30} {...areaForm.register('slotMinutes', { valueAsNumber: true })} />
            </FormField>
          </div>
          <FormField label="Fluxo de aprovação" htmlFor="area-approval">
            <Controller
              control={areaForm.control}
              name="requiresApproval"
              render={({ field }) => (
                <Select value={field.value ? 'yes' : 'no'} onValueChange={(v) => field.onChange(v === 'yes')}>
                  <SelectTrigger id="area-approval">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no">Aprovação automática</SelectItem>
                    <SelectItem value="yes">Exigir aprovação</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setAreaDialogOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createAreaMutation.isPending}>
              {createAreaMutation.isPending ? 'Salvando…' : 'Cadastrar área'}
            </Button>
          </DialogFooter>
        </form>
      </FormDialog>

      <FormDialog
        open={reservationDialogOpen}
        onOpenChange={setReservationDialogOpen}
        title="Nova reserva"
        description="Selecione área, unidade e período."
      >
        <form
          className="space-y-4"
          onSubmit={reservationForm.handleSubmit((payload) => {
            createReservationMutation.mutate(payload, {
              onSuccess: () => {
                toast.success('Reserva registrada com sucesso.');
                reservationForm.reset();
                setReservationDialogOpen(false);
              },
              onError: () => toast.error('Não foi possível registrar a reserva.'),
            });
          })}
        >
          <FormField label="Área" htmlFor="reservation-area" required>
            <Controller
              control={reservationForm.control}
              name="areaId"
              rules={{ required: true }}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="reservation-area">
                    <SelectValue placeholder="Selecione a área" />
                  </SelectTrigger>
                  <SelectContent>
                    {areas.map((area) => (
                      <SelectItem key={area.id} value={area.id}>
                        {area.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>
          <FormField label="Unidade" htmlFor="reservation-unit" required>
            <Controller
              control={reservationForm.control}
              name="unitId"
              rules={{ required: true }}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="reservation-unit">
                    <SelectValue placeholder="Selecione a unidade" />
                  </SelectTrigger>
                  <SelectContent>
                    {units.map((unit) => (
                      <SelectItem key={unit.id} value={unit.id}>
                        {formatUnitBlockNumber(unit)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>
          <div className="grid grid-cols-1 gap-3 ds-sm:grid-cols-2">
            <FormField label="Início" htmlFor="reservation-start" required>
              <Input id="reservation-start" type="datetime-local" {...reservationForm.register('startAt', { required: true })} />
            </FormField>
            <FormField label="Fim" htmlFor="reservation-end" required>
              <Input id="reservation-end" type="datetime-local" {...reservationForm.register('endAt', { required: true })} />
            </FormField>
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setReservationDialogOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createReservationMutation.isPending}>
              {createReservationMutation.isPending ? 'Salvando…' : 'Solicitar reserva'}
            </Button>
          </DialogFooter>
        </form>
      </FormDialog>
    </div>
  );
}
