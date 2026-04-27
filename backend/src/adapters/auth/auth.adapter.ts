export const AUTH_ADAPTER = 'AUTH_ADAPTER';

export interface JwtClaims {
  sub: string;
  email?: string;
}

export interface IAuthAdapter {
  verifyAccessToken(token: string): Promise<JwtClaims>;
  signInWithPassword(
    email: string,
    password: string,
  ): Promise<{ accessToken: string; refreshToken: string }>;
  signOut(accessToken: string): Promise<void>;
  refreshSession(
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string }>;
  signUp(params: {
    email: string;
    password: string;
    fullName?: string;
    /**
     * Quando `true` (default), o usuário recebe a realm role `condo-admin`
     * (e portanto pode criar condomínios). Use `false` para usuários
     * criados via convite (moradores).
     */
    assignCondoAdmin?: boolean;
  }): Promise<{
    userId: string;
    email: string;
    accessToken: string | null;
    refreshToken: string | null;
    requiresEmailConfirmation: boolean;
  }>;
}
