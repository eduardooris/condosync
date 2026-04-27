import type { HTMLAttributes, PropsWithChildren } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/shared/utils/cn';

type SurfaceVariant = 'default' | 'elevated' | 'flat' | 'plain';

interface GlassCardProps
  extends PropsWithChildren,
    Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  variant?: SurfaceVariant;
  hover?: boolean;
  padded?: boolean;
  animateIn?: boolean;
}

const variantClass: Record<SurfaceVariant, string> = {
  default: 'ds-surface',
  elevated: 'ds-surface-elevated',
  flat: 'ds-surface-flat',
  plain: 'rounded-ds-2xl',
};

/**
 * Surface card primitive used across the app.
 *
 * Variants:
 *   • default  — translucent glass (most common)
 *   • elevated — slightly stronger surface for hero sections
 *   • flat     — minimal surface for nested content
 *   • plain    — no background; only the rounded shape (for custom backgrounds)
 */
export function GlassCard({
  children,
  className,
  variant = 'default',
  hover = false,
  padded = true,
  animateIn = true,
  ...rest
}: GlassCardProps) {
  const reduce = useReducedMotion();
  const cls = cn(
    variantClass[variant],
    hover && 'ds-card-hover cursor-default',
    padded && 'p-5',
    className,
  );

  if (reduce || !animateIn) {
    return (
      <div className={cls} {...rest}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}
      className={cls}
      {...(rest as object)}
    >
      {children}
    </motion.div>
  );
}
