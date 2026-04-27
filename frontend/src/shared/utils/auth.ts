import type { UserRole } from '@/shared/types/auth.types';

/**
 * Claims do JWT do Keycloak que nos importam:
 *   - `realm_access.roles[]`
 *   - `resource_access.<clientId>.roles[]`
 */
interface TokenPayload {
  realm_access?: { roles?: string[] };
  resource_access?: Record<string, { roles?: string[] } | undefined>;
  azp?: string;
}

/** Role do realm Keycloak que indica "pode criar/gerir condomínios". */
const CONDO_ADMIN_ROLE = 'condo-admin';

function decodePayload(token: string): TokenPayload | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(b64)) as TokenPayload;
  } catch {
    return null;
  }
}

function collectKeycloakRoles(payload: TokenPayload): string[] {
  const out = new Set<string>();
  for (const r of payload.realm_access?.roles ?? []) out.add(r);
  const resAccess = payload.resource_access ?? {};
  for (const client of Object.keys(resAccess)) {
    for (const r of resAccess[client]?.roles ?? []) out.add(r);
  }
  return [...out];
}

/**
 * Decide se o usuário tem permissão **global** para criar/administrar
 * condomínios. Usado quando o usuário ainda não está vinculado a nenhum
 * condomínio (a role do `UserCondominium` ainda não existe).
 *
 * Verifica `realm_access.roles` para `condo-admin`.
 */
export function canCreateCondominiumFromJwt(token: string): boolean {
  const payload = decodePayload(token);
  if (!payload) return false;
  return collectKeycloakRoles(payload).includes(CONDO_ADMIN_ROLE);
}

/**
 * Mantido por compatibilidade com telas que ainda usam `role` para gating
 * de UI. A role **definitiva** dentro de um condomínio vive em
 * `user_condominiums.role` no backend; aqui só inferimos um valor inicial
 * a partir do JWT (até o backend devolver a role real do condomínio
 * ativo).
 */
export function extractRoleFromJwt(token: string): UserRole {
  return canCreateCondominiumFromJwt(token) ? 'ADMIN' : 'RESIDENT';
}
