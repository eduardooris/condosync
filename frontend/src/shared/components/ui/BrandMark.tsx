import type { HTMLAttributes } from 'react';
import { cn } from '@/shared/utils/cn';

type BrandMarkSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface BrandMarkProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  size?: BrandMarkSize;
  rounded?: 'md' | 'lg' | 'xl' | '2xl';
  glow?: boolean;
}

const sizeClass: Record<BrandMarkSize, string> = {
  xs: 'h-6 w-6',
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
  xl: 'h-16 w-16',
};

const radiusClass: Record<NonNullable<BrandMarkProps['rounded']>, string> = {
  md: 'rounded-ds-md',
  lg: 'rounded-ds-lg',
  xl: 'rounded-ds-xl',
  '2xl': 'rounded-ds-2xl',
};

/**
 * Marca oficial do CondoSync. Reaproveita o mesmo `icon.svg` exibido
 * no ícone do PWA, garantindo identidade visual consistente entre a tela
 * inicial do dispositivo e a UI do app.
 */
export function BrandMark({
  size = 'md',
  rounded = 'xl',
  glow = true,
  className,
  ...rest
}: BrandMarkProps) {
  return (
    <span
      {...rest}
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden',
        sizeClass[size],
        radiusClass[rounded],
        glow && 'shadow-ds-md shadow-brand-500/25',
        className,
      )}
      aria-hidden
    >
      <img
        src="/icon.svg"
        alt=""
        loading="eager"
        decoding="async"
        draggable={false}
        className="h-full w-full select-none object-cover"
      />
    </span>
  );
}
