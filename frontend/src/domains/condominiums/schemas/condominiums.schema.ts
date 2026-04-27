import { z } from 'zod';

export const createCondominiumSchema = z.object({
  name: z.string().trim().min(1, 'Nome é obrigatório.'),
  cnpj: z.string().regex(/^\d{14}$/, 'CNPJ deve conter 14 dígitos numéricos.'),
});

export type CreateCondominiumInput = z.infer<typeof createCondominiumSchema>;
