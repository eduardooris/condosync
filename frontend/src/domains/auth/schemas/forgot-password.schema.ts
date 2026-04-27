import { z } from 'zod';

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email('Informe um e-mail válido.'),
});

export type ForgotPasswordFormInput = z.infer<typeof forgotPasswordSchema>;

export interface ForgotPasswordInput {
  email: string;
}
