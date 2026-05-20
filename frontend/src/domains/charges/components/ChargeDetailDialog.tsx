import toast from 'react-hot-toast';
import { Copy, CreditCard, ExternalLink, FileText, Phone, QrCode, Receipt } from 'lucide-react';
import { Badge } from '@/shared/components/ui/Badge';
import { Button } from '@/shared/components/ui/Button';
import { cn } from '@/shared/utils/cn';
import type { ChargeWithPaymentMethods } from '@/domains/payments/types';
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
            <p className="text-[11px] font-bold uppercase tracking-widest text-ds-subtle">Unidade</p>
            <p className="mt-1 font-semibold text-ds-body">{unitLabel}</p>
          </div>

          <div className="grid grid-cols-1 gap-3 ds-sm:grid-cols-2">
            <div className="rounded-ds-lg border border-ds-stroke/60 bg-ds-surface dark:bg-white/[0.02] px-3 py-2.5">
              <p className="text-[11px] font-bold uppercase tracking-widest text-ds-subtle">Valor</p>
              <p className="mt-1 font-bold tabular-nums text-ds-body">{formatBrl(charge.amount ?? 0)}</p>
            </div>
            <div className="rounded-ds-lg border border-ds-stroke/60 bg-ds-surface dark:bg-white/[0.02] px-3 py-2.5">
              <p className="text-[11px] font-bold uppercase tracking-widest text-ds-subtle">Vencimento</p>
              <p className="mt-1 font-semibold text-ds-body">
                {charge.dueDate ? formatChargeDueDate(String(charge.dueDate)) : '—'}
              </p>
            </div>
          </div>

          {charge.description?.trim() ? (
            <div className="rounded-ds-lg border border-ds-stroke/60 bg-ds-surface dark:bg-white/[0.02] px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-widest text-ds-subtle">Descrição</p>
              <p className="mt-1 text-ds-body">{charge.description.trim()}</p>
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-3 rounded-ds-lg border border-ds-stroke/60 bg-ds-surface dark:bg-white/[0.02] px-4 py-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-ds-subtle">Status</p>
              <div className="mt-2">
                <Badge status={status} />
              </div>
            </div>
          </div>

          {status === 'paid' ? (
            <PaymentReceiptSection charge={charge as ChargeWithPaymentMethods} />
          ) : (
            <PaymentMethodsSection
              charge={charge as ChargeWithPaymentMethods}
              fallback={{ hasPix, pixType, pixValue, condominiumLoading, copyPix }}
            />
          )}

          {(wa || tel) && (
            <div className="rounded-ds-lg border border-ds-stroke/60 bg-ds-surface dark:bg-white/[0.02] px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-widest text-ds-subtle">Administração</p>
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

          {status === 'pending' || status === 'overdue' ? (
            <p className="rounded-ds-lg border border-ds-stroke/60 bg-ds-surface px-4 py-3 text-ds-sm text-ds-dim dark:bg-white/[0.02]">
              Após pagar pelo link Pix ou boleto desta cobrança, a baixa é automática.
              Pagamento em dinheiro: solicite confirmação ao síndico.
            </p>
          ) : null}

          <Button type="button" variant="secondary" className="w-full" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </div>
      </DialogContent>

    </Dialog>
  );
}

/**
 * Renderiza os métodos de pagamento disponíveis para a cobrança.
 * Prefere os dados Asaas (Pix QR + boleto + Asaas Checkout) quando
 * a cobrança foi emitida via gateway. Cai pra Pix manual do condo
 * quando não tem `asaas_payment_id` (cobranças legadas).
 */
function PaymentMethodsSection({
  charge,
  fallback,
}: {
  charge: ChargeWithPaymentMethods;
  fallback: {
    hasPix: boolean;
    pixType: string | null;
    pixValue: string;
    condominiumLoading?: boolean;
    copyPix: () => Promise<void>;
  };
}) {
  const hasAsaas = Boolean(charge.asaasInvoiceUrl);

  async function copyPixPayload(payload: string) {
    try {
      await navigator.clipboard.writeText(payload);
      toast.success('Código Pix copiado. Cole no app do banco.');
    } catch {
      toast.error('Não foi possível copiar. Copie manualmente.');
    }
  }

  if (hasAsaas) {
    return (
      <div className="rounded-ds-lg border border-brand-400/25 bg-brand-500/[0.06] px-4 py-3 space-y-3">
        <p className="text-[11px] font-bold uppercase tracking-widest text-brand-200/90">
          Como pagar
        </p>

        {/* QR Code Pix se tivermos pré-carregado */}
        {charge.asaasPixQrBase64 ? (
          <div className="rounded-ds-md bg-white p-3 ds-sm:max-w-[220px]">
            <img
              src={`data:image/png;base64,${charge.asaasPixQrBase64}`}
              alt="QR Code Pix"
              className="block w-full"
            />
          </div>
        ) : null}

        {/* Copia-cola */}
        {charge.asaasPixPayload ? (
          <div>
            <p className="mb-1 text-ds-xs text-ds-dim">Pix copia-cola:</p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="max-w-full break-all rounded-ds-md bg-black/30 px-2 py-1.5 text-[11px] text-ds-body">
                {charge.asaasPixPayload}
              </code>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="shrink-0 gap-1"
                onClick={() => void copyPixPayload(charge.asaasPixPayload!)}
              >
                <Copy className="h-3.5 w-3.5" aria-hidden />
                Copiar
              </Button>
            </div>
          </div>
        ) : null}

        {/* Botões principais */}
        <div className="flex flex-col gap-2 pt-1 ds-sm:flex-row">
          <a
            href={charge.asaasInvoiceUrl ?? '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-ds-md bg-brand-500 px-4 text-ds-sm font-semibold text-white transition hover:bg-brand-600"
          >
            <CreditCard className="h-4 w-4" />
            Pagar com Pix / boleto / cartão
            <ExternalLink className="h-3.5 w-3.5 opacity-70" />
          </a>
          {charge.asaasBankSlipUrl ? (
            <a
              href={charge.asaasBankSlipUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-ds-md border border-ds-stroke bg-ds-surface px-4 text-ds-sm font-semibold text-ds-body transition hover:bg-ds-elevated"
            >
              <FileText className="h-4 w-4" />
              Baixar boleto
            </a>
          ) : null}
        </div>

        <p className="text-[11px] text-ds-dim">
          <QrCode className="mr-1 inline-block h-3 w-3" />
          Pagamentos via Pix são confirmados em segundos. Boleto leva até 2 dias úteis.
          O status desta cobrança atualiza automaticamente.
        </p>
      </div>
    );
  }

  // Fallback — Pix manual do condomínio (cobranças legadas, sem Asaas).
  return (
    <div className="rounded-ds-lg border border-brand-400/25 bg-brand-500/[0.06] px-4 py-3">
      <p className="text-[11px] font-bold uppercase tracking-widest text-brand-200/90">
        Pagamento (Pix manual)
      </p>
      {fallback.condominiumLoading ? (
        <p className="mt-2 text-ds-dim">Carregando dados do condomínio…</p>
      ) : fallback.hasPix ? (
        <div className="mt-2 space-y-2">
          <p className="text-ds-xs text-ds-dim">
            Chave Pix (
            <span className="font-semibold text-ds-body">{fallback.pixType}</span>
            ):
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="max-w-full break-all rounded-ds-md bg-black/30 px-2 py-1.5 text-ds-xs text-ds-body">
              {fallback.pixValue}
            </code>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="shrink-0 gap-1"
              onClick={() => void fallback.copyPix()}
            >
              <Copy className="h-3.5 w-3.5" aria-hidden />
              Copiar
            </Button>
          </div>
          <p className="text-[11px] text-amber-700 dark:text-amber-300">
            ⚠️ Pagamento manual — a confirmação não é automática. Avise a
            administração após pagar.
          </p>
        </div>
      ) : (
        <p className="mt-2 text-ds-dim">
          A administração ainda não cadastrou a chave Pix neste condomínio. Em
          caso de dúvida, use os contatos abaixo.
        </p>
      )}
    </div>
  );
}

const PAID_METHOD_LABELS: Record<string, string> = {
  PIX: 'Pix',
  BOLETO: 'Boleto',
  CREDIT_CARD: 'Cartão de crédito',
  DEBIT_CARD: 'Cartão de débito',
  CASH: 'Dinheiro',
  TRANSFER: 'Transferência',
  MANUAL_CASH: 'Dinheiro (registrado pela administração)',
  MANUAL_TRANSFER: 'Transferência (registrado pela administração)',
  MANUAL_PIX: 'Pix (registrado pela administração)',
  MANUAL_BOLETO: 'Boleto (registrado pela administração)',
  MANUAL_OTHER: 'Outro (registrado pela administração)',
};

function formatPaidDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

/**
 * Comprovante de quitação — visível quando a cobrança está PAID.
 * Combina dados do gateway (recibo Asaas) com dados de baixa manual
 * (nota do admin), priorizando o que existir.
 */
function PaymentReceiptSection({
  charge,
}: {
  charge: ChargeWithPaymentMethods;
}) {
  // Asaas pode mandar "UNDEFINED" quando a cobrança não tinha método fixo
  // (cliente escolheria no checkout). Tratamos como "não informado".
  const rawMethod = charge.paidMethod ?? charge.asaasPaidVia ?? null;
  const method = rawMethod && rawMethod !== 'UNDEFINED' ? rawMethod : null;
  const methodLabel = method ? (PAID_METHOD_LABELS[method] ?? method) : null;
  const hasAsaasReceipt = Boolean(charge.asaasTransactionReceiptUrl);
  const note = charge.paidNote?.trim();
  const isManualReceipt = method?.startsWith('MANUAL_');

  return (
    <div className="rounded-ds-lg border border-emerald-500/25 bg-emerald-500/[0.06] px-4 py-3 space-y-3">
      <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-300">
        <Receipt className="h-3.5 w-3.5" />
        Comprovante de pagamento
      </p>

      <dl className="grid grid-cols-2 gap-3 text-ds-sm">
        <div>
          <dt className="text-[11px] text-ds-dim">Pago em</dt>
          <dd className="mt-0.5 font-semibold text-ds-body">
            {formatPaidDate(charge.paidAt)}
          </dd>
        </div>
        {methodLabel ? (
          <div>
            <dt className="text-[11px] text-ds-dim">Forma</dt>
            <dd className="mt-0.5 font-semibold text-ds-body">{methodLabel}</dd>
          </div>
        ) : null}
      </dl>

      {note ? (
        <div className="rounded-ds-md border border-ds-stroke/60 bg-ds-surface px-3 py-2 dark:bg-white/[0.02]">
          <p className="text-[11px] uppercase tracking-widest text-ds-dim">Observação</p>
          <p className="mt-1 text-ds-sm text-ds-body">{note}</p>
        </div>
      ) : null}

      {hasAsaasReceipt ? (
        <a
          href={charge.asaasTransactionReceiptUrl!}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-ds-md border border-emerald-500/30 bg-white px-4 text-ds-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 dark:bg-ds-surface dark:text-emerald-300 dark:hover:bg-emerald-500/10"
        >
          <FileText className="h-4 w-4" />
          Ver comprovante oficial
          <ExternalLink className="h-3.5 w-3.5 opacity-70" />
        </a>
      ) : isManualReceipt || !method ? (
        <button
          type="button"
          onClick={() => printInternalReceipt(charge)}
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-ds-md border border-ds-stroke/60 bg-ds-surface px-4 text-ds-sm font-semibold text-ds-body transition hover:bg-ds-elevated"
        >
          <FileText className="h-4 w-4" />
          Gerar recibo interno
        </button>
      ) : null}

      <p className="text-[11px] text-ds-dim leading-relaxed">
        {hasAsaasReceipt
          ? 'Comprovante emitido pelo Asaas — válido como prova de transação.'
          : 'Recibo interno gerado pelo CondoSync. Asaas só emite comprovante para pagamentos online (Pix, boleto, cartão).'}
      </p>
    </div>
  );
}

/**
 * Abre uma janela imprimível com recibo interno simples. Não é um documento
 * fiscal — só uma confirmação visual da quitação. Útil quando o pagamento
 * foi registrado manualmente (não tem `transactionReceiptUrl` da Asaas).
 */
function printInternalReceipt(charge: ChargeWithPaymentMethods): void {
  const win = window.open('', '_blank', 'width=600,height=800');
  if (!win) return;
  const method = charge.paidMethod ?? charge.asaasPaidVia ?? null;
  const methodLabel =
    method && method !== 'UNDEFINED'
      ? (PAID_METHOD_LABELS[method] ?? method)
      : 'Não informado';
  const paidDate = charge.paidAt ? formatPaidDate(charge.paidAt) : '—';
  const valueFmt = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(charge.amount ?? 0));
  const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>Recibo de pagamento</title>
<style>
  body { font-family: -apple-system, system-ui, sans-serif; padding: 40px; color: #0f172a; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .sub { color: #64748b; font-size: 13px; margin: 0 0 24px; }
  .row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e2e8f0; }
  .row span:first-child { color: #64748b; }
  .row span:last-child { font-weight: 600; }
  .value { font-size: 26px; font-weight: 700; color: #047857; margin: 12px 0 6px; }
  .note { margin-top: 28px; padding: 14px; background: #f8fafc; border-radius: 10px; font-size: 12px; color: #475569; }
  .stamp { margin-top: 32px; padding-top: 16px; border-top: 2px solid #047857; font-size: 11px; color: #047857; text-align: center; letter-spacing: 0.1em; text-transform: uppercase; font-weight: 700; }
  @media print { body { padding: 24px; } }
</style></head><body>
<h1>Recibo de pagamento</h1>
<p class="sub">Documento interno emitido pelo CondoSync.</p>
<div class="value">${valueFmt}</div>
<div class="row"><span>Competência</span><span>${charge.billingMonth ?? '—'}</span></div>
<div class="row"><span>Pago em</span><span>${paidDate}</span></div>
<div class="row"><span>Forma</span><span>${methodLabel}</span></div>
${charge.paidNote ? `<div class="row"><span>Observação</span><span>${escapeHtml(charge.paidNote)}</span></div>` : ''}
<div class="row"><span>ID interno</span><span style="font-family:ui-monospace,monospace;font-size:11px">${charge.id}</span></div>
<p class="note">Este recibo é gerado automaticamente pelo CondoSync após a confirmação do pagamento pela administração do condomínio. Não substitui comprovante fiscal.</p>
<div class="stamp">✓ Pagamento confirmado</div>
<script>window.onload = () => setTimeout(() => window.print(), 200)</script>
</body></html>`;
  win.document.write(html);
  win.document.close();
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}
