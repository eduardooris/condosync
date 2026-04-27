import { api } from '@/shared/lib/axios';
import type { Expense } from '@/shared/types/api';

interface CreateExpenseInput {
  description: string;
  amount: number;
  expenseDate: string;
  category: 'MAINTENANCE' | 'CLEANING' | 'CONCIERGE' | 'LEGAL' | 'OTHER';
  vendor?: string;
}

export const expensesService = {
  list: (condId: string) => api.get<Expense[], Expense[]>(`/condominiums/${condId}/expenses`),
  create: (condId: string, payload: CreateExpenseInput) =>
    api.post<CreateExpenseInput, Expense>(`/condominiums/${condId}/expenses`, payload),
};
