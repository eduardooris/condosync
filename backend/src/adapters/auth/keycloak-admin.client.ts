import {
  BadGatewayException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '../../config/env.schema';

interface CachedToken {
  accessToken: string;
  /** Epoch ms em que o token expira (com folga de 30s já descontada). */
  expiresAt: number;
}

interface KeycloakRoleRepresentation {
  id: string;
  name: string;
  description?: string;
  composite?: boolean;
  clientRole?: boolean;
  containerId?: string;
}

interface KeycloakUserRepresentation {
  id: string;
  username?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  enabled?: boolean;
}

/**
 * Cliente para falar com a Admin API do Keycloak.
 *
 * Autenticação via `client_credentials` no cliente confidencial
 * `condo-backend-admin` (definido em `realm-main.json`). O service-account
 * desse cliente recebe roles do client `realm-management` (manage-users etc.)
 * para conseguir gerenciar usuários do realm.
 *
 * O token é cacheado em memória até a expiração (com folga de 30s).
 */
@Injectable()
export class KeycloakAdminClient {
  private readonly logger = new Logger(KeycloakAdminClient.name);
  private readonly internalUrl: string;
  private readonly realm: string;
  private readonly clientId: string;
  private readonly clientSecret: string;

  private cache: CachedToken | null = null;

  constructor(private readonly config: ConfigService<Env, true>) {
    const issuer = (
      this.config.get('KEYCLOAK_ISSUER', { infer: true }) ?? ''
    ).replace(/\/$/, '');
    const internal =
      this.config.get('KEYCLOAK_INTERNAL_URL', { infer: true }) ?? issuer;
    this.internalUrl = internal.replace(/\/$/, '');
    // `internalUrl` aponta pra `.../realms/main`. Extraímos o nome do realm.
    const match = this.internalUrl.match(/\/realms\/([^/]+)$/);
    this.realm = match?.[1] ?? 'main';
    this.clientId =
      this.config.get('KEYCLOAK_ADMIN_CLIENT_ID', { infer: true }) ??
      'condo-backend-admin';
    this.clientSecret =
      this.config.get('KEYCLOAK_ADMIN_CLIENT_SECRET', { infer: true }) ?? '';
  }

  /** Base URL do servidor Keycloak (sem `/realms/<realm>`). */
  private get serverBaseUrl(): string {
    return this.internalUrl.replace(/\/realms\/[^/]+$/, '');
  }

  /** Base da Admin API do realm (`<server>/admin/realms/<realm>`). */
  private get adminBaseUrl(): string {
    return `${this.serverBaseUrl}/admin/realms/${this.realm}`;
  }

  /** Endpoint de token (`<server>/realms/<realm>/protocol/openid-connect/token`). */
  private get tokenUrl(): string {
    return `${this.internalUrl}/protocol/openid-connect/token`;
  }

  // -----------------------------------------------------------------
  // Token cache
  // -----------------------------------------------------------------

  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.cache && this.cache.expiresAt > now) {
      return this.cache.accessToken;
    }
    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });
    const res = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const body = (await res.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    if (!res.ok) {
      const detail =
        typeof body.error_description === 'string'
          ? body.error_description
          : 'unknown';
      throw new BadGatewayException(
        `Keycloak admin token error (${res.status}): ${detail}`,
      );
    }
    const token = String(body.access_token ?? '');
    const expiresIn = Number(body.expires_in ?? 60);
    this.cache = {
      accessToken: token,
      expiresAt: now + (expiresIn - 30) * 1000,
    };
    return token;
  }

  private async authedFetch(
    path: string,
    init: RequestInit = {},
  ): Promise<Response> {
    const token = await this.getAccessToken();
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${token}`);
    if (init.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    return fetch(`${this.adminBaseUrl}${path}`, { ...init, headers });
  }

  // -----------------------------------------------------------------
  // Operações públicas
  // -----------------------------------------------------------------

  /**
   * Cria um usuário no realm.
   *
   * Atenção: o Keycloak NÃO expande composite roles no token (só a role pai
   * é listada em `realm_access.roles`). Por isso `condo-admin` precisa ser
   * atribuída **diretamente** ao usuário — não dá pra contar com o composite
   * de `default-roles-main`.
   *
   * - `assignCondoAdmin=true`: ATRIBUI `condo-admin` explicitamente.
   * - `assignCondoAdmin=false`: não atribui (caso de usuário criado via
   *   convite, que entra como morador).
   *
   * Retorna o `userId` do Keycloak (UUID).
   *
   * Nome/sobrenome e flags (`emailVerified`, `enabled`) são preenchidos aqui
   * para evitar `account is not fully set up` no grant password (Keycloak 24+).
   */
  async createUser(params: {
    email: string;
    password: string;
    fullName?: string | null;
    assignCondoAdmin: boolean;
  }): Promise<string> {
    const { email, password, fullName, assignCondoAdmin } = params;

    const [firstNamePart, ...rest] = (fullName ?? '').trim().split(/\s+/);
    const lastNamePart = rest.join(' ');
    const localFromEmail =
      email.includes('@') && !email.startsWith('@')
        ? email.slice(0, email.indexOf('@'))
        : '';
    const firstName = (firstNamePart || localFromEmail || 'Usuário').trim();
    const lastName = (lastNamePart || '-').trim();

    const res = await this.authedFetch('/users', {
      method: 'POST',
      body: JSON.stringify({
        username: email,
        email,
        emailVerified: true,
        enabled: true,
        firstName,
        lastName,
        credentials: [
          {
            type: 'password',
            value: password,
            temporary: false,
          },
        ],
      }),
    });

    if (res.status === 409) {
      throw new ConflictException('E-mail já cadastrado.');
    }
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new BadGatewayException(
        `Keycloak createUser falhou (${res.status}): ${detail}`,
      );
    }

    // Keycloak retorna o ID no header Location: .../users/<id>
    const location = res.headers.get('location') ?? '';
    const userId = location.split('/').pop();
    if (!userId) {
      // Fallback: busca por email.
      const found = await this.findUserByEmail(email);
      if (!found) {
        throw new BadGatewayException(
          'Usuário criado no Keycloak mas ID não pôde ser recuperado.',
        );
      }
      return found.id;
    }

    if (assignCondoAdmin) {
      try {
        await this.assignRealmRole(userId, 'condo-admin');
      } catch (err) {
        this.logger.warn(
          `Falha ao atribuir condo-admin a ${userId}: ${(err as Error).message}`,
        );
      }
    }

    return userId;
  }

  async findUserByEmail(
    email: string,
  ): Promise<KeycloakUserRepresentation | null> {
    const trimmed = email.trim();
    if (!trimmed) {
      return null;
    }
    const exact = await this.queryUsersByExactEmail(trimmed);
    if (exact[0]) {
      return exact[0];
    }
    const lower = trimmed.toLowerCase();
    if (lower !== trimmed) {
      const byLower = await this.queryUsersByExactEmail(lower);
      if (byLower[0]) {
        return byLower[0];
      }
    }
    return this.findUserByEmailSearchFallback(lower);
  }

  private async queryUsersByExactEmail(
    email: string,
  ): Promise<KeycloakUserRepresentation[]> {
    const qs = new URLSearchParams({ email, exact: 'true' }).toString();
    const res = await this.authedFetch(`/users?${qs}`);
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new BadGatewayException(
        `Keycloak findUserByEmail falhou (${res.status}): ${detail}`,
      );
    }
    return (await res.json()) as KeycloakUserRepresentation[];
  }

  private async findUserByEmailSearchFallback(
    normalizedEmail: string,
  ): Promise<KeycloakUserRepresentation | null> {
    const qs = new URLSearchParams({
      search: normalizedEmail,
      max: '50',
    }).toString();
    const res = await this.authedFetch(`/users?${qs}`);
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new BadGatewayException(
        `Keycloak findUserByEmail (fallback) falhou (${res.status}): ${detail}`,
      );
    }
    const list = (await res.json()) as KeycloakUserRepresentation[];
    return (
      list.find((u) => (u.email ?? '').toLowerCase() === normalizedEmail) ??
      null
    );
  }

  /**
   * Atualiza `enabled` no Keycloak (GET + PUT com representação completa).
   * Se o usuário não existir (404), registra aviso e retorna sem erro.
   */
  async setUserEnabled(userId: string, enabled: boolean): Promise<void> {
    const resGet = await this.authedFetch(`/users/${userId}`);
    if (resGet.status === 404) {
      this.logger.warn(
        `Keycloak: usuário ${userId} não encontrado ao alterar enabled.`,
      );
      return;
    }
    if (!resGet.ok) {
      const detail = await resGet.text().catch(() => '');
      throw new BadGatewayException(
        `Keycloak getUser falhou (${resGet.status}): ${detail}`,
      );
    }
    const user = (await resGet.json()) as Record<string, unknown>;
    const resPut = await this.authedFetch(`/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify({ ...user, id: userId, enabled }),
    });
    if (!resPut.ok) {
      const detail = await resPut.text().catch(() => '');
      throw new BadGatewayException(
        `Keycloak setUserEnabled falhou (${resPut.status}): ${detail}`,
      );
    }
  }

  async setPassword(userId: string, password: string): Promise<void> {
    const res = await this.authedFetch(`/users/${userId}/reset-password`, {
      method: 'PUT',
      body: JSON.stringify({
        type: 'password',
        value: password,
        temporary: false,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new BadGatewayException(
        `Keycloak setPassword falhou (${res.status}): ${detail}`,
      );
    }
  }

  /**
   * Remove usuário do realm no Keycloak.
   * Se o usuário não existir (404), retorna sem erro.
   */
  async deleteUser(userId: string): Promise<void> {
    const res = await this.authedFetch(`/users/${userId}`, {
      method: 'DELETE',
    });
    if (res.status === 404) {
      this.logger.warn(
        `Keycloak: usuário ${userId} não encontrado ao remover.`,
      );
      return;
    }
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new BadGatewayException(
        `Keycloak deleteUser falhou (${res.status}): ${detail}`,
      );
    }
  }

  async sendUpdatePasswordEmail(userId: string): Promise<void> {
    const res = await this.authedFetch(
      `/users/${userId}/execute-actions-email`,
      {
        method: 'PUT',
        body: JSON.stringify(['UPDATE_PASSWORD']),
      },
    );
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new BadGatewayException(
        `Keycloak sendUpdatePasswordEmail falhou (${res.status}): ${detail}`,
      );
    }
  }

  async assignRealmRole(userId: string, roleName: string): Promise<void> {
    const role = await this.getRealmRole(roleName);
    const res = await this.authedFetch(`/users/${userId}/role-mappings/realm`, {
      method: 'POST',
      body: JSON.stringify([role]),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new BadGatewayException(
        `Keycloak assignRealmRole falhou (${res.status}): ${detail}`,
      );
    }
  }

  async removeRealmRole(userId: string, roleName: string): Promise<void> {
    const role = await this.getRealmRole(roleName);
    const res = await this.authedFetch(`/users/${userId}/role-mappings/realm`, {
      method: 'DELETE',
      body: JSON.stringify([role]),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new BadGatewayException(
        `Keycloak removeRealmRole falhou (${res.status}): ${detail}`,
      );
    }
  }

  private async getRealmRole(
    roleName: string,
  ): Promise<KeycloakRoleRepresentation> {
    const res = await this.authedFetch(
      `/roles/${encodeURIComponent(roleName)}`,
    );
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new BadGatewayException(
        `Keycloak getRealmRole(${roleName}) falhou (${res.status}): ${detail}`,
      );
    }
    return (await res.json()) as KeycloakRoleRepresentation;
  }
}
