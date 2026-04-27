import { z } from 'zod';

export const editProfileSchema = z.object({
  fullName: z.string().trim().min(1, 'Informe seu nome.').max(200),
  phoneWhatsapp: z
    .string()
    .trim()
    .transform((v) => v.replace(/\D/g, ''))
    .refine((digits) => digits === '' || (digits.length >= 10 && digits.length <= 13), {
      message: 'Informe DDD + WhatsApp (10 a 13 dígitos; DDI 55 opcional).',
    }),
});

export type EditProfileInput = z.infer<typeof editProfileSchema>;
