import { z } from 'zod';

const cpfDigits = z
  .string()
  .transform((value) => value.replace(/\D/g, ''))
  .refine((digits) => digits === '' || /^\d{11}$/.test(digits), {
    message: 'CPF deve conter 11 dígitos.',
  });

const whatsappDigits = z
  .string()
  .transform((value) => value.replace(/\D/g, ''))
  .refine((digits) => digits === '' || /^\d{10,11}$/.test(digits), {
    message: 'WhatsApp deve conter DDD + número (10 ou 11 dígitos).',
  });

export const acceptInviteSchema = z
  .object({
    fullName: z.string().trim().min(1, 'Informe seu nome.'),
    email: z.string().trim().email('Informe um e-mail válido.').optional(),
    password: z.string().min(8, 'A senha precisa ter pelo menos 8 caracteres.'),
    confirmPassword: z.string().min(1, 'Confirme sua senha.'),
    unitId: z.string().optional(),
    cpf: cpfDigits.optional(),
    phoneWhatsapp: whatsappDigits.optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'As senhas não coincidem.',
  });

export type AcceptInviteFormInput = z.infer<typeof acceptInviteSchema>;
