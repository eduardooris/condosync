import { UserRole } from '../enums';

export interface RequestUser {
  id: string;
  email?: string;
  /** Realm roles do Keycloak — populadas pelo `JwtAuthGuard`. */
  realmRoles?: string[];
}

export interface CondominiumMembershipContext {
  condominiumId: string;
  role: UserRole;
}
