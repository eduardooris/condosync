import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  chargesService,
  type CreateChargeInput,
  type MarkPaidInput,
  type UpdateChargeInput,
} from '@/domains/charges/services/charges.service';
import { queryKeys } from '@/shared/lib/queryKeys';

export type ChargesListScope = 'admin' | 'mine';

export function useCharges(
  condId: string | undefined,
  listScope: ChargesListScope = 'admin',
) {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.charges.list(condId, listScope) });

  const query = useQuery({
    queryKey: queryKeys.charges.list(condId, listScope),
    queryFn: () =>
      listScope === 'mine'
        ? chargesService.listMine(condId!)
        : chargesService.list(condId!),
    enabled: Boolean(condId),
  });

  const payMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload?: MarkPaidInput }) =>
      chargesService.markPaid(id, payload),
    onSuccess: invalidate,
  });

  const emitAsaasPendingMutation = useMutation({
    mutationFn: () => chargesService.emitAsaasPending(condId!),
    onSuccess: invalidate,
  });

  const exemptMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      chargesService.exempt(id, reason),
    onSuccess: invalidate,
  });

  const generateMutation = useMutation({
    mutationFn: (billingMonth?: string) =>
      chargesService.generateMonth(condId!, billingMonth),
    onSuccess: invalidate,
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreateChargeInput) =>
      chargesService.createOne(condId!, payload),
    onSuccess: invalidate,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateChargeInput }) =>
      chargesService.update(condId!, id, payload),
    onSuccess: invalidate,
  });

  const resendWhatsappMutation = useMutation({
    mutationFn: (chargeId: string) => chargesService.resendWhatsapp(condId!, chargeId),
  });

  const rejectPaymentRequestMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      chargesService.rejectPaymentRequest(id, reason),
    onSuccess: invalidate,
  });

  return {
    ...query,
    payMutation,
    emitAsaasPendingMutation,
    exemptMutation,
    generateMutation,
    createMutation,
    updateMutation,
    resendWhatsappMutation,
    rejectPaymentRequestMutation,
  };
}
