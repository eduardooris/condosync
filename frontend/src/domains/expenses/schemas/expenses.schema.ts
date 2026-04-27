import { z } from 'zod';

export const expenseFormSchema = z.object({
  description: z.string().trim().min(1, 'Descrição é obrigatória.'),
  amount: z.number().min(0.01, 'Valor deve ser maior que zero.'),
  expenseDate: z.string().min(1, 'Data é obrigatória.'),
  category: z.enum(['MAINTENANCE', 'CLEANING', 'CONCIERGE', 'LEGAL', 'OTHER']),
  vendor: z.string().optional(),
});

export type ExpenseFormValues = z.infer<typeof expenseFormSchema>;
