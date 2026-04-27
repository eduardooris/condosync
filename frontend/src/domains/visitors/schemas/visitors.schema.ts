import { z } from 'zod';

export const visitorSchema = z.object({
  unitId: z.string().trim().min(1, 'Unidade é obrigatória.'),
  visitorName: z.string().trim().min(1, 'Nome é obrigatório.'),
  visitorDocument: z.string().optional(),
  expectedAt: z.string().min(1, 'Data/hora prevista é obrigatória.'),
  notes: z.string().optional(),
});

export const parcelSchema = z.object({
  unitId: z.string().trim().min(1, 'Unidade é obrigatória.'),
  carrier: z.string().trim().min(1, 'Transportadora é obrigatória.'),
  trackingCode: z.string().optional(),
  notes: z.string().optional(),
});

export type VisitorFormInput = z.infer<typeof visitorSchema>;
export type ParcelFormInput = z.infer<typeof parcelSchema>;
