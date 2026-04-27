import { forwardRef, type SelectHTMLAttributes } from 'react';
import { fieldControlClassName } from '@/shared/components/ui/field-tokens';
import { cn } from '@/shared/utils/cn';

export type NativeSelectProps = SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean };

export const NativeSelect = forwardRef<HTMLSelectElement, NativeSelectProps>(
  ({ className, invalid, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={fieldControlClassName({
          invalid,
          className: cn('ds-native-select cursor-pointer', className),
        })}
        aria-invalid={invalid || undefined}
        {...props}
      >
        {children}
      </select>
    );
  },
);
NativeSelect.displayName = 'NativeSelect';
