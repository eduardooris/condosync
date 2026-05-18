import { AlertTriangle, ArrowRight, Landmark } from 'lucide-react';
import { Link } from 'react-router-dom';
import { usePaymentAccount } from '@/domains/payments/hooks/usePaymentAccount';

/**
 * Banner condicional do dashboard/admin: alerta quando a subconta Asaas
 * do condomínio ainda não está `ACTIVE`. Nada renderiza quando ativa
 * (banner some ao bater o estado feliz).
 *
 * Estados:
 *   - sem subconta → CTA "Configurar conta digital"
 *   - PENDING_DOCS → "Envie documentos"
 *   - PENDING_REVIEW → "Em análise"
 *   - REJECTED → "Recusada, refaça"
 *   - BLOCKED → "Bloqueada, suporte Asaas"
 */
export function PaymentAccountAlertBanner({
  condominiumId,
  visibleFor,
}: {
  condominiumId: string | undefined;
  /** `admin-only` → some pra papéis não-admin (default). */
  visibleFor?: 'admin-only' | 'all';
}) {
  void visibleFor; // o caller já filtra; aqui só evitamos unused
  const { account, isLoading } = usePaymentAccount(condominiumId);

  if (isLoading || account?.status === 'ACTIVE') return null;

  const config = (() => {
    if (!account) {
      return {
        title: 'Configure onde o condomínio vai receber',
        body: 'Ainda não cadastramos a conta de recebimento. Sem ela, as cobranças geradas ficam só registradas — não viram Pix ou boleto para o morador.',
        cta: 'Configurar agora',
      };
    }
    switch (account.status) {
      case 'DRAFT':
      case 'PENDING_DOCS':
        return {
          title: 'Envie os documentos para liberar os recebimentos',
          body: 'Faltam alguns documentos para ativar a conta de recebimento. Leva uns 5 minutos.',
          cta: 'Enviar documentos',
        };
      case 'PENDING_REVIEW':
        return {
          title: 'Cadastro em análise',
          body: 'Os documentos foram recebidos e estão sendo avaliados. Você é avisado quando a conta liberar (até 48h úteis).',
          cta: 'Acompanhar status',
        };
      case 'REJECTED':
        return {
          title: 'Cadastro recusado',
          body:
            account.rejectReason ??
            'A análise não passou. Revise os dados e tente novamente.',
          cta: 'Refazer',
        };
      case 'BLOCKED':
        return {
          title: 'Conta de recebimento bloqueada',
          body: 'A conta foi bloqueada — abra para ver o motivo e como regularizar.',
          cta: 'Ver detalhes',
        };
      default:
        return null;
    }
  })();

  if (!config) return null;

  return (
    <Link
      to="/settings/payments"
      className="group flex items-start gap-3 rounded-ds-2xl border-l-[3px] border-l-amber-500 bg-amber-50/90 px-4 py-3.5 text-ds-sm leading-relaxed text-ds-secondary shadow-ds-card transition hover:-translate-y-0.5 hover:bg-amber-100/70 hover:shadow-ds-elev dark:bg-amber-500/[0.10] dark:text-ds-dim dark:hover:bg-amber-500/[0.16]"
    >
      <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-700 ring-1 ring-amber-500/30 dark:text-amber-300">
        {account ? (
          <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
        ) : (
          <Landmark className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-ds-body">{config.title}</span>
        <span className="block text-ds-dim">{config.body}</span>
        <span className="mt-1 inline-flex items-center gap-1 text-ds-xs font-semibold text-amber-700 dark:text-amber-300">
          {config.cta}
          <ArrowRight className="h-3 w-3 transition group-hover:translate-x-0.5" />
        </span>
      </span>
    </Link>
  );
}
