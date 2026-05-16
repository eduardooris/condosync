import { z } from 'zod';

export const portariaVisitorSchema = z.object({
  unitId: z.string().uuid('Selecione uma unidade.'),
  visitorName: z
    .string()
    .trim()
    .min(2, 'Informe seu nome (mínimo 2 caracteres).')
    .max(80, 'Nome muito longo (máximo 80 caracteres).'),
});

export type PortariaVisitorForm = z.infer<typeof portariaVisitorSchema>;
