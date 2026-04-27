import { z } from 'zod';

export const unitFormSchema = z.object({
  block: z.string().trim().min(1, 'Bloco é obrigatório.'),
  number: z.string().trim().min(1, 'Número é obrigatório.'),
  type: z.enum(['APARTMENT', 'HOUSE', 'COMMERCIAL']),
  status: z.enum(['OCCUPIED', 'VACANT']),
});

export type UnitFormInput = z.infer<typeof unitFormSchema>;
