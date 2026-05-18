import { cn } from '@/lib/cn';

type Tone = 'success' | 'warning' | 'danger' | 'info' | 'muted';

const TONE_CLASSES: Record<Tone, string> = {
  success: 'bg-success/15 text-success ring-success/30',
  warning: 'bg-warning/15 text-warning ring-warning/30',
  danger: 'bg-danger/15 text-danger ring-danger/30',
  info: 'bg-accent/15 text-accent ring-accent/30',
  muted: 'bg-bg-subtle text-fg-dim ring-border',
};

const STATUS_TONE: Record<string, Tone> = {
  // Charges
  PENDING: 'warning',
  PAID: 'success',
  OVERDUE: 'danger',
  EXEMPT: 'muted',
  CANCELED: 'muted',
  // Payment accounts
  DRAFT: 'muted',
  PENDING_DOCS: 'warning',
  PENDING_REVIEW: 'info',
  ACTIVE: 'success',
  BLOCKED: 'danger',
  REJECTED: 'danger',
};

export function StatusBadge({ value, tone }: { value: string; tone?: Tone }) {
  const t = tone ?? STATUS_TONE[value] ?? 'muted';
  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset',
        TONE_CLASSES[t],
      )}
    >
      {value}
    </span>
  );
}
