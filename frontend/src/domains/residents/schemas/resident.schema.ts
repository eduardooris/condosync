import { z } from 'zod';

const requiredEmailField = z
  .string()
  .trim()
  .email('Informe um e-mail válido');

/** Aceita vazio ou e-mail válido; saída `string | undefined` para a API. */
const optionalEmailField = z
  .string()
  .trim()
  .refine(
    (value) => value === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    'Informe um e-mail válido ou deixe em branco',
  )
  .transform((value) => (value === '' ? undefined : value));

const cpfDigits = z
  .string()
  .transform((value) => value.replace(/\D/g, ''))
  .refine((digits) => /^\d{11}$/.test(digits), {
    message: 'CPF deve conter 11 dígitos numéricos.',
  });

const whatsappDigits = z
  .string()
  .transform((value) => value.replace(/\D/g, ''))
  .refine((digits) => /^\d{10,11}$/.test(digits), {
    message: 'WhatsApp deve conter DDD + número (10 ou 11 dígitos).',
  });

export const createResidentSchema = z.object({
  fullName: z.string().min(2),
  cpf: cpfDigits,
  phoneWhatsapp: whatsappDigits,
  /** Valor padrão vem do `defaultValues` do formulário — evita divergência input/output do Zod. */
  isFinancialResponsible: z.boolean(),
  email: requiredEmailField,
});

export type CreateResidentInput = z.infer<typeof createResidentSchema>;

/** Edição: não altera responsável financeiro aqui (use &quot;Definir responsável&quot;). */
export const editResidentFormSchema = z.object({
  fullName: z.string().min(2),
  cpf: cpfDigits,
  phoneWhatsapp: whatsappDigits,
  email: optionalEmailField,
});

export type EditResidentFormInput = z.infer<typeof editResidentFormSchema>;
