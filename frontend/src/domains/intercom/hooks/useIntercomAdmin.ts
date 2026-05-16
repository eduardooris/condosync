import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import toast from 'react-hot-toast';
import { intercomAdminService } from '@/domains/intercom/services/intercom-admin.service';
import { queryKeys } from '@/shared/lib/queryKeys';

function extractError(err: unknown): string {
  if (err instanceof AxiosError) {
    const msg = err.response?.data?.message;
    if (typeof msg === 'string') return msg;
    if (Array.isArray(msg)) return msg[0] ?? 'Falha na operação.';
  }
  return 'Falha na operação.';
}

export function useIntercomAdmin(condominiumId: string | undefined) {
  const qc = useQueryClient();
  const enabled = Boolean(condominiumId);

  const tokensQuery = useQuery({
    queryKey: queryKeys.intercom.tokens(condominiumId),
    queryFn: () => intercomAdminService.listTokens(condominiumId!),
    enabled,
  });

  const sessionsQuery = useQuery({
    queryKey: queryKeys.intercom.sessions(condominiumId),
    queryFn: () => intercomAdminService.listSessions(condominiumId!),
    enabled,
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: queryKeys.intercom.tokens(condominiumId) });
    void qc.invalidateQueries({ queryKey: queryKeys.intercom.sessions(condominiumId) });
  };

  const createTokenMutation = useMutation({
    mutationFn: (label?: string) =>
      intercomAdminService.createToken(condominiumId!, label),
    onSuccess: () => {
      invalidate();
      toast.success('Link da portaria gerado. Copie ou baixe o QR agora — o token completo só aparece uma vez.');
    },
    onError: (err) => toast.error(extractError(err)),
  });

  const revokeTokenMutation = useMutation({
    mutationFn: (tokenId: string) =>
      intercomAdminService.revokeToken(condominiumId!, tokenId),
    onSuccess: () => {
      invalidate();
      toast.success('Token de portaria revogado.');
    },
    onError: (err) => toast.error(extractError(err)),
  });

  return {
    tokens: tokensQuery.data ?? [],
    sessions: sessionsQuery.data ?? [],
    isLoading: tokensQuery.isLoading || sessionsQuery.isLoading,
    createTokenMutation,
    revokeTokenMutation,
    lastCreated: createTokenMutation.data ?? null,
  };
}
