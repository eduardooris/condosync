import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { AlertTriangle, Building2, CalendarDays, CheckCircle2, Layers, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { usePaymentAccount } from '@/domains/payments/hooks/usePaymentAccount';
import { paymentAccountStatusLabel } from '@/domains/payments/components/PaymentAccountStatusBadge';
import { Button } from '@/shared/components/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/Dialog';
import { queryKeys } from '@/shared/lib/queryKeys';
import { FormField } from '@/shared/components/ui/FormField';
import { Input } from '@/shared/components/ui/Input';
import { NativeSelect } from '@/shared/components/ui/NativeSelect';
import { Textarea } from '@/shared/components/ui/Textarea';
import { unitsService } from '@/domains/units/services/units.service';
import { useCharges } from '@/domains/charges/hooks/useCharges';
import { cn } from '@/shared/utils/cn';

type Mode = 'month' | 'unit';

interface GenerateChargesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  condominiumId: string;
  /** Valor padrão da taxa para sugerir no modo "unidade". */
  defaultAmount?: number | string | null;
}

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function GenerateChargesDialog({
  open,
  onOpenChange,
  condominiumId,
  defaultAmount,
}: GenerateChargesDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <GenerateChargesDialogBody
          condominiumId={condominiumId}
          defaultAmount={defaultAmount}
          onOpenChange={onOpenChange}
        />
      ) : null}
    </Dialog>
  );
}

function GenerateChargesDialogBody({
  condominiumId,
  defaultAmount,
  onOpenChange,
}: {
  condominiumId: string;
  defaultAmount?: number | string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { generateMutation, createMutation } = useCharges(condominiumId);
  const [mode, setMode] = useState<Mode>('month');
  const [month, setMonth] = useState(() => currentMonth());
  const [unitId, setUnitId] = useState<string>('');
  const [amountText, setAmountText] = useState<string>(() =>
    defaultAmount ? String(defaultAmount).replace('.', ',') : '',
  );
  const [dueDate, setDueDate] = useState<string>('');
  const [description, setDescription] = useState<string>('');

  const { data: units, isLoading: unitsLoading } = useQuery({
    queryKey: queryKeys.units.list(condominiumId),
    queryFn: () => unitsService.list(condominiumId),
  });

  // RN: o proprietário deve pelo imóvel independente de ocupação. Mostramos
  // TODAS as unidades elegíveis (não isentas), marcando vagas com um sufixo
  // informativo. A filtragem de isenção fica no backend (`isExempt = false`).
  const eligibleUnits = useMemo(() => units ?? [], [units]);

  const amountNumber = amountText
    ? Number(amountText.replace(/\./g, '').replace(',', '.'))
    : null;
  const amountValid =
    amountText === '' || (Number.isFinite(amountNumber!) && amountNumber! > 0);

  const submitting = generateMutation.isPending || createMutation.isPending;

  const { account: paymentAccount } = usePaymentAccount(condominiumId);
  const accountActive = paymentAccount?.status === 'ACTIVE';
  // Mostra o aviso de pré-condições somente quando a feature Asaas está em
  // uso (subconta presente). Antes da criação, comportamento legado (Pix
  // manual) — nenhum checklist é necessário.
  const showPreflightChecklist = Boolean(paymentAccount);

  async function handleSubmit() {
    if (mode === 'month') {
      try {
        const result = await generateMutation.mutateAsync(month);
        if (result.created === 0) {
          toast.success(
            `Nenhuma cobrança nova: já existem lançamentos para ${month} em todas as unidades.`,
          );
        } else if (result.asaasFailed > 0) {
          const detail = result.failures
            .slice(0, 2)
            .map((f) => `${f.unitLabel}: ${f.message}`)
            .join(' · ');
          toast.error(
            `${result.created} criada(s), mas ${result.asaasFailed} não foram para a Asaas.` +
              (detail ? ` ${detail}` : '') +
              ' Use "Emitir pendentes na Asaas" após corrigir.',
            { duration: 14_000 },
          );
        } else {
          const asaasPart =
            result.asaasEmitted > 0
              ? ` · ${result.asaasEmitted} na Asaas`
              : '';
          toast.success(
            `${result.created} cobrança${result.created !== 1 ? 's' : ''} gerada${result.created !== 1 ? 's' : ''} para ${month}${asaasPart}.`,
          );
        }
        onOpenChange(false);
      } catch (err) {
        const friendly = extractPreflightError(err);
        toast.error(friendly ?? extractError(err) ?? 'Não foi possível gerar as cobranças.', {
          duration: 8000,
        });
      }
      return;
    }

    if (!unitId) {
      toast.error('Selecione a unidade.');
      return;
    }
    if (!amountValid) {
      toast.error('Informe um valor válido.');
      return;
    }

    try {
      await createMutation.mutateAsync({
        unitId,
        billingMonth: month,
        ...(amountNumber ? { amount: amountNumber.toFixed(2) } : {}),
        ...(dueDate ? { dueDate } : {}),
        ...(description.trim() ? { description: description.trim() } : {}),
      });
      toast.success('Cobrança avulsa criada.');
      onOpenChange(false);
    } catch (err) {
      const friendly = extractPreflightError(err);
      toast.error(friendly ?? extractError(err) ?? 'Não foi possível criar a cobrança.', {
        duration: 8000,
      });
    }
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-brand-700 dark:text-brand-300" aria-hidden />
          Gerar cobranças
        </DialogTitle>
        <DialogDescription>
          Gere a taxa do mês para o condomínio inteiro ou crie uma cobrança avulsa para uma unidade
          específica.
        </DialogDescription>
      </DialogHeader>

      {showPreflightChecklist && !accountActive ? (
        <div className="mb-2 rounded-ds-xl border border-amber-500/30 bg-amber-500/[0.08] p-3 text-ds-sm">
          <p className="flex items-start gap-2 text-amber-700 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <strong>Recebimentos ainda não ativos</strong> —{' '}
              {paymentAccountStatusLabel(paymentAccount!.status)}. Finalize o
              cadastro de pagamentos para emitir cobranças online.{' '}
              <Link
                to="/settings/payments"
                className="font-semibold underline-offset-2 hover:underline"
              >
                Resolver
              </Link>
              .
            </span>
          </p>
        </div>
      ) : null}

      {showPreflightChecklist && accountActive ? (
        <div className="mb-2 flex items-center gap-2 rounded-ds-xl border border-emerald-500/30 bg-emerald-500/[0.08] p-3 text-ds-xs text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Cobranças vão sair com Pix, boleto e cartão automáticos.
        </div>
      ) : null}

      {/* Mode toggle */}
      <div
        className="grid grid-cols-1 gap-2 rounded-ds-md bg-[var(--ds-filter-track-bg)] p-1 ds-sm:grid-cols-2"
        role="tablist"
      >
        <ModeTab
          active={mode === 'month'}
          onClick={() => setMode('month')}
          icon={Layers}
          label="Mês inteiro"
          hint="Todas as unidades não isentas"
        />
        <ModeTab
          active={mode === 'unit'}
          onClick={() => setMode('unit')}
          icon={Building2}
          label="Unidade avulsa"
          hint="Cobrança extra ou ajuste"
        />
      </div>

      <div className="mt-4 space-y-4">
        <FormField label="Competência" htmlFor="charge-month" required>
          <div className="relative">
            <CalendarDays
              className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ds-subtle"
              aria-hidden
            />
            <Input
              id="charge-month"
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="pl-9"
            />
          </div>
        </FormField>

        {mode === 'unit' ? (
          <>
            <FormField label="Unidade" htmlFor="charge-unit" required>
              <NativeSelect
                id="charge-unit"
                value={unitId}
                onChange={(e) => setUnitId(e.target.value)}
                disabled={unitsLoading}
              >
                <option value="">
                  {unitsLoading ? 'Carregando…' : 'Selecione uma unidade'}
                </option>
                {eligibleUnits.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.block}-{u.number}
                    {u.status !== 'OCCUPIED' ? ' (sem ocupação)' : ''}
                  </option>
                ))}
              </NativeSelect>
            </FormField>

            <div className="grid gap-4 ds-sm:grid-cols-2">
              <FormField
                label="Valor (R$)"
                htmlFor="charge-amount"
                hint="Em branco usa a taxa padrão do condomínio."
              >
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ds-sm font-semibold text-ds-subtle">
                    R$
                  </span>
                  <Input
                    id="charge-amount"
                    value={amountText}
                    onChange={(e) => setAmountText(e.target.value)}
                    placeholder={defaultAmount ? String(defaultAmount).replace('.', ',') : '0,00'}
                    inputMode="decimal"
                    invalid={!amountValid}
                    className="pl-10"
                  />
                </div>
              </FormField>
              <FormField
                label="Vencimento"
                htmlFor="charge-due"
                hint="Em branco usa o dia padrão do condomínio."
              >
                <Input
                  id="charge-due"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </FormField>
            </div>
            <FormField
              label="Descrição"
              htmlFor="charge-description"
              hint="Opcional (até 80 caracteres). Use como título curto."
            >
              <Textarea
                id="charge-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={80}
                placeholder="Ex.: Rateio pintura fachada"
              />
            </FormField>
          </>
        ) : (
          <p className="rounded-ds-md bg-[var(--ds-filter-track-bg)] px-3 py-2.5 text-ds-sm text-ds-dim">
            Será criada uma cobrança para{' '}
            <span className="font-semibold text-ds-body">
              cada unidade não isenta
            </span>{' '}
            que ainda não tenha lançamento neste mês — incluindo as unidades
            sem morador (o proprietário continua devendo a taxa). Para
            isentar uma unidade permanentemente, marque-a como isenta no
            cadastro.
          </p>
        )}
      </div>

      <DialogFooter>
        <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={submitting}>
          Cancelar
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={submitting || (mode === 'unit' && (!unitId || !amountValid))}
        >
          {submitting ? 'Gerando…' : mode === 'month' ? 'Gerar mês' : 'Criar cobrança'}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function ModeTab({
  active,
  onClick,
  icon: Icon,
  label,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Layers;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'flex min-w-0 items-start gap-2 rounded-ds-lg px-2 py-2 text-left transition ds-sm:gap-2.5 ds-sm:px-3 ds-sm:py-2.5',
        active
          ? 'bg-gradient-to-br from-brand-500/35 to-brand-600/20 text-brand-900 shadow-inner shadow-brand-500/10 dark:from-brand-400/30 dark:to-brand-500/10 dark:text-white'
          : 'text-ds-dim hover:bg-ds-surface hover:text-ds-body dark:hover:bg-white/[0.04]',
      )}
    >
      <Icon
        className={cn(
          'mt-0.5 h-4 w-4 shrink-0',
          active ? 'text-brand-800 dark:text-brand-300' : 'text-brand-700/50 dark:text-brand-400/50',
        )}
        aria-hidden
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-ds-sm font-semibold">{label}</span>
        <span className="block truncate text-[11px] text-ds-subtle">{hint}</span>
      </span>
    </button>
  );
}

function extractError(err: unknown): string | null {
  if (typeof err !== 'object' || !err) return null;
  const anyErr = err as {
    response?: { data?: { message?: string | string[] } };
    message?: string;
  };
  const msg = anyErr.response?.data?.message ?? anyErr.message;
  if (Array.isArray(msg)) return msg.join(' • ');
  return msg ?? null;
}

/**
 * Detecta erros estruturados do pre-flight do backend
 * (`MISSING_FINANCIAL_RESPONSIBLES`, `PAYMENT_ACCOUNT_NOT_ACTIVE`...) e
 * devolve uma mensagem amigável com instrução de próximo passo.
 *
 * Quando o erro não bate, retorna `null` — caller usa `extractError`.
 */
function extractPreflightError(err: unknown): string | null {
  if (typeof err !== 'object' || !err) return null;
  const anyErr = err as {
    response?: {
      data?: {
        code?: string;
        message?: string;
        pendingUnits?: { id: string; label: string }[];
      };
    };
  };
  const data = anyErr.response?.data;
  if (!data?.code) return null;

  if (data.code === 'PAYMENT_ACCOUNT_NOT_ACTIVE') {
    return (
      'Os recebimentos do condomínio ainda não foram ativados. ' +
      'Abra Configurações → Pagamentos para concluir o cadastro.'
    );
  }
  if (data.code === 'MISSING_FINANCIAL_RESPONSIBLES') {
    const labels = (data.pendingUnits ?? [])
      .slice(0, 5)
      .map((u) => u.label)
      .join(', ');
    const extra =
      (data.pendingUnits?.length ?? 0) > 5
        ? ` (e mais ${(data.pendingUnits?.length ?? 0) - 5})`
        : '';
    return (
      'Antes de gerar as cobranças, indique quem paga em cada unidade: ' +
      (labels || 'pendentes') +
      extra +
      '.'
    );
  }
  if (data.code === 'MISSING_FINANCIAL_RESPONSIBLE') {
    return (
      'Esta unidade ainda não tem ninguém marcado como pagador. ' +
      'Cadastre o responsável antes de criar a cobrança.'
    );
  }
  return data.message ?? null;
}
