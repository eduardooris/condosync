import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  paymentAccountsService,
  type CreatePaymentAccountInput,
  type PaymentAccountResponse,
} from '@/domains/payments/services/payment-accounts.service';
import { queryKeys } from '@/shared/lib/queryKeys';

/**
 * Hook integrado para gerenciar a subconta Asaas de um condomínio:
 * query (status + onboarding URL), `create`, `refresh` e
 * `refreshOnboardingLink`. Invalida o cache automaticamente em sucessos.
 *
 * `data === null` significa "ainda não foi criada" — UI mostra CTA de criar.
 * `data.status === 'ACTIVE'` é o estado feliz; demais estados bloqueiam
 * geração de cobrança (validação acontece no backend, ver
 * `ChargesService.runChargeGenerationPreflight`).
 */
export function usePaymentAccount(condominiumId: string | undefined) {
  const qc = useQueryClient();
  const queryKey = queryKeys.paymentAccount.byCondo(condominiumId);

  const query = useQuery<PaymentAccountResponse | null>({
    queryKey,
    queryFn: () => paymentAccountsService.get(condominiumId!),
    enabled: Boolean(condominiumId),
    // Quando subconta em análise, refetch a cada 30s para detectar aprovação
    // sem o síndico precisar dar refresh manualmente.
    refetchInterval: (q) => {
      const status = q.state.data?.status;
      if (status === 'PENDING_DOCS' || status === 'PENDING_REVIEW') {
        return 30_000;
      }
      return false;
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey });

  const createMutation = useMutation({
    mutationFn: (payload: CreatePaymentAccountInput) =>
      paymentAccountsService.create(condominiumId!, payload),
    onSuccess: invalidate,
  });

  const refreshMutation = useMutation({
    mutationFn: () => paymentAccountsService.refresh(condominiumId!),
    onSuccess: invalidate,
  });

  const refreshOnboardingMutation = useMutation({
    mutationFn: () =>
      paymentAccountsService.refreshOnboardingLink(condominiumId!),
    onSuccess: invalidate,
  });

  return {
    account: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    createMutation,
    refreshMutation,
    refreshOnboardingMutation,
  };
}
