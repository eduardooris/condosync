import { z } from 'zod';

const cnpjDigits = z
  .string()
  .transform((value) => value.replace(/\D/g, ''))
  .refine((digits) => /^\d{14}$/.test(digits), {
    message: 'CNPJ deve conter 14 dígitos numéricos.',
  });

export const createCondominiumSchema = z.object({
  name: z.string().trim().min(1, 'Nome é obrigatório.'),
  cnpj: cnpjDigits,
});

export type CreateCondominiumInput = z.infer<typeof createCondominiumSchema>;
