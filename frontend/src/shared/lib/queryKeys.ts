export const queryKeys = {
  auth: {
    me: () => ['auth', 'me'] as const,
  },
  dashboard: {
    summary: (condominiumId: string | undefined) => ['dashboard', condominiumId] as const,
    chart: (condominiumId: string | undefined) => ['dashboard-chart', condominiumId] as const,
  },
  polls: {
    list: (condominiumId: string | undefined) => ['polls', condominiumId] as const,
    participation: (condominiumId: string | undefined) => ['polls-participation', condominiumId] as const,
    results: (condominiumId: string | undefined, pollId: string | null) =>
      ['poll-results', condominiumId, pollId] as const,
  },
  expenses: {
    list: (condominiumId: string | undefined) => ['expenses', condominiumId] as const,
  },
  condominium: {
    detail: (condominiumId: string | undefined) => ['condominium', condominiumId] as const,
  },
  condominiums: {
    root: () => ['condominiums'] as const,
    mine: () => ['condominiums', 'mine'] as const,
    minePending: () => ['condominiums', 'mine', 'pending'] as const,
  },
  notifications: {
    list: (onlyUnread: boolean) => ['notifications', onlyUnread] as const,
    all: () => ['notifications'] as const,
    unreadCount: () => ['notifications-unread-count'] as const,
  },
  units: {
    list: (condominiumId: string | undefined) => ['units', condominiumId] as const,
    onboardingChecklist: (condominiumId: string | undefined) =>
      ['units-onboarding-checklist', condominiumId] as const,
  },
  charges: {
    /** `admin` = lista do condomínio; `mine` = cobranças das unidades do usuário (morador/responsável). */
    list: (condominiumId: string | undefined, scope: 'admin' | 'mine' = 'admin') =>
      ['charges', condominiumId, scope] as const,
  },
  bulletin: {
    list: (condominiumId: string | undefined) => ['bulletin', condominiumId] as const,
  },
  invitations: {
    list: (condominiumId: string | undefined) => ['invitations', condominiumId] as const,
    preview: (token: string) => ['invitation', 'preview', token] as const,
  },
  members: {
    pending: (condominiumId: string | undefined) => ['members', condominiumId, 'pending'] as const,
    approved: (condominiumId: string | undefined) => ['members', condominiumId, 'approved'] as const,
  },
  residents: {
    byUnit: (condominiumId: string | undefined, unitId: string | undefined) =>
      ['residents', condominiumId, unitId] as const,
    myProfile: (condominiumId: string | undefined) =>
      ['residents', condominiumId, 'me'] as const,
  },
  visitors: {
    list: (condominiumId: string | undefined) => ['visitors', condominiumId] as const,
    parcels: (condominiumId: string | undefined) => ['parcels', condominiumId] as const,
  },
  reservations: {
    list: (condominiumId: string | undefined) => ['reservations', condominiumId] as const,
    areas: (condominiumId: string | undefined) => ['reservation-areas', condominiumId] as const,
  },
};
