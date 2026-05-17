import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Home, Link2, Plus } from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import { EmptyState } from '@/shared/components/ui/EmptyState';
import { GlassCard } from '@/shared/components/ui/GlassCard';
import { PageHeader } from '@/shared/components/ui/PageHeader';
import { ListSkeleton } from '@/shared/components/ui/Skeleton';
import { useUnits, useUnitsOnboardingChecklist } from '@/domains/units/hooks/useUnits';
import { UnitFormDialog } from '@/domains/units/components/UnitFormDialog';
import { UnitsListColumn } from '@/domains/units/components/UnitsListColumn';
import { UnitDetailPanel } from '@/domains/units/components/UnitDetailPanel';
import { GenerateResidentInviteDialog } from '@/domains/invitations/components/GenerateResidentInviteDialog';
import { useAuthStore } from '@/shared/stores/auth.store';
import { canManageCondominiumStructure } from '@/shared/utils/roles';
import type { Unit } from '@/shared/types/api';

/**
 * Layout master-detail:
 * - Desktop (ds-lg+): coluna de unidades à esquerda + painel da unidade
 *   selecionada à direita. Seleção persiste no querystring `?unit=`.
 * - Mobile: só a coluna de unidades. Toque navega para `/units/:id` numa
 *   tela dedicada (UnitDetailPage) — sem modal flutuante perdendo contexto.
 */
export function UnitsPage() {
  const condo = useAuthStore((state) => state.activeCondominium);
  const role = useAuthStore((state) => state.role);
  const canCreate = canManageCondominiumStructure(role);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [createUnitOpen, setCreateUnitOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  const { data, isLoading } = useUnits(condo?.id);
  const { data: onboardingChecklist = [] } = useUnitsOnboardingChecklist(condo?.id);

  const units = useMemo(() => data ?? [], [data]);
  const checklistByUnitId = useMemo(
    () => new Map(onboardingChecklist.map((item) => [item.unitId, item])),
    [onboardingChecklist],
  );

  const selectedUnitId = searchParams.get('unit');
  const selectedUnit = useMemo(
    () => units.find((u) => u.id === selectedUnitId) ?? null,
    [units, selectedUnitId],
  );

  // Seleção automática da primeira unidade em desktop quando nada está
  // selecionado — garante que o painel direito nunca fica vazio no carregamento.
  useEffect(() => {
    if (!selectedUnitId && units.length > 0) {
      const isDesktop =
        typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches;
      if (isDesktop) {
        const next = new URLSearchParams(searchParams);
        next.set('unit', units[0].id);
        setSearchParams(next, { replace: true });
      }
    }
    // Limpa selected se a unidade não existir mais na lista (deleção/condomínio trocado).
    if (selectedUnitId && units.length > 0 && !units.some((u) => u.id === selectedUnitId)) {
      const next = new URLSearchParams(searchParams);
      next.delete('unit');
      setSearchParams(next, { replace: true });
    }
  }, [selectedUnitId, units, searchParams, setSearchParams]);

  const handleSelectUnit = (unit: Unit) => {
    const isDesktop =
      typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches;
    if (isDesktop) {
      const next = new URLSearchParams(searchParams);
      next.set('unit', unit.id);
      setSearchParams(next);
    } else {
      navigate(`/units/${unit.id}`);
    }
  };

  if (!condo?.id) {
    return (
      <p className="ds-page text-ds-sm text-ds-dim">
        Selecione um condomínio no topo da página.
      </p>
    );
  }

  if (isLoading) return <ListSkeleton rows={6} />;

  const headerActions = canCreate ? (
    <div className="flex flex-wrap gap-2">
      <Button variant="secondary" onClick={() => setInviteOpen(true)}>
        <Link2 className="h-4 w-4" aria-hidden />
        Gerar link de cadastro
      </Button>
      <Button onClick={() => setCreateUnitOpen(true)}>
        <Plus className="h-4 w-4" aria-hidden />
        Nova unidade
      </Button>
    </div>
  ) : undefined;

  if (units.length === 0) {
    return (
      <div className="ds-page space-y-6">
        <PageHeader
          title="Unidades & moradores"
          description="Cadastre os blocos/apartamentos e seus moradores."
          actions={headerActions}
        />
        <EmptyState
          icon={Home}
          title="Nenhuma unidade cadastrada"
          description="Sem unidades, cobranças e várias outras funções ficam bloqueadas. Use o setup assistant pra cadastrar em lote ou cadastre uma a uma."
          action={canCreate ? { to: '/setup', label: 'Abrir setup assistant' } : undefined}
        />
        {canCreate ? (
          <>
            <UnitFormDialog
              open={createUnitOpen}
              onOpenChange={setCreateUnitOpen}
              condominiumId={condo.id}
              onCreated={(unit) => {
                const next = new URLSearchParams(searchParams);
                next.set('unit', unit.id);
                setSearchParams(next, { replace: true });
              }}
            />
            <GenerateResidentInviteDialog
              open={inviteOpen}
              onOpenChange={setInviteOpen}
              condominiumId={condo.id}
            />
          </>
        ) : null}
      </div>
    );
  }

  return (
    <div className="ds-page space-y-4">
      <PageHeader
        title="Unidades & moradores"
        description="Selecione uma unidade para gerenciar seus moradores."
        actions={headerActions}
      />

      <div className="grid min-h-0 grid-cols-1 gap-4 ds-lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        {/* Coluna esquerda — só lista no desktop. No mobile vira a tela inteira. */}
        <GlassCard
          variant="default"
          padded={false}
          className="flex max-h-[calc(100dvh-14rem)] min-h-0 flex-col p-3 ds-lg:max-h-[calc(100dvh-12rem)]"
        >
          <UnitsListColumn
            units={units}
            checklistByUnitId={checklistByUnitId}
            selectedUnitId={selectedUnitId}
            onSelect={handleSelectUnit}
          />
        </GlassCard>

        {/* Painel direito — visível apenas em desktop. Mobile usa rota dedicada. */}
        <GlassCard
          variant="default"
          padded={false}
          className="hidden max-h-[calc(100dvh-12rem)] min-h-0 flex-col p-5 ds-lg:flex"
        >
          {selectedUnit ? (
            <UnitDetailPanel
              condominiumId={condo.id}
              unit={selectedUnit}
              checklist={checklistByUnitId.get(selectedUnit.id) ?? null}
              canEdit={canCreate}
              onEdit={() => setEditingUnit(selectedUnit)}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
              <Home className="h-10 w-10 text-ds-subtle" aria-hidden />
              <p className="text-ds-sm font-semibold text-ds-body">
                Selecione uma unidade
              </p>
              <p className="text-ds-xs text-ds-dim">
                Os moradores da unidade selecionada aparecem aqui.
              </p>
            </div>
          )}
        </GlassCard>
      </div>

      {/* Aviso só em mobile quando nenhuma unidade está selecionada — ajuda a quem
          chegou via deep-link sem ID. */}
      <p className="text-center text-[11px] text-ds-subtle ds-lg:hidden">
        <Link to="/units" className="underline-offset-2 hover:underline">
          Toque numa unidade
        </Link>{' '}
        para abrir os moradores.
      </p>

      {canCreate ? (
        <>
          <UnitFormDialog
            open={createUnitOpen}
            onOpenChange={setCreateUnitOpen}
            condominiumId={condo.id}
            onCreated={(unit) => {
              const next = new URLSearchParams(searchParams);
              next.set('unit', unit.id);
              setSearchParams(next, { replace: true });
            }}
          />
          <UnitFormDialog
            open={Boolean(editingUnit)}
            onOpenChange={(open) => {
              if (!open) setEditingUnit(null);
            }}
            condominiumId={condo.id}
            unit={editingUnit}
          />
          <GenerateResidentInviteDialog
            open={inviteOpen}
            onOpenChange={setInviteOpen}
            condominiumId={condo.id}
          />
        </>
      ) : null}
    </div>
  );
}
