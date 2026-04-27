import type { LabelHTMLAttributes } from 'react';
import { cn } from '@/shared/utils/cn';

export function Label({ className, children, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={cn('text-ds-sm font-medium text-ds-dim', className)} {...props}>
      {children}
    </label>
  );
}
