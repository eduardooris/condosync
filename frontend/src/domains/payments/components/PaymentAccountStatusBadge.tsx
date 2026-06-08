import { Badge } from '@/shared/components/ui/Badge';
import type { PaymentAccountStatus } from '@/domains/payments/services/payment-accounts.service';
import { PAYMENT_ACCOUNT_STATUS_MAP } from '@/domains/payments/components/payment-account-status';

export function PaymentAccountStatusBadge({
  status,
}: {
  status: PaymentAccountStatus;
}) {
  const config = PAYMENT_ACCOUNT_STATUS_MAP[status];
  return <Badge tone={config.tone} label={config.label} showDot />;
}
