import { cn } from '@/shared/utils/cn';

export function FieldError({ id, children, className }: { id?: string; children: string; className?: string }) {
  return (
    <p id={id} role="alert" className={cn('mt-1 text-ds-xs text-ds-danger', className)}>
      {children}
    </p>
  );
}
