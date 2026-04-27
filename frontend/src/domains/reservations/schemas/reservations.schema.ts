import { z } from 'zod';

export const reservationAreaSchema = z.object({
  name: z.string().trim().min(1, 'Nome é obrigatório.'),
  description: z.string().optional(),
  requiresApproval: z.boolean(),
  maxPerUnitPerWeek: z.number().min(1, 'Mínimo de 1 reserva por semana.'),
  slotMinutes: z.number().min(30, 'Mínimo de 30 minutos por slot.'),
});

export const reservationSchema = z
  .object({
    areaId: z.string().trim().min(1, 'Área é obrigatória.'),
    unitId: z.string().trim().min(1, 'Unidade é obrigatória.'),
    startAt: z.string().min(1, 'Início é obrigatório.'),
    endAt: z.string().min(1, 'Fim é obrigatório.'),
  })
  .refine((value) => new Date(value.endAt).getTime() > new Date(value.startAt).getTime(), {
    path: ['endAt'],
    message: 'Fim deve ser maior que o início.',
  });

export type ReservationAreaForm = z.infer<typeof reservationAreaSchema>;
export type ReservationForm = z.infer<typeof reservationSchema>;
