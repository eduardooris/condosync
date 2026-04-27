import { useMutation, useQueryClient } from '@tanstack/react-query';
import { expensesService } from '@/domains/expenses/services/expenses.service';
import type { ExpenseFormValues } from '@/domains/expenses/schemas/expenses.schema';
import { queryKeys } from '@/shared/lib/queryKeys';

export function useExpensesPage(condominiumId: string | undefined) {
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (payload: ExpenseFormValues) => expensesService.create(condominiumId!, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.expenses.list(condominiumId) }),
  });

  return { createMutation };
}
