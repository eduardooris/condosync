import { z } from 'zod';

export const documentFormSchema = z.object({
  title: z.string().trim().min(1, 'Título obrigatório.'),
  description: z.string().optional(),
  category: z.string().trim().min(1, 'Categoria obrigatória.'),
  documentDate: z.string().min(1, 'Data obrigatória.'),
  visibility: z.enum(['ALL', 'ADMIN_ONLY']),
  file: z
    .unknown()
    .refine((value) => value instanceof FileList && value.length > 0, 'Arquivo obrigatório.'),
});

export type DocumentFormInput = z.infer<typeof documentFormSchema>;
