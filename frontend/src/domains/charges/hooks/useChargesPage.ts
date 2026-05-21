import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/shared/stores/auth.store';
import { useCharges } from '@/domains/charges/hooks/useCharges';
import { unitsService } from '@/domains/units/services/units.service';
import { condominiumsService } from '@/domains/condominiums/services/condominiums.service';
import { queryKeys } from '@/shared/lib/queryKeys';

export type StatusFilter =
  | 'all'
  | 'pending'
  | 'paid'
  | 'overdue'
  | 'exempt'
  /** Cobranças com solicitação de baixa do morador esperando o síndico. */
  | 'requested';

export function useChargesPage() {
  const condId = useAuthStore((state) => state.activeCondominium?.id);
  const userRole = useAuthStore((state) => state.activeCondominium?.role);
  const canManage = userRole === 'ADMIN' || userRole === 'SUB_ADMIN';
  const chargesListScope = canManage ? 'admin' : 'mine';
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [generateOpen, setGenerateOpen] = useState(false);

  const chargesQuery = useCharges(condId, chargesListScope);
  const condominiumQuery = useQuery({
    queryKey: queryKeys.condominium.detail(condId),
    queryFn: () => condominiumsService.getOne(condId!),
    /** Moradores precisam dos dados de Pix/contato ao abrir detalhes da cobrança. */
    enabled: Boolean(condId),
  });
  const unitsQuery = useQuery({
    queryKey: queryKeys.units.list(condId),
    queryFn: () => unitsService.list(condId!),
    enabled: Boolean(condId) && canManage,
  });

  const unitLabelById = useMemo(() => {
    const map = new Map<string, string>();
    (unitsQuery.data ?? []).forEach((u) => {
      map.set(u.id, `${u.block} • ${u.number}`);
    });
    return map;
  }, [unitsQuery.data]);

  const list = useMemo(() => chargesQuery.data ?? [], [chargesQuery.data]);
  const pendingRequestsCount = useMemo(
    () =>
      list.filter(
        (c) =>
          c.paymentRequestAt &&
          (c.status === 'PENDING' || c.status === 'OVERDUE'),
      ).length,
    [list],
  );
  const filtered = useMemo(() => {
    let next = list;
    if (statusFilter === 'requested') {
      next = next.filter(
        (c) =>
          c.paymentRequestAt &&
          (c.status === 'PENDING' || c.status === 'OVERDUE'),
      );
    } else if (statusFilter !== 'all') {
      next = next.filter((c) => c.status.toLowerCase() === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      next = next.filter(
        (c) =>
          c.unitId?.toLowerCase().includes(q) ||
          (c.unitId
            ? (unitLabelById.get(c.unitId) ?? '').toLowerCase().includes(q)
            : false) ||
          String(c.amount).includes(q),
      );
    }
    return next;
  }, [list, statusFilter, search, unitLabelById]);

  return {
    condId,
    canManage,
    statusFilter,
    setStatusFilter,
    search,
    setSearch,
    generateOpen,
    setGenerateOpen,
    chargesQuery,
    condominiumQuery,
    unitsQuery,
    unitLabelById,
    list,
    filtered,
    pendingRequestsCount,
  };
}
