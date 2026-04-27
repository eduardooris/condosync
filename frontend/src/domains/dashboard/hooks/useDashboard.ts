import { useQuery } from '@tanstack/react-query';
import { dashboardService } from '@/domains/dashboard/services/dashboard.service';
import { queryKeys } from '@/shared/lib/queryKeys';

export function useDashboard(condId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.dashboard.summary(condId),
    queryFn: () => dashboardService.getSummary(condId!),
    enabled: Boolean(condId),
  });
}
