import { motion, useReducedMotion } from 'framer-motion';
import type { ButtonHTMLAttributes, ComponentProps } from 'react';
import { cn } from '@/shared/utils/cn';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'gradient' | 'outline';
type ButtonSize = 'sm' | 'md' | 'lg';

const variantClass: Record<ButtonVariant, string> = {
  primary: cn(
    'border border-transparent bg-ds-action text-ds-on-primary',
    'shadow-[0_4px_18px_-6px_rgba(79,125,240,0.55)]',
    'hover:bg-ds-action-h',
    'focus-visible:ring-2 focus-visible:ring-ds-focus',
  ),
  gradient: cn(
    'border border-transparent text-ds-on-primary',
    'bg-gradient-to-r from-brand-500 via-brand-400 to-brand-300',
    'shadow-[0_8px_24px_-8px_rgba(79,125,240,0.6)]',
    'hover:shadow-[0_10px_28px_-6px_rgba(79,125,240,0.7)]',
    'focus-visible:ring-2 focus-visible:ring-brand-400/55',
  ),
  secondary: cn(
    'border border-ds-stroke-strong bg-ds-elevated text-ds-body',
    'hover:bg-ds-surface hover:border-ds-stroke-strong dark:hover:bg-white/[0.06]',
    'focus-visible:ring-2 focus-visible:ring-ds-focus',
  ),
  outline: cn(
    'border border-ds-stroke text-ds-body bg-transparent',
    'hover:bg-ds-surface hover:border-ds-stroke-strong dark:hover:bg-white/[0.04]',
    'focus-visible:ring-2 focus-visible:ring-ds-focus',
  ),
  ghost: cn(
    'border border-transparent bg-transparent text-ds-dim',
    'hover:bg-ds-surface hover:text-ds-body dark:hover:bg-white/[0.05]',
    'focus-visible:ring-2 focus-visible:ring-ds-focus',
  ),
  danger: cn(
    'border border-transparent bg-ds-danger/95 text-ds-on-primary',
    'shadow-[0_4px_16px_-6px_rgba(240,80,80,0.5)]',
    'hover:bg-ds-danger',
    'focus-visible:ring-2 focus-visible:ring-ds-danger/45',
  ),
};

const sizeClass: Record<ButtonSize, string> = {
  // Heights alinhadas com tap-target mínimo do iOS HIG (44pt) — o `md` é o
  // default e bate exatamente os 44px; `sm` fica em 36px (chip/icon-button
  // confortável); `lg` em 52px (CTA principal).
  sm: 'h-9 rounded-ds-md px-3.5 text-ds-sm gap-1.5',
  md: 'h-11 rounded-ds-lg px-4 text-ds-sm gap-2',
  lg: 'h-[3.25rem] rounded-ds-xl px-5 text-ds-md gap-2',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
}

export function Button({
  className,
  variant = 'primary',
  size = 'md',
  type = 'button',
  fullWidth,
  children,
  ...props
}: ButtonProps) {
  const reduce = useReducedMotion();

  const baseClass = cn(
    'inline-flex items-center justify-center font-semibold tracking-tight',
    'transition-[background-color,border-color,box-shadow,color] duration-150',
    'disabled:cursor-not-allowed disabled:opacity-55',
    'focus:outline-none',
    fullWidth && 'w-full',
    variantClass[variant],
    sizeClass[size],
    className,
  );

  if (reduce || props.disabled) {
    return (
      <button type={type} className={baseClass} {...props}>
        {children}
      </button>
    );
  }

  return (
    <motion.button
      type={type}
      className={baseClass}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.1 }}
      {...(props as unknown as ComponentProps<typeof motion.button>)}
    >
      {children}
    </motion.button>
  );
}
