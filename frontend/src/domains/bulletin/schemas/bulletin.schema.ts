import { z } from 'zod';

export const bulletinFormSchema = z.object({
  title: z.string().trim().min(1, 'Título obrigatório.'),
  body: z.string().trim().min(1, 'Mensagem obrigatória.'),
  priority: z.enum(['INFO', 'ATTENTION', 'URGENT']),
});

export type BulletinFormInput = z.infer<typeof bulletinFormSchema>;
