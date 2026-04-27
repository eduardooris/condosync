import { z } from 'zod';

export const pollFormSchema = z.object({
  title: z.string().trim().min(1, 'Título é obrigatório.'),
  description: z.string().optional(),
  closesAt: z.string().min(1, 'Data de encerramento é obrigatória.'),
  optionA: z.string().trim().min(1, 'Opção 1 é obrigatória.'),
  optionB: z.string().trim().min(1, 'Opção 2 é obrigatória.'),
});

export type PollFormValues = z.infer<typeof pollFormSchema>;
