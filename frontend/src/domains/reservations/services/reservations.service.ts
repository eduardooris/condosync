import { api } from '@/shared/lib/axios';

export type ReservationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELED';

export interface ReservationArea {
  id: string;
  condominiumId: string;
  name: string;
  description: string | null;
  requiresApproval: boolean;
  maxPerUnitPerWeek: number;
  slotMinutes: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Reservation {
  id: string;
  condominiumId: string;
  areaId: string;
  unitId: string;
  residentId: string;
  startAt: string;
  endAt: string;
  status: ReservationStatus;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
  area?: ReservationArea;
}

export interface CreateReservationAreaInput {
  name: string;
  description?: string;
  requiresApproval?: boolean;
  maxPerUnitPerWeek?: number;
  slotMinutes?: number;
}

export interface CreateReservationInput {
  areaId: string;
  unitId: string;
  startAt: string;
  endAt: string;
}

export const reservationsService = {
  listAreas: (condominiumId: string) =>
    api.get<ReservationArea[], ReservationArea[]>(
      `/condominiums/${condominiumId}/reservations/areas`,
    ),
  createArea: (condominiumId: string, payload: CreateReservationAreaInput) =>
    api.post<CreateReservationAreaInput, ReservationArea>(
      `/condominiums/${condominiumId}/reservations/areas`,
      payload,
    ),
  list: (condominiumId: string) =>
    api.get<Reservation[], Reservation[]>(
      `/condominiums/${condominiumId}/reservations`,
    ),
  create: (condominiumId: string, payload: CreateReservationInput) =>
    api.post<CreateReservationInput, Reservation>(
      `/condominiums/${condominiumId}/reservations`,
      payload,
    ),
  approve: (condominiumId: string, reservationId: string) =>
    api.post<Record<string, never>, Reservation>(
      `/condominiums/${condominiumId}/reservations/${reservationId}/approve`,
      {},
    ),
  reject: (condominiumId: string, reservationId: string, reason?: string) =>
    api.post<{ reason?: string }, Reservation>(
      `/condominiums/${condominiumId}/reservations/${reservationId}/reject`,
      { reason },
    ),
  cancel: (condominiumId: string, reservationId: string, reason?: string) =>
    api.post<{ reason?: string }, Reservation>(
      `/condominiums/${condominiumId}/reservations/${reservationId}/cancel`,
      { reason },
    ),
};
