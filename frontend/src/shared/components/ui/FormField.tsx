import type { ReactNode } from 'react';
import { Label } from '@/shared/components/ui/Label';
import { FieldError } from '@/shared/components/ui/FieldError';
import { cn } from '@/shared/utils/cn';

export function FormField({
  label,
  htmlFor,
  error,
  hint,
  children,
  className,
  required,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
  required?: boolean;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required ? <span className="ml-0.5 text-ds-danger">*</span> : null}
      </Label>
      {children}
      {hint && !error ? <p className="text-ds-xs text-ds-subtle">{hint}</p> : null}
      {error ? <FieldError>{error}</FieldError> : null}
    </div>
  );
}
