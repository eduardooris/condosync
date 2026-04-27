import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  reservationsService,
  type CreateReservationAreaInput,
  type CreateReservationInput,
} from '@/domains/reservations/services/reservations.service';
import { queryKeys } from '@/shared/lib/queryKeys';

export function useReservations(condominiumId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.reservations.list(condominiumId) });
    queryClient.invalidateQueries({
      queryKey: queryKeys.reservations.areas(condominiumId),
    });
  };

  const areasQuery = useQuery({
    queryKey: queryKeys.reservations.areas(condominiumId),
    queryFn: () => reservationsService.listAreas(condominiumId!),
    enabled: Boolean(condominiumId),
  });

  const reservationsQuery = useQuery({
    queryKey: queryKeys.reservations.list(condominiumId),
    queryFn: () => reservationsService.list(condominiumId!),
    enabled: Boolean(condominiumId),
  });

  const createAreaMutation = useMutation({
    mutationFn: (payload: CreateReservationAreaInput) =>
      reservationsService.createArea(condominiumId!, payload),
    onSuccess: invalidate,
  });

  const createReservationMutation = useMutation({
    mutationFn: (payload: CreateReservationInput) =>
      reservationsService.create(condominiumId!, payload),
    onSuccess: invalidate,
  });

  const approveMutation = useMutation({
    mutationFn: (reservationId: string) =>
      reservationsService.approve(condominiumId!, reservationId),
    onSuccess: invalidate,
  });

  const rejectMutation = useMutation({
    mutationFn: ({ reservationId, reason }: { reservationId: string; reason?: string }) =>
      reservationsService.reject(condominiumId!, reservationId, reason),
    onSuccess: invalidate,
  });

  const cancelMutation = useMutation({
    mutationFn: ({ reservationId, reason }: { reservationId: string; reason?: string }) =>
      reservationsService.cancel(condominiumId!, reservationId, reason),
    onSuccess: invalidate,
  });

  return {
    areasQuery,
    reservationsQuery,
    createAreaMutation,
    createReservationMutation,
    approveMutation,
    rejectMutation,
    cancelMutation,
  };
}
