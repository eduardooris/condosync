import { z } from 'zod';

export const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'production', 'test'])
      .default('development'),
    PORT: z.coerce.number().default(3000),
    DATABASE_URL: z.string().min(1),

    AUTH_PROVIDER: z.literal('keycloak').default('keycloak'),

    KEYCLOAK_BASE_URL: z.string().url().optional(),
    KEYCLOAK_REALM: z.string().optional(),
    /**
     * Issuer **público** (o que aparece dentro do JWT como claim `iss`).
     * Deve ser exatamente igual à URL que o frontend usa para falar com o
     * Keycloak (ex.: http://localhost:8080/realms/main).
     */
    KEYCLOAK_ISSUER: z.string().url().optional(),
    /**
     * URL **interna** do realm, usada pelo backend para chamar o token
     * endpoint e baixar as chaves do JWKS quando o backend roda em outra
     * rede (ex.: dentro do docker-compose, http://keycloak:8080/realms/main).
     * Se omitido (ou vazio), o backend usa o próprio `KEYCLOAK_ISSUER`.
     */
    KEYCLOAK_INTERNAL_URL: z
      .string()
      .optional()
      .transform((v) => (v && v.trim().length > 0 ? v.trim() : undefined))
      .refine((v) => v === undefined || /^https?:\/\//i.test(v), {
        message: 'Invalid URL',
      }),
    KEYCLOAK_CLIENT_ID: z.string().optional(),
    KEYCLOAK_CLIENT_SECRET: z.string().optional(),
    /**
     * Cliente confidencial do Keycloak usado pelo backend p/ falar com a
     * Admin API (criar usuários, atribuir/remover roles, resetar senha).
     * O cliente precisa ter `serviceAccountsEnabled=true` e o user de service
     * account precisa ter os roles `manage-users`, `view-users`, `query-users`
     * do client `realm-management`.
     */
    KEYCLOAK_ADMIN_CLIENT_ID: z.string().default('condo-backend-admin'),
    KEYCLOAK_ADMIN_CLIENT_SECRET: z.string().optional(),

    /**
     * URL pública do frontend (sem trailing slash). Usada para montar links
     * de convite enviados pelo backend (ex.: `${APP_PUBLIC_URL}/invite/<token>`).
     */
    APP_PUBLIC_URL: z.string().url().default('http://localhost:5173'),

    CORS_ORIGINS: z
      .string()
      .default('http://localhost:5173,http://localhost:3001'),

    REDIS_URL: z.string().default('redis://127.0.0.1:6379'),

    // ── Storage (S3-compatible: AWS S3, MinIO, R2 etc.) ────────────
    STORAGE_PROVIDER: z.literal('s3').default('s3'),
    STORAGE_BUCKET: z.string().default('condosync-files'),
    /** Região AWS (ou um valor qualquer p/ MinIO, ex.: `us-east-1`). */
    S3_REGION: z.string().default('us-east-1'),
    /**
     * Endpoint customizado (MinIO/R2). Vazio = AWS S3 nativo.
     * Use a URL **interna** que o backend enxerga (ex.: `http://minio:9000`
     * dentro do docker-compose).
     */
    S3_ENDPOINT: z.string().optional(),
    /**
     * Endpoint público usado SOMENTE para gerar URLs assinadas que o
     * browser consegue baixar. Em dev com MinIO, normalmente
     * `http://localhost:9000`. Se vazio, usa `S3_ENDPOINT`.
     */
    S3_PUBLIC_ENDPOINT: z.string().optional(),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
    /** MinIO exige `true`. AWS S3 nativo aceita `false`. */
    S3_FORCE_PATH_STYLE: z.coerce.boolean().default(true),

    MESSAGE_SERVER_BASE_URL: z.string().url().default('http://localhost:8080'),
    MESSAGE_SERVER_API_KEY: z.string().optional(),
    MESSAGE_SERVER_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(10000),
    MESSAGE_SERVER_COMPANY_ID: z.string().default('condosync'),
    MESSAGE_SERVER_INSTANCE_NAME: z.string().default('CondoSync'),
    MESSAGE_SERVER_INSTANCE_ID: z.string().optional(),
    MESSAGE_SERVER_WEBHOOK_SECRET: z.string().optional(),

    // ── Hardening / observabilidade ────────────────────────────────
    /** Limite global de requisições por IP no intervalo `THROTTLE_TTL`. */
    THROTTLE_LIMIT: z.coerce.number().int().positive().default(120),
    /** Janela do throttler em segundos. */
    THROTTLE_TTL: z.coerce.number().int().positive().default(60),
    /** Limite específico para rotas /auth/* (login, logout etc.). */
    THROTTLE_AUTH_LIMIT: z.coerce.number().int().positive().default(10),
    /** Modo de log. Em prod usamos JSON estruturado. */
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    /** Tag publicada da imagem (usada em healthz/version). */
    IMAGE_TAG: z.string().default('local'),
  })
  .superRefine((env, ctx) => {
    if (!env.KEYCLOAK_ISSUER) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'KEYCLOAK_ISSUER é obrigatório',
        path: ['KEYCLOAK_ISSUER'],
      });
    }
    if (!env.KEYCLOAK_CLIENT_ID) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'KEYCLOAK_CLIENT_ID é obrigatório',
        path: ['KEYCLOAK_CLIENT_ID'],
      });
    }
    if (!env.KEYCLOAK_ADMIN_CLIENT_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'KEYCLOAK_ADMIN_CLIENT_SECRET é obrigatório (cliente confidencial p/ Admin API)',
        path: ['KEYCLOAK_ADMIN_CLIENT_SECRET'],
      });
    }

    // Em produção, exigimos credenciais S3 explícitas (em dev/CI o
    // adapter aceita anônimo p/ MinIO local sem credentials).
    if (env.NODE_ENV === 'production') {
      if (!env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'S3_ACCESS_KEY_ID e S3_SECRET_ACCESS_KEY são obrigatórios em produção',
          path: ['S3_ACCESS_KEY_ID'],
        });
      }
      if (!env.MESSAGE_SERVER_WEBHOOK_SECRET?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'MESSAGE_SERVER_WEBHOOK_SECRET é obrigatório em produção',
          path: ['MESSAGE_SERVER_WEBHOOK_SECRET'],
        });
      }
      if (!env.MESSAGE_SERVER_API_KEY?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'MESSAGE_SERVER_API_KEY é obrigatório em produção',
          path: ['MESSAGE_SERVER_API_KEY'],
        });
      }
    }

    // CORS aberto (`*`) só é permitido fora de produção.
    if (env.NODE_ENV === 'production') {
      const origins = env.CORS_ORIGINS.split(',')
        .map((o) => o.trim())
        .filter(Boolean);
      if (origins.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'CORS_ORIGINS não pode ser vazio em produção — informe domínios separados por vírgula.',
          path: ['CORS_ORIGINS'],
        });
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const msg = parsed.error.flatten().fieldErrors;
    throw new Error(`Invalid environment: ${JSON.stringify(msg)}`);
  }
  return parsed.data;
}
