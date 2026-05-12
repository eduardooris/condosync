import { cn } from '@/shared/utils/cn';

/**
 * Bloco placeholder com animação shimmer suave. Use pra substituir o `Spinner`
 * em qualquer carregamento de página/seção — devolve a sensação de que algo
 * está chegando, ao invés de "tela travada".
 *
 * Exemplos:
 *   <Skeleton className="h-6 w-40" />
 *   <Skeleton className="h-32 w-full rounded-ds-xl" />
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        'animate-pulse rounded-ds-md bg-gradient-to-r from-ds-stroke-subtle/40 via-ds-stroke/60 to-ds-stroke-subtle/40 dark:from-white/[0.04] dark:via-white/[0.08] dark:to-white/[0.04]',
        className,
      )}
    />
  );
}

/** Skeleton genérico de "página com header + cards + lista". */
export function PageSkeleton() {
  return (
    <div className="ds-page mx-auto max-w-7xl space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="grid grid-cols-1 gap-3 ds-sm:grid-cols-2 ds-md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-ds-xl" />
        ))}
      </div>
      <Skeleton className="h-64 w-full rounded-ds-xl" />
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-ds-lg" />
        ))}
      </div>
    </div>
  );
}

/** Skeleton específico pra listas em formato card/lista vertical. */
export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-ds-xl" />
      ))}
    </div>
  );
}
