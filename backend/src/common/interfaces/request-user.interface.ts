import { UserRole } from '../enums';

export interface RequestUser {
  id: string;
  email?: string;
}

export interface CondominiumMembershipContext {
  condominiumId: string;
  role: UserRole;
}
