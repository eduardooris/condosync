import type { UserRole } from '@/shared/types/auth.types';

/** Cadastro de unidades e moradores, cobranças avançadas, etc. */
export function canManageCondominiumStructure(role: UserRole | null | undefined): boolean {
  return role === 'ADMIN' || role === 'SUB_ADMIN';
}

/**
 * Síndico ou subsíndico no condomínio ativo — rotas e ações de gestão:
 * mural (publicar), despesas (lançar), estrutura, visitantes (aprovar), etc.
 * Morador (`RESIDENT`) e responsável financeiro (`RESPONSIBLE`) retornam `false`.
 */
export function canAccessCondominiumAdminRoutes(role: UserRole | null | undefined): boolean {
  return role === 'ADMIN' || role === 'SUB_ADMIN';
}
