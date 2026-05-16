/**
 * Resolve URLs públicas a partir de `PUBLIC_URL` (canônica) e overrides opcionais.
 *
 * Produção com nginx único: defina só `PUBLIC_URL`.
 * Dev local: `APP_PUBLIC_URL` (Vite :5173) + API implícita em :3000, ou `API_PUBLIC_URL`.
 */
export function resolvePublicUrls(env: {
  PUBLIC_URL?: string;
  APP_PUBLIC_URL?: string;
  API_PUBLIC_URL?: string;
  NODE_ENV: string;
}): {
  publicUrl?: string;
  appPublicUrl: string;
  apiPublicUrl: string;
} {
  const strip = (url: string): string => url.replace(/\/$/, '');
  const publicUrl = env.PUBLIC_URL ? strip(env.PUBLIC_URL) : undefined;

  const appPublicUrl = strip(
    env.APP_PUBLIC_URL ?? publicUrl ?? 'http://localhost:5173',
  );

  const apiPublicUrl = strip(
    env.API_PUBLIC_URL ??
      publicUrl ??
      (env.NODE_ENV === 'production' && env.APP_PUBLIC_URL
        ? strip(env.APP_PUBLIC_URL)
        : undefined) ??
      'http://localhost:3000',
  );

  return { publicUrl, appPublicUrl, apiPublicUrl };
}
