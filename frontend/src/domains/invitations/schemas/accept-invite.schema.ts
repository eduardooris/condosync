import { z } from 'zod';

export const acceptInviteSchema = z
  .object({
    fullName: z.string().trim().min(1, 'Informe seu nome.'),
    email: z.string().trim().email('Informe um e-mail válido.').optional(),
    password: z.string().min(8, 'A senha precisa ter pelo menos 8 caracteres.'),
    confirmPassword: z.string().min(1, 'Confirme sua senha.'),
    unitId: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'As senhas não coincidem.',
  });

export type AcceptInviteFormInput = z.infer<typeof acceptInviteSchema>;
