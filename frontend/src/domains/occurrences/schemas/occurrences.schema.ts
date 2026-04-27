import { z } from 'zod';

export const occurrenceFormSchema = z.object({
  unitId: z.string().trim().min(1, 'Unidade é obrigatória.'),
  title: z.string().trim().min(1, 'Título é obrigatório.'),
  category: z.string().trim().min(1, 'Categoria é obrigatória.'),
  description: z.string().trim().min(1, 'Descrição é obrigatória.'),
  isAnonymous: z.boolean(),
});

export type OccurrenceFormValues = z.infer<typeof occurrenceFormSchema>;
