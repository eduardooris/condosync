import type { ReactNode } from 'react';

export function SectionShell({
  title,
  description,
  children,
  actions,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-ds-stroke-subtle pb-4">
        <div>
          <h2 className="text-ds-xl font-bold tracking-tight text-ds-body">{title}</h2>
          {description ? <p className="mt-1 text-ds-sm text-ds-dim">{description}</p> : null}
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </header>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

export function SectionCard({
  title,
  description,
  children,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-ds-2xl border border-ds-stroke-subtle bg-ds-surface p-5 dark:bg-white/[0.02]">
      {title || description ? (
        <div className="mb-4">
          {title ? <h3 className="text-ds-md font-semibold text-ds-body">{title}</h3> : null}
          {description ? <p className="mt-0.5 text-ds-xs text-ds-dim">{description}</p> : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}
