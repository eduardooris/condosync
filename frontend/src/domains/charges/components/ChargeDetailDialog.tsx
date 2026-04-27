import toast from 'react-hot-toast';
import { Copy, ExternalLink, Phone } from 'lucide-react';
import { Badge } from '@/shared/components/ui/Badge';
import { Button } from '@/shared/components/ui/Button';
import { cn } from '@/shared/utils/cn';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/Dialog';
import type { Charge } from '@/shared/types/api';
import type { PixKeyType } from '@/domains/condominiums/services/condominiums.service';
import {
  formatChargeBillingMonth,
  formatChargeDueDate,
  pixKeyTypeLabel,
  telAdminHref,
  whatsappAdminHref,
} from '@/domains/charges/utils/charge-display';

export type CondominiumPaymentSlice = {
  name?: string;
  /** API / OpenAPI podem enviar como string ampla. */
  pixKeyType?: PixKeyType | string | null;
  pixKeyValue?: string | null;
  adminContactPhone?: string | null;
};

function formatBrl(n: number | string) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(n));
}

interface ChargeDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  charge: Charge | null;
  unitLabel: string;
  condominium?: CondominiumPaymentSlice | null;
  condominiumLoading?: boolean;
}

export function ChargeDetailDialog({
  open,
  onOpenChange,
  charge,
  unitLabel,
  condominium,
  condominiumLoading,
}: ChargeDetailDialogProps) {
  if (!charge) return null;

  const status = charge.status?.toLowerCase() as
    | 'pending'
    | 'paid'
    | 'overdue'
    | 'exempt'
    | 'canceled';
  const pixType = condominium?.pixKeyType ?? null;
  const pixValue = condominium?.pixKeyValue?.trim() ?? '';
  const hasPix = Boolean(pixType && pixValue);
  const wa = whatsappAdminHref(condominium?.adminContactPhone ?? undefined);
  const tel = telAdminHref(condominium?.adminContactPhone ?? undefined);

  async function copyPix() {
    if (!pixValue) return;
    try {
      await navigator.clipboard.writeText(pixValue);
      toast.success('Chave Pix copiada.');
    } catch {
      toast.error('Não foi possível copiar. Copie manualmente.');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md min-w-0">
        <DialogHeader>
          <DialogTitle>Detalhes da cobrança</DialogTitle>
          <DialogDescription>
            {condominium?.name ? `${condominium.name} · ` : null}
            Competência {formatChargeBillingMonth(charge.billingMonth)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-ds-sm">
          <div className="rounded-ds-lg border border-ds-stroke/60 bg-ds-surface dark:bg-white/[0.02] px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-ds-subtle">Unidade</p>
            <p className="mt-1 font-semibold text-ds-body">{unitLabel}</p>
          </div>

          <div className="grid grid-cols-1 gap-3 ds-sm:grid-cols-2">
            <div className="rounded-ds-lg border border-ds-stroke/60 bg-ds-surface dark:bg-white/[0.02] px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-ds-subtle">Valor</p>
              <p className="mt-1 font-bold tabular-nums text-ds-body">{formatBrl(charge.amount ?? 0)}</p>
            </div>
            <div className="rounded-ds-lg border border-ds-stroke/60 bg-ds-surface dark:bg-white/[0.02] px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-ds-subtle">Vencimento</p>
              <p className="mt-1 font-semibold text-ds-body">
                {charge.dueDate ? formatChargeDueDate(String(charge.dueDate)) : '—'}
              </p>
            </div>
          </div>

          {charge.description?.trim() ? (
            <div className="rounded-ds-lg border border-ds-stroke/60 bg-ds-surface dark:bg-white/[0.02] px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-ds-subtle">Descrição</p>
              <p className="mt-1 text-ds-body">{charge.description.trim()}</p>
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-3 rounded-ds-lg border border-ds-stroke/60 bg-ds-surface dark:bg-white/[0.02] px-4 py-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-ds-subtle">Status</p>
              <div className="mt-2">
                <Badge status={status} />
              </div>
            </div>
          </div>

          <div className="rounded-ds-lg border border-brand-400/25 bg-brand-500/[0.06] px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-brand-200/90">Pagamento (Pix)</p>
            {condominiumLoading ? (
              <p className="mt-2 text-ds-dim">Carregando dados do condomínio…</p>
            ) : hasPix ? (
              <div className="mt-2 space-y-2">
                <p className="text-ds-xs text-ds-dim">
                  Tipo: <span className="font-semibold text-ds-body">{pixKeyTypeLabel(pixType)}</span>
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <code className="max-w-full break-all rounded-ds-md bg-black/30 px-2 py-1.5 text-ds-xs text-ds-body">
                    {pixValue}
                  </code>
                  <Button type="button" size="sm" variant="secondary" className="shrink-0 gap-1" onClick={() => void copyPix()}>
                    <Copy className="h-3.5 w-3.5" aria-hidden />
                    Copiar
                  </Button>
                </div>
              </div>
            ) : (
              <p className="mt-2 text-ds-dim">
                A administração ainda não cadastrou a chave Pix neste condomínio. Em caso de dúvida, use os contatos abaixo.
              </p>
            )}
          </div>

          {(wa || tel) && (
            <div className="rounded-ds-lg border border-ds-stroke/60 bg-ds-surface dark:bg-white/[0.02] px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-ds-subtle">Administração</p>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                {wa ? (
                  <a
                    href={wa}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      'inline-flex h-8 items-center gap-1.5 rounded-ds-md px-3 text-ds-xs font-semibold text-brand-700',
                      'transition hover:bg-ds-surface hover:text-brand-600 dark:text-brand-300 dark:hover:bg-white/[0.05] dark:hover:text-brand-200',
                    )}
                  >
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    WhatsApp
                  </a>
                ) : null}
                {tel ? (
                  <a
                    href={tel}
                    className={cn(
                      'inline-flex h-8 items-center gap-1.5 rounded-ds-md px-3 text-ds-xs font-semibold text-brand-700',
                      'transition hover:bg-ds-surface hover:text-brand-600 dark:text-brand-300 dark:hover:bg-white/[0.05] dark:hover:text-brand-200',
                    )}
                  >
                    <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    Ligar
                  </a>
                ) : null}
              </div>
            </div>
          )}

          <Button type="button" variant="secondary" className="w-full" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
