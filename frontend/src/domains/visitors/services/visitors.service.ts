import { api } from '@/shared/lib/axios';

export type VisitorEntryStatus = 'EXPECTED' | 'ARRIVED' | 'CANCELED';
export type ParcelStatus = 'RECEIVED' | 'DELIVERED';

export interface VisitorEntry {
  id: string;
  condominiumId: string;
  unitId: string;
  residentId: string;
  visitorName: string;
  visitorDocument: string | null;
  expectedAt: string;
  status: VisitorEntryStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Parcel {
  id: string;
  condominiumId: string;
  unitId: string;
  residentId: string | null;
  carrier: string;
  trackingCode: string | null;
  status: ParcelStatus;
  receivedAt: string;
  deliveredAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export const visitorsService = {
  listVisitors: (condominiumId: string) =>
    api.get<VisitorEntry[], VisitorEntry[]>(
      `/condominiums/${condominiumId}/visitors`,
    ),
  createVisitor: (
    condominiumId: string,
    payload: {
      unitId: string;
      visitorName: string;
      visitorDocument?: string;
      expectedAt: string;
      notes?: string;
    },
  ) =>
    api.post<typeof payload, VisitorEntry>(
      `/condominiums/${condominiumId}/visitors`,
      payload,
    ),
  updateVisitorStatus: (
    condominiumId: string,
    id: string,
    payload: { status: VisitorEntryStatus },
  ) =>
    api.patch<typeof payload, VisitorEntry>(
      `/condominiums/${condominiumId}/visitors/${id}/status`,
      payload,
    ),
  listParcels: (condominiumId: string) =>
    api.get<Parcel[], Parcel[]>(
      `/condominiums/${condominiumId}/visitors/parcels`,
    ),
  createParcel: (
    condominiumId: string,
    payload: {
      unitId: string;
      residentId?: string;
      carrier: string;
      trackingCode?: string;
      notes?: string;
    },
  ) =>
    api.post<typeof payload, Parcel>(
      `/condominiums/${condominiumId}/visitors/parcels`,
      payload,
    ),
  updateParcelStatus: (
    condominiumId: string,
    id: string,
    payload: { status: ParcelStatus },
  ) =>
    api.patch<typeof payload, Parcel>(
      `/condominiums/${condominiumId}/visitors/parcels/${id}/status`,
      payload,
    ),
};
