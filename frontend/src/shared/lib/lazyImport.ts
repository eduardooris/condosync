import { lazy, type ComponentType } from 'react';

const CHUNK_LOAD_ERROR_PATTERNS = [
  'Failed to fetch dynamically imported module',
  'Loading chunk',
  'Importing a module script failed',
] as const;

const CHUNK_RELOAD_SESSION_KEY = 'condosync-chunk-reload';

export function isChunkLoadError(message: string | undefined): boolean {
  if (!message) return false;
  return CHUNK_LOAD_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

async function lazyWithRetry<T>(importFn: () => Promise<T>, retries = 3, delayMs = 500): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const module = await importFn();
      sessionStorage.removeItem(CHUNK_RELOAD_SESSION_KEY);
      return module;
    } catch (error) {
      lastError = error;
      const message = getErrorMessage(error);

      if (isChunkLoadError(message) && !sessionStorage.getItem(CHUNK_RELOAD_SESSION_KEY)) {
        sessionStorage.setItem(CHUNK_RELOAD_SESSION_KEY, '1');
        window.location.reload();
        return new Promise(() => {});
      }

      if (attempt < retries - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  sessionStorage.removeItem(CHUNK_RELOAD_SESSION_KEY);
  throw lastError;
}

/**
 * Lazy-load de página com retry e reload automático em falha de chunk (deploy/HMR/SW stale).
 */
export function lazyPage<TModule extends Record<string, ComponentType<unknown>>>(
  importFn: () => Promise<TModule>,
  exportName: keyof TModule & string,
) {
  return lazy(() =>
    lazyWithRetry(importFn).then((module) => ({
      default: module[exportName],
    })),
  );
}
