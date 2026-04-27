import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { visitorsService } from '@/domains/visitors/services/visitors.service';
import { queryKeys } from '@/shared/lib/queryKeys';

export function useVisitors(condominiumId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.visitors.list(condominiumId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.visitors.parcels(condominiumId) });
  };

  const visitorsQuery = useQuery({
    queryKey: queryKeys.visitors.list(condominiumId),
    queryFn: () => visitorsService.listVisitors(condominiumId!),
    enabled: Boolean(condominiumId),
  });
  const parcelsQuery = useQuery({
    queryKey: queryKeys.visitors.parcels(condominiumId),
    queryFn: () => visitorsService.listParcels(condominiumId!),
    enabled: Boolean(condominiumId),
  });

  const createVisitorMutation = useMutation({
    mutationFn: (payload: {
      unitId: string;
      visitorName: string;
      visitorDocument?: string;
      expectedAt: string;
      notes?: string;
    }) => visitorsService.createVisitor(condominiumId!, payload),
    onSuccess: invalidate,
  });
  const updateVisitorStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'EXPECTED' | 'ARRIVED' | 'CANCELED' }) =>
      visitorsService.updateVisitorStatus(condominiumId!, id, { status }),
    onSuccess: invalidate,
  });
  const createParcelMutation = useMutation({
    mutationFn: (payload: {
      unitId: string;
      residentId?: string;
      carrier: string;
      trackingCode?: string;
      notes?: string;
    }) => visitorsService.createParcel(condominiumId!, payload),
    onSuccess: invalidate,
  });
  const updateParcelStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'RECEIVED' | 'DELIVERED' }) =>
      visitorsService.updateParcelStatus(condominiumId!, id, { status }),
    onSuccess: invalidate,
  });

  return {
    visitorsQuery,
    parcelsQuery,
    createVisitorMutation,
    updateVisitorStatusMutation,
    createParcelMutation,
    updateParcelStatusMutation,
  };
}
