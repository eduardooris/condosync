import { z } from 'zod';

const optionalDocument = z
  .string()
  .optional()
  .transform((value) => (value ?? '').replace(/\D/g, ''))
  .refine(
    (digits) => digits === '' || digits.length === 11 || digits.length === 14,
    {
      message:
        'Informe 11 dígitos (CPF) ou 14 (CNPJ), ou deixe em branco.',
    },
  );

export const createCondominiumSchema = z.object({
  name: z.string().trim().min(1, 'Nome é obrigatório.'),
  cnpj: optionalDocument,
});

/** Valores validados enviados à API (após transform do Zod). */
export type CreateCondominiumFormValues = z.infer<typeof createCondominiumSchema>;
