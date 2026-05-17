export enum UserRole {
  ADMIN = 'ADMIN',
  SUB_ADMIN = 'SUB_ADMIN',
  RESPONSIBLE = 'RESPONSIBLE',
  RESIDENT = 'RESIDENT',
}

export enum UnitType {
  APARTMENT = 'APARTMENT',
  HOUSE = 'HOUSE',
  COMMERCIAL = 'COMMERCIAL',
}

export enum UnitStatus {
  OCCUPIED = 'OCCUPIED',
  VACANT = 'VACANT',
}

export enum ChargeStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  EXEMPT = 'EXEMPT',
  CANCELED = 'CANCELED',
}

export enum PixKeyType {
  CPF = 'CPF',
  CNPJ = 'CNPJ',
  EMAIL = 'EMAIL',
  PHONE = 'PHONE',
  EVP = 'EVP',
}

export enum ExpenseCategory {
  MAINTENANCE = 'MAINTENANCE',
  CLEANING = 'CLEANING',
  CONCIERGE = 'CONCIERGE',
  LEGAL = 'LEGAL',
  OTHER = 'OTHER',
}

export enum ExpenseApprovalStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
}

export enum PollStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
}

export enum OccurrenceStatus {
  OPEN = 'OPEN',
  UNDER_REVIEW = 'UNDER_REVIEW',
  RESOLVED = 'RESOLVED',
  ARCHIVED = 'ARCHIVED',
}

export enum DocumentVisibility {
  ALL = 'ALL',
  ADMIN_ONLY = 'ADMIN_ONLY',
}

export enum BulletinPriority {
  INFO = 'INFO',
  ATTENTION = 'ATTENTION',
  URGENT = 'URGENT',
  EVENT = 'EVENT',
  MAINTENANCE = 'MAINTENANCE',
}

/** Sessão de interfone / portaria virtual (doc 05). */
export enum IntercomSessionStatus {
  INITIATED = 'INITIATED',
  RINGING = 'RINGING',
  PREVIEW = 'PREVIEW',
  ANSWERED = 'ANSWERED',
  ENDED = 'ENDED',
  MISSED = 'MISSED',
  CANCELED_BY_VISITOR = 'CANCELED_BY_VISITOR',
  REJECTED = 'REJECTED',
  FAILED = 'FAILED',
}

export enum IntercomSessionUpdateReason {
  ANSWERED_BY_OTHER = 'ANSWERED_BY_OTHER',
  TIMEOUT = 'TIMEOUT',
  VISITOR_LEFT = 'VISITOR_LEFT',
  REJECTED = 'REJECTED',
  ALL_REJECTED = 'ALL_REJECTED',
  ENDED = 'ENDED',
}

export enum IntercomRejectPolicy {
  CONTINUE_RINGING = 'continue_ringing',
  ALL_REJECTED = 'all_rejected',
}

export enum DevicePlatform {
  IOS = 'IOS',
  ANDROID = 'ANDROID',
  WEB = 'WEB',
}
