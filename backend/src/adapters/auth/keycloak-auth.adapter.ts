import {
  BadGatewayException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '../../config/env.schema';
import { verifyJwtWithJwks } from '../../common/utils/jwt-verify';
import { IAuthAdapter, JwtClaims } from './auth.adapter';
import { KeycloakAdminClient } from './keycloak-admin.client';

@Injectable()
export class KeycloakAuthAdapter implements IAuthAdapter {
  private readonly logger = new Logger(KeycloakAuthAdapter.name);
  /** Issuer público — usado para validar a claim `iss` do JWT. */
  private readonly issuer: string;
  /** Base interna usada para falar com o Keycloak (token endpoint, JWKS). */
  private readonly internalUrl: string;
  private readonly clientId: string;
  private readonly clientSecret?: string;
  private readonly jwksUri: string;

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly admin: KeycloakAdminClient,
  ) {
    this.issuer = (
      this.config.get('KEYCLOAK_ISSUER', { infer: true }) ?? ''
    ).replace(/\/$/, '');
    const internal =
      this.config.get('KEYCLOAK_INTERNAL_URL', { infer: true }) ?? this.issuer;
    this.internalUrl = internal.replace(/\/$/, '');
    this.clientId =
      this.config.get('KEYCLOAK_CLIENT_ID', { infer: true }) ?? '';
    this.clientSecret = this.config.get('KEYCLOAK_CLIENT_SECRET', {
      infer: true,
    });
    this.jwksUri = `${this.internalUrl}/protocol/openid-connect/certs`;
  }

  async verifyAccessToken(token: string): Promise<JwtClaims> {
    const payload = await verifyJwtWithJwks({
      token,
      jwksUri: this.jwksUri,
      issuer: this.issuer,
    });
    const sub = typeof payload.sub === 'string' ? payload.sub : undefined;
    if (!sub) {
      throw new Error('Token inválido: claim "sub" ausente.');
    }
    return {
      sub,
      email: typeof payload.email === 'string' ? payload.email : undefined,
    };
  }

  async signInWithPassword(
    email: string,
    password: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    return this.signInWithPasswordOnce(email.trim(), password);
  }

  private async signInWithPasswordOnce(
    email: string,
    password: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const tokenUrl = `${this.internalUrl}/protocol/openid-connect/token`;
    const params = new URLSearchParams({
      grant_type: 'password',
      client_id: this.clientId,
      username: email,
      password,
    });
    if (this.clientSecret) {
      params.set('client_secret', this.clientSecret);
    }

    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const data = (await res.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    if (!res.ok) {
      const detail =
        typeof data.error_description === 'string'
          ? data.error_description
          : 'unknown error';
      if (res.status === 400 || res.status === 401) {
        const normalized = detail.toLowerCase();
        if (normalized.includes('disabled')) {
          throw new UnauthorizedException(
            'Sua conta está desativada no momento. Fale com a administração.',
          );
        }
        if (normalized.includes('account is not fully set up')) {
          throw new UnauthorizedException(
            'Cadastro de acesso incompleto no provedor. Fale com à administração.',
          );
        }
        throw new UnauthorizedException('Credenciais inválidas.');
      }
      throw new BadGatewayException(
        `Falha ao autenticar no Keycloak (${res.status}): ${detail}`,
      );
    }
    return {
      accessToken: String(data.access_token ?? ''),
      refreshToken: String(data.refresh_token ?? ''),
    };
  }

  async signOut(accessToken: string): Promise<void> {
    void accessToken;
    this.logger.warn(
      'signOut via backend não é necessário no fluxo atual (front chama logout do Keycloak com refresh token).',
    );
  }

  async refreshSession(
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const tokenUrl = `${this.internalUrl}/protocol/openid-connect/token`;
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: this.clientId,
      refresh_token: refreshToken,
    });
    if (this.clientSecret) {
      params.set('client_secret', this.clientSecret);
    }

    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const data = (await res.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    if (!res.ok) {
      const detail =
        typeof data.error_description === 'string'
          ? data.error_description
          : 'unknown error';
      if (res.status === 400 || res.status === 401) {
        throw new UnauthorizedException(
          `Refresh token inválido/expirado: ${detail}`,
        );
      }
      throw new BadGatewayException(
        `Falha ao renovar sessão no Keycloak (${res.status}): ${detail}`,
      );
    }
    return {
      accessToken: String(data.access_token ?? ''),
      refreshToken: String(data.refresh_token ?? ''),
    };
  }

  /**
   * Cria um usuário no Keycloak via Admin API e faz auto-login (password
   * grant) para retornar tokens. Por padrão atribui a realm role
   * `condo-admin` (usuário pode criar condomínios). O fluxo de aceite de
   * convite chama com `assignCondoAdmin=false`.
   */
  async signUp(params: {
    email: string;
    password: string;
    fullName?: string;
    assignCondoAdmin?: boolean;
  }): Promise<{
    userId: string;
    email: string;
    accessToken: string | null;
    refreshToken: string | null;
    requiresEmailConfirmation: boolean;
  }> {
    const userId = await this.admin.createUser({
      email: params.email,
      password: params.password,
      fullName: params.fullName ?? null,
      assignCondoAdmin: params.assignCondoAdmin ?? true,
    });

    let session: { accessToken: string; refreshToken: string } | null = null;
    try {
      session = await this.signInWithPassword(params.email, params.password);
    } catch (err) {
      // Se o auto-login falhar por algum motivo, devolvemos o user criado
      // sem tokens — o front pode redirecionar pra tela de login.
      this.logger.warn(
        `Auto-login pós-cadastro falhou para ${params.email}: ${(err as Error).message}`,
      );
    }

    return {
      userId,
      email: params.email,
      accessToken: session?.accessToken ?? null,
      refreshToken: session?.refreshToken ?? null,
      requiresEmailConfirmation: false,
    };
  }
}
