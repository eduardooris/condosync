import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  Lock,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/shared/components/ui/Badge';
import type { PaymentAccountStatus } from '@/domains/payments/services/payment-accounts.service';

/**
 * Mapa de status do `PaymentAccount` → tone do Badge + label PT-BR.
 *
 * Centraliza para que dashboard, settings, charges dialog e qualquer
 * outro lugar mostrem o mesmo rótulo e cor para o mesmo estado.
 */
const STATUS_MAP: Record<
  PaymentAccountStatus,
  { label: string; tone: 'neutral' | 'info' | 'warning' | 'success' | 'danger'; icon: LucideIcon }
> = {
  DRAFT: { label: 'Rascunho', tone: 'neutral', icon: FileText },
  PENDING_DOCS: { label: 'Aguardando documentos', tone: 'warning', icon: FileText },
  PENDING_REVIEW: { label: 'Em análise', tone: 'info', icon: Clock },
  ACTIVE: { label: 'Ativa', tone: 'success', icon: CheckCircle2 },
  BLOCKED: { label: 'Bloqueada', tone: 'danger', icon: Lock },
  REJECTED: { label: 'Recusada', tone: 'danger', icon: XCircle },
};

export function PaymentAccountStatusBadge({
  status,
}: {
  status: PaymentAccountStatus;
}) {
  const config = STATUS_MAP[status];
  return <Badge tone={config.tone} label={config.label} showDot />;
}

/**
 * Ícone do status — útil em headers grandes onde só o badge fica
 * pequeno demais.
 */
export function paymentAccountStatusIcon(status: PaymentAccountStatus): {
  Icon: LucideIcon;
  className: string;
} {
  const tone = STATUS_MAP[status]?.tone ?? 'neutral';
  const className =
    tone === 'success'
      ? 'text-emerald-500'
      : tone === 'warning'
        ? 'text-amber-500'
        : tone === 'danger'
          ? 'text-rose-500'
          : tone === 'info'
            ? 'text-brand-500'
            : 'text-ds-subtle';
  return { Icon: STATUS_MAP[status]?.icon ?? AlertTriangle, className };
}

export function paymentAccountStatusLabel(status: PaymentAccountStatus): string {
  return STATUS_MAP[status]?.label ?? status;
}
