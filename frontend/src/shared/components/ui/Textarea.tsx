import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { fieldControlClassName } from '@/shared/components/ui/field-tokens';
import { cn } from '@/shared/utils/cn';

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean };

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, invalid, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={fieldControlClassName({ invalid, className: cn('min-h-[6rem] resize-y', className) })}
        aria-invalid={invalid || undefined}
        {...props}
      />
    );
  },
);
Textarea.displayName = 'Textarea';
