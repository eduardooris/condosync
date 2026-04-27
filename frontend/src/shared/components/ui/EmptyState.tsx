import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/shared/utils/cn';

const ctaClassName =
  'mt-5 inline-flex min-h-10 items-center justify-center rounded-ds-lg border border-ds-stroke px-5 text-ds-sm font-semibold text-ds-body bg-ds-surface transition duration-200 hover:border-ds-stroke-strong hover:bg-ds-elevated focus:outline-none focus-visible:ring-2 focus-visible:ring-ds-focus dark:bg-white/[0.03] dark:hover:bg-white/[0.06]';

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  /** O que o usuário pode fazer ou o que passará a aparecer aqui quando houver dados */
  suggestion?: string;
  action?: { to: string; label: string };
  className?: string;
};

/**
 * Feedback visual para listas ou seções sem dados: explica o estado e orienta a experiência
 * (alinhado ao design system — cartão com borda tracejada, hierarquia tipográfica).
 */
export function EmptyState({ icon: Icon, title, description, suggestion, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'ds-surface px-5 py-10 text-center ds-md:px-10 ds-md:py-12',
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-ds-2xl bg-gradient-to-br from-brand-300/20 to-brand-500/5 text-brand-700 ring-1 ring-brand-400/25 dark:text-brand-300">
        <Icon className="h-6 w-6" strokeWidth={1.6} aria-hidden />
      </div>
      <h3 className="text-ds-lg font-semibold tracking-tight text-ds-body">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-ds-sm leading-relaxed text-ds-dim">{description}</p>
      {suggestion ? (
        <p className="mx-auto mt-5 max-w-lg rounded-ds-lg border border-ds-stroke bg-ds-surface px-4 py-3 text-left text-ds-xs leading-relaxed text-ds-subtle dark:bg-white/[0.02]">
          <span className="font-medium text-ds-dim">Dica: </span>
          {suggestion}
        </p>
      ) : null}
      {action ? (
        <Link to={action.to} className={ctaClassName}>
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}
