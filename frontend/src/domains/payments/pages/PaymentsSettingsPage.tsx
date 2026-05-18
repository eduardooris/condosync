import { ExternalLink, Landmark, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { PageHeader } from '@/shared/components/ui/PageHeader';
import { Button } from '@/shared/components/ui/Button';
import { EmptyState } from '@/shared/components/ui/EmptyState';
import { GlassCard } from '@/shared/components/ui/GlassCard';
import { Spinner } from '@/shared/components/ui/Spinner';
import { useAuthStore } from '@/shared/stores/auth.store';
import { usePaymentAccount } from '@/domains/payments/hooks/usePaymentAccount';
import {
  PaymentAccountStatusBadge,
  paymentAccountStatusLabel,
} from '@/domains/payments/components/PaymentAccountStatusBadge';
import type { PaymentAccountApprovalStatus } from '@/domains/payments/services/payment-accounts.service';
import { cn } from '@/shared/utils/cn';

/**
 * Painel de gestão da conta digital (subconta Asaas) do condomínio.
 *
 * UX:
 *   - Subconta inexistente → CTA "Configurar conta digital" → vai pro setup
 *   - Subconta em análise → status + reenviar docs + verificar status
 *   - Ativa → resumo + link pra painel Asaas
 *
 * Acesso: ADMIN (síndico criador) — `SUB_ADMIN` vê só leitura (sem botões).
 */
export function PaymentsSettingsPage() {
  const condominium = useAuthStore((s) => s.activeCondominium);
  const role = useAuthStore((s) => s.role);
  const isAdmin = role === 'ADMIN';

  const {
    account,
    isLoading,
    refreshMutation,
    refreshOnboardingMutation,
  } = usePaymentAccount(condominium?.id);

  if (!condominium) {
    return (
      <div className="ds-page mx-auto max-w-3xl">
        <p className="text-ds-sm text-ds-dim">
          Selecione um condomínio para gerenciar a conta digital.
        </p>
      </div>
    );
  }

  return (
    <div className="ds-page mx-auto max-w-3xl space-y-5">
      <PageHeader
        title="Pagamentos"
        description="Conta digital que recebe as cobranças do condomínio. Operada pela Asaas."
      />

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : !account ? (
        <EmptyState
          icon={Landmark}
          title="Sem conta digital configurada"
          description="Antes de emitir cobranças via Asaas, é preciso criar a conta digital do condomínio (CPF do síndico ou CNPJ do condomínio). Você fez isso no setup do condomínio — se pulou, é só rodar de novo."
          action={
            isAdmin
              ? { to: '/setup', label: 'Abrir setup novamente' }
              : undefined
          }
        />
      ) : (
        <>
          {/* Card principal — status + dados do titular */}
          <GlassCard className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-ds-xs uppercase tracking-widest text-ds-dim">
                  Titular ({account.holderType})
                </p>
                <p className="mt-1 text-ds-lg font-semibold text-ds-body">
                  {account.holderLegalName}
                </p>
                <p className="mt-0.5 text-ds-xs text-ds-dim">
                  {account.holderCpfCnpjMasked}
                </p>
              </div>
              <PaymentAccountStatusBadge status={account.status} />
            </div>

            {account.status === 'ACTIVE' ? (
              <p className="rounded-ds-lg bg-emerald-500/10 p-3 text-ds-sm text-emerald-700 dark:text-emerald-300">
                ✓ Conta ativa. As cobranças são emitidas direto na Asaas e os
                pagamentos caem na conta digital sem intermediação.
              </p>
            ) : account.status === 'REJECTED' ? (
              <p className="rounded-ds-lg bg-rose-500/10 p-3 text-ds-sm text-rose-700 dark:text-rose-300">
                {account.rejectReason ??
                  'A conta digital foi recusada pela Asaas. Refaça o setup com dados corrigidos.'}
              </p>
            ) : (
              <p className="rounded-ds-lg bg-amber-500/10 p-3 text-ds-sm text-amber-700 dark:text-amber-300">
                Sua conta está em <strong>{paymentAccountStatusLabel(account.status)}</strong>.
                Envie os documentos pelo link de onboarding para a Asaas liberar
                os recebimentos.
              </p>
            )}
          </GlassCard>

          {/* Checklist de aprovação */}
          <GlassCard className="space-y-3">
            <h2 className="text-ds-md font-semibold text-ds-body">
              Checklist de aprovação
            </h2>
            <ul className="space-y-2 text-ds-sm">
              <ChecklistItem
                label="Dados comerciais"
                status={account.commercialInfoStatus}
              />
              <ChecklistItem
                label="Dados bancários"
                status={account.bankAccountInfoStatus}
              />
              <ChecklistItem
                label="Documentos (RG/CNH ou contrato social + selfie)"
                status={account.documentationStatus}
              />
            </ul>

            {isAdmin && account.status !== 'ACTIVE' ? (
              <div className="flex flex-wrap gap-2 pt-2">
                {account.onboardingUrl ? (
                  <a
                    href={account.onboardingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-10 items-center gap-2 rounded-ds-md bg-brand-500 px-4 text-ds-sm font-semibold text-white hover:bg-brand-600"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Enviar documentos agora
                  </a>
                ) : null}
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() =>
                    refreshOnboardingMutation.mutateAsync().then(
                      (res) => {
                        if (res.onboardingUrl) {
                          window.open(res.onboardingUrl, '_blank', 'noopener');
                          toast.success('Novo link aberto em outra aba.');
                        }
                      },
                      () => toast.error('Não foi possível gerar novo link.'),
                    )
                  }
                  disabled={refreshOnboardingMutation.isPending}
                >
                  {refreshOnboardingMutation.isPending
                    ? 'Gerando…'
                    : 'Gerar novo link'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() =>
                    refreshMutation.mutateAsync().then(
                      (res) =>
                        toast.success(
                          `Status atualizado: ${paymentAccountStatusLabel(res.status)}.`,
                        ),
                      () => toast.error('Não foi possível atualizar o status.'),
                    )
                  }
                  disabled={refreshMutation.isPending}
                >
                  <RefreshCw
                    className={cn(
                      'h-4 w-4',
                      refreshMutation.isPending && 'animate-spin',
                    )}
                  />
                  Verificar status
                </Button>
              </div>
            ) : null}
          </GlassCard>

          {/* Painel Asaas */}
          {isAdmin ? (
            <GlassCard>
              <h2 className="text-ds-md font-semibold text-ds-body">
                Painel Asaas
              </h2>
              <p className="mt-1 text-ds-sm text-ds-dim">
                Saldo, extratos, configuração de chave Pix, transferências e
                tudo mais é feito no painel da Asaas com seu acesso direto.
              </p>
              <a
                href="https://www.asaas.com/login"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex h-10 items-center gap-2 rounded-ds-md border border-ds-stroke px-4 text-ds-sm font-semibold text-ds-body hover:bg-ds-surface"
              >
                <ExternalLink className="h-4 w-4" />
                Abrir painel Asaas
              </a>
            </GlassCard>
          ) : null}
        </>
      )}
    </div>
  );
}

function ChecklistItem({
  label,
  status,
}: {
  label: string;
  status: PaymentAccountApprovalStatus | null;
}) {
  const ok = status === 'APPROVED';
  const dotClass = ok
    ? 'bg-emerald-500'
    : status === 'REJECTED'
      ? 'bg-rose-500'
      : 'bg-amber-500';
  return (
    <li className="flex items-center gap-2">
      <span className={cn('h-2 w-2 rounded-full', dotClass)} />
      <span className={cn(ok ? 'text-ds-dim line-through' : 'text-ds-body')}>
        {label}
      </span>
      {status && status !== 'APPROVED' ? (
        <span className="text-ds-xs text-ds-dim">· {status}</span>
      ) : null}
    </li>
  );
}
