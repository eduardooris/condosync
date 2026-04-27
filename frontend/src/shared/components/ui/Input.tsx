import { forwardRef, type InputHTMLAttributes } from 'react';
import { fieldControlClassName } from '@/shared/components/ui/field-tokens';
import { cn } from '@/shared/utils/cn';

export type InputProps = InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean };

export const Input = forwardRef<HTMLInputElement, InputProps>(({ className, invalid, ...props }, ref) => {
  return (
    <input
      ref={ref}
      className={fieldControlClassName({ invalid, className: cn('min-w-0', className) })}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
});
Input.displayName = 'Input';
