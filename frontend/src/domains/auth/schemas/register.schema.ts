import { z } from 'zod';

const passwordRules = z
  .string()
  .min(8, 'Use pelo menos 8 caracteres.')
  .refine((value) => /[A-Za-z]/.test(value) && /\d/.test(value), {
    message: 'Combine letras e números.',
  });

export const registerSchema = z
  .object({
    fullName: z.string().min(3, 'Informe seu nome completo.').max(120),
    email: z.string().email('Informe um e-mail válido.'),
    password: passwordRules,
    confirmPassword: z.string(),
    acceptTerms: z.boolean().refine((v) => v, {
      message: 'É preciso aceitar os termos para continuar.',
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'As senhas não coincidem.',
  });

export type RegisterFormInput = z.infer<typeof registerSchema>;

export interface RegisterInput {
  fullName: string;
  email: string;
  password: string;
}
