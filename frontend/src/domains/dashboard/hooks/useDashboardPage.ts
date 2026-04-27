import { useQuery } from '@tanstack/react-query';
import { dashboardService } from '@/domains/dashboard/services/dashboard.service';
import { queryKeys } from '@/shared/lib/queryKeys';

export function useDashboardPage(condominiumId: string | undefined) {
  const summaryQuery = useQuery({
    queryKey: queryKeys.dashboard.summary(condominiumId),
    queryFn: () => dashboardService.getSummary(condominiumId!),
    enabled: Boolean(condominiumId),
  });

  const chartQuery = useQuery({
    queryKey: queryKeys.dashboard.chart(condominiumId),
    queryFn: () => dashboardService.getChart(condominiumId!),
    enabled: Boolean(condominiumId),
  });

  return { summaryQuery, chartQuery };
}
