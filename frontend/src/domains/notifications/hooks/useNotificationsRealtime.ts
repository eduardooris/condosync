import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { connectNotificationsSocket } from '@/domains/notifications/lib/notifications-socket';
import { useAuthStore } from '@/shared/stores/auth.store';
import { queryKeys } from '@/shared/lib/queryKeys';

/**
 * Mantém um socket aberto enquanto o usuário está autenticado e, quando
 * chega um `notification:new` do backend, invalida as queries de
 * notificação para que a UI atualize sem precisar de polling agressivo.
 *
 * Use-o no topo da árvore (Layout protegido) — montar/desmontar dentro
 * de páginas individuais desconectaria/reconectaria a cada navegação.
 */
export function useNotificationsRealtime(): void {
  const token = useAuthStore((s) => s.token);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!token) return undefined;
    const socket = connectNotificationsSocket(token, {
      onNew: () => {
        // Invalida lista (qualquer condomínio) e o contador do badge.
        // Mais barato do que mesclar payloads à mão.
        queryClient.invalidateQueries({
          queryKey: queryKeys.notifications.all(),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.notifications.unreadCount(),
        });
      },
    });
    return () => {
      socket.disconnect();
    };
  }, [token, queryClient]);
}
