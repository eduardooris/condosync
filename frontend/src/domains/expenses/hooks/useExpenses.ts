import { useQuery } from '@tanstack/react-query';
import { expensesService } from '@/domains/expenses/services/expenses.service';
import { queryKeys } from '@/shared/lib/queryKeys';

export function useExpenses(condId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.expenses.list(condId),
    queryFn: () => expensesService.list(condId!),
    enabled: Boolean(condId),
  });
}
