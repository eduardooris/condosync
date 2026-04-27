import { api } from '@/shared/lib/axios';
import type { components } from '@/shared/types/openapi.generated';

export type DashboardData = components['schemas']['DashboardSummaryResponseDto'];
export type DashboardChartRow = components['schemas']['DashboardChartRowDto'];

export const dashboardService = {
  getSummary: (condId: string) => api.get<DashboardData, DashboardData>(`/condominiums/${condId}/dashboard`),
  getChart: (condId: string) =>
    api.get<DashboardChartRow[], DashboardChartRow[]>(`/condominiums/${condId}/dashboard/chart`),
};
