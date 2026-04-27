import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { unitsService } from '@/domains/units/services/units.service';
import { queryKeys } from '@/shared/lib/queryKeys';
import { useAuthStore } from '@/shared/stores/auth.store';
import { canAccessCondominiumAdminRoutes } from '@/shared/utils/roles';
import type { Unit } from '@/shared/types/api';

export function useUnits(
  condominiumId: string | undefined,
  options?: { enabled?: boolean },
) {
  const enabled =
    Boolean(condominiumId) && (options?.enabled === undefined ? true : options.enabled);
  return useQuery({
    queryKey: queryKeys.units.list(condominiumId),
    queryFn: () => unitsService.list(condominiumId!),
    enabled,
  });
}

/** Unidade mínima para selects quando o usuário não pode listar todas as unidades (API admin-only). */
function syntheticMemberUnit(condominiumId: string, unitId: string): Unit {
  const now = new Date().toISOString();
  return {
    id: unitId,
    condominiumId,
    block: 'Sua unidade',
    number: '',
    type: 'APARTMENT',
    status: 'OCCUPIED',
    createdAt: now,
    updatedAt: now,
  };
}

/** Rótulo para select / lista — unidade sintética do morador usa só `block`. */
export function formatUnitBlockNumber(unit: Pick<Unit, 'block' | 'number'>): string {
  const b = unit.block?.trim() ?? '';
  const n = unit.number?.trim() ?? '';
  if (b && n) return `${b} · ${n}`;
  if (b) return b;
  if (n) return n;
  return 'Unidade';
}

/**
 * Lista completa de unidades (síndico/subsíndico) ou só a unidade do membership
 * (morador / responsável financeiro) — evita 403 em `GET /units` para não-admin.
 */
export function useUnitsForCurrentMember(condominiumId: string | undefined) {
  const role = useAuthStore((s) => s.role);
  const myUnitId = useAuthStore((s) => s.activeCondominium?.unitId);
  const canListAll = canAccessCondominiumAdminRoutes(role);
  const q = useUnits(condominiumId, { enabled: Boolean(condominiumId) && canListAll });

  const units = useMemo((): Unit[] => {
    if (canListAll) return q.data ?? [];
    if (condominiumId && myUnitId) return [syntheticMemberUnit(condominiumId, myUnitId)];
    return [];
  }, [canListAll, q.data, condominiumId, myUnitId]);

  const isLoading = Boolean(condominiumId) && canListAll && q.isLoading;
  return { units, isLoading };
}

export function useUnitsOnboardingChecklist(condominiumId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.units.onboardingChecklist(condominiumId),
    queryFn: () => unitsService.onboardingChecklist(condominiumId!),
    enabled: Boolean(condominiumId),
  });
}
