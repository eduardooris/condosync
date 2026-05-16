/**
 * Origem pública da API (sem `/api/v1`).
 *
 * Em produção com nginx único, defina só `VITE_PUBLIC_URL` no build.
 * `VITE_API_BASE_URL` permanece como alias legado.
 */
export function getPublicOrigin(): string {
  const raw =
    import.meta.env.VITE_PUBLIC_URL ??
    import.meta.env.VITE_API_BASE_URL ??
    import.meta.env.VITE_API_URL ??
    'http://localhost:3000';
  return raw.replace(/\/$/, '');
}
