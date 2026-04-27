import type { ReactNode } from 'react';
import { cn } from '@/shared/utils/cn';

export function PageHeader({
  title,
  description,
  actions,
  className,
  actionsClassName,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
  /** Útil em mobile-first: `w-full min-w-0` para botões em largura total até `ds-sm`. */
  actionsClassName?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-3 ds-sm:flex-row ds-sm:items-center ds-sm:justify-between', className)}>
      <div className="min-w-0">
        <h1 className="text-ds-xl font-bold tracking-tight text-ds-body">{title}</h1>
        {description ? <p className="mt-1 text-ds-sm leading-relaxed text-ds-dim">{description}</p> : null}
      </div>
      {actions ? (
        <div className={cn('flex min-w-0 shrink-0 flex-wrap gap-2', actionsClassName)}>{actions}</div>
      ) : null}
    </div>
  );
}
