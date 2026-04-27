import { motion } from 'framer-motion';
import { cn } from '@/shared/utils/cn';

const DEFAULT_DAYS = Array.from({ length: 28 }, (_, i) => i + 1);

export interface DayOfMonthGridProps {
  value: number;
  onChange: (day: number) => void;
  min?: number;
  /** Dias exibidos (padrão 1–28). */
  days?: number[];
  className?: string;
}

/**
 * Grade de dias do mês (ex.: geração/vencimento de cobrança).
 * Mobile-first: células compactas e `min-w-0` para não estourar a viewport.
 */
export function DayOfMonthGrid({
  value,
  onChange,
  min = 1,
  days = DEFAULT_DAYS,
  className,
}: DayOfMonthGridProps) {
  return (
    <div className={cn('w-full max-w-full', className)}>
      <div className="grid grid-cols-7 gap-0.5 ds-sm:gap-1.5">
        {days.map((day) => {
          const disabled = day < min;
          const active = day === value;
          return (
            <motion.button
              key={day}
              type="button"
              whileTap={disabled ? undefined : { scale: 0.92 }}
              disabled={disabled}
              onClick={() => onChange(day)}
              className={cn(
                'relative flex h-8 min-h-[2rem] w-full min-w-0 max-w-full items-center justify-center rounded-ds-md text-[10px] font-semibold transition ds-sm:h-9 ds-sm:text-ds-sm',
                disabled && 'cursor-not-allowed text-ds-subtle/40',
                !disabled && !active && 'text-ds-dim hover:bg-white/[0.06] hover:text-ds-body',
                active &&
                  'bg-gradient-to-br from-brand-400 to-brand-500 text-white shadow-md shadow-brand-500/40',
              )}
              aria-pressed={active}
              aria-label={`Dia ${day}`}
            >
              {day}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
