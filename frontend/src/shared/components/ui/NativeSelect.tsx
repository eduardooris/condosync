import { forwardRef, type SelectHTMLAttributes } from 'react';
import { fieldControlClassName } from '@/shared/components/ui/field-tokens';
import { cn } from '@/shared/utils/cn';

export type NativeSelectSize = 'sm' | 'md' | 'lg';

export interface NativeSelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  /** Marca o controle como inválido (ring vermelho + aria-invalid). */
  invalid?: boolean;
  /** Altura/padding do controle. `md` é o padrão. */
  size?: NativeSelectSize;
}

const sizeClass: Record<NativeSelectSize, string> = {
  sm: 'h-9 text-ds-sm pr-9 pl-3',
  md: 'h-11 text-ds-sm pr-10 pl-3.5',
  lg: 'h-[3.25rem] text-ds-md pr-11 pl-4',
};

/**
 * Select nativo estilizado conforme o Design System.
 *
 * Por que `<select>` nativo: em mobile abre o picker do sistema (iOS roller /
 * Android dropdown) — UX mais rápida e familiar do que popovers customizados.
 * Em desktop, herda o look-and-feel dos demais campos do DS (`Input`, `Textarea`)
 * via `fieldControlClassName`, com chevron desenhado em SVG inline via CSS
 * (`.ds-native-select`).
 *
 * Quando NÃO usar: se precisar de busca, agrupamento custom, item renderizado
 * com avatar/badge, ou um popover acima de modais, use o `Select` (Radix) em
 * `@/shared/components/ui/Select`.
 */
export const NativeSelect = forwardRef<HTMLSelectElement, NativeSelectProps>(
  ({ className, invalid, size = 'md', children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        aria-invalid={invalid || undefined}
        className={fieldControlClassName({
          invalid,
          className: cn(
            'ds-native-select cursor-pointer',
            // O `fieldControlClassName` já aplica h-10 / text-ds-sm / pl-3.5.
            // O `sizeClass` sobrescreve para variantes diferentes do default.
            size !== 'md' && sizeClass[size],
            // Garante padding extra à direita pra não cobrir o chevron SVG.
            size === 'md' && 'pr-10',
            className,
          ),
        })}
        {...props}
      >
        {children}
      </select>
    );
  },
);
NativeSelect.displayName = 'NativeSelect';
