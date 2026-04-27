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
}
