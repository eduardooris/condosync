import { z } from 'zod';

/**
 * RN-10.3: rejeitar caracteres de controle no nome do visitante.
 * Cobre U+0000..U+001F (controles C0) e U+007F (DEL).
 * Implementado via charCodeAt para evitar chars literais no regex que
 * editores/normalizadores podem corromper silenciosamente.
 */
function hasControlChars(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

export const portariaVisitorSchema = z.object({
  unitId: z.string().uuid('Selecione uma unidade.'),
  visitorName: z
    .string()
    .trim()
    .min(2, 'Informe seu nome (mínimo 2 caracteres).')
    .max(80, 'Nome muito longo (máximo 80 caracteres).')
    .refine((v) => !hasControlChars(v), {
      message: 'Nome contém caracteres inválidos.',
    }),
});

export type PortariaVisitorForm = z.infer<typeof portariaVisitorSchema>;
