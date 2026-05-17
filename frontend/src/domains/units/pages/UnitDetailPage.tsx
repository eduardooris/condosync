import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { GlassCard } from '@/shared/components/ui/GlassCard';
import { EmptyState } from '@/shared/components/ui/EmptyState';
import { ListSkeleton } from '@/shared/components/ui/Skeleton';
import { Button } from '@/shared/components/ui/Button';
import { useUnits, useUnitsOnboardingChecklist } from '@/domains/units/hooks/useUnits';
import { UnitFormDialog } from '@/domains/units/components/UnitFormDialog';
import { UnitDetailPanel } from '@/domains/units/components/UnitDetailPanel';
import { useAuthStore } from '@/shared/stores/auth.store';
import { canManageCondominiumStructure } from '@/shared/utils/roles';
import type { Unit } from '@/shared/types/api';

/**
 * Tela dedicada de uma unidade. Usada no mobile (rota `/units/:id`) e
 * acessível como deep-link no desktop também. Carrega a lista de unidades
 * pra resolver `unitId` -> `Unit` (a checklist endpoint não devolve `type`).
 */
export function UnitDetailPage() {
  const params = useParams<{ id: string }>();
  const navigate = useNavigate();
  const condo = useAuthStore((state) => state.activeCondominium);
  const role = useAuthStore((state) => state.role);
  const canCreate = canManageCondominiumStructure(role);

  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);

  const { data, isLoading } = useUnits(condo?.id);
  const { data: onboardingChecklist = [] } = useUnitsOnboardingChecklist(condo?.id);

  const units = useMemo(() => data ?? [], [data]);
  const checklistByUnitId = useMemo(
    () => new Map(onboardingChecklist.map((item) => [item.unitId, item])),
    [onboardingChecklist],
  );

  const unit = useMemo(
    () => units.find((u) => u.id === params.id) ?? null,
    [units, params.id],
  );

  if (!condo?.id) {
    return (
      <p className="ds-page text-ds-sm text-ds-dim">
        Selecione um condomínio no topo da página.
      </p>
    );
  }

  if (isLoading) return <ListSkeleton rows={6} />;

  if (!unit) {
    return (
      <div className="ds-page space-y-4">
        <Button variant="ghost" onClick={() => navigate('/units')}>
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Voltar
        </Button>
        <EmptyState
          icon={ArrowLeft}
          title="Unidade não encontrada"
          description="Talvez ela tenha sido removida ou pertence a outro condomínio."
          action={{ to: '/units', label: 'Voltar à lista' }}
        />
      </div>
    );
  }

  return (
    <div className="ds-page space-y-3">
      <Link
        to="/units"
        className="inline-flex items-center gap-1.5 text-ds-xs font-semibold text-ds-dim transition hover:text-ds-body"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        Unidades
      </Link>

      <GlassCard variant="default" padded={false} className="p-4 ds-md:p-5">
        <UnitDetailPanel
          condominiumId={condo.id}
          unit={unit}
          checklist={checklistByUnitId.get(unit.id) ?? null}
          canEdit={canCreate}
          onEdit={() => setEditingUnit(unit)}
        />
      </GlassCard>

      {canCreate ? (
        <UnitFormDialog
          open={Boolean(editingUnit)}
          onOpenChange={(open) => {
            if (!open) setEditingUnit(null);
          }}
          condominiumId={condo.id}
          unit={editingUnit}
        />
      ) : null}
    </div>
  );
}
