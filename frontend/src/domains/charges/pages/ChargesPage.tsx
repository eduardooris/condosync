import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Receipt, Search, Filter, CheckCircle2, Ban, Zap, Pencil, Settings2, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import { Badge } from '@/shared/components/ui/Badge';
import { Button } from '@/shared/components/ui/Button';
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog';
import {
  DialogFooter,
  FormDialog,
} from '@/shared/components/ui/Dialog';
import { EmptyState } from '@/shared/components/ui/EmptyState';
import { FormField } from '@/shared/components/ui/FormField';
import { GlassCard } from '@/shared/components/ui/GlassCard';
import { Input } from '@/shared/components/ui/Input';
import { ListSkeleton } from '@/shared/components/ui/Skeleton';
import { Textarea } from '@/shared/components/ui/Textarea';
import { useChargesPage, type StatusFilter } from '@/domains/charges/hooks/useChargesPage';
import { GenerateChargesDialog } from '@/domains/charges/components/GenerateChargesDialog';
import { EditChargeDialog } from '@/domains/charges/components/EditChargeDialog';
import {
  ChargeDetailDialog,
  type CondominiumPaymentSlice,
} from '@/domains/charges/components/ChargeDetailDialog';
import type { Charge } from '@/shared/types/api';
import { cn } from '@/shared/utils/cn';
import { useAuthStore } from '@/shared/stores/auth.store';

const statusOptions: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'pending', label: 'Pendente' },
  { key: 'paid', label: 'Pago' },
  { key: 'overdue', label: 'Atrasado' },
  { key: 'exempt', label: 'Isento' },
];

function formatBrl(n: number | string) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(n));
}

function formatDate(s: string) {
  try {
    return new Intl.DateTimeFormat('pt-BR').format(new Date(s));
  } catch {
    return s;
  }
}

function unitLabelForCharge(
  charge: Charge,
  unitLabelById: Map<string, string>,
  myUnitId: string | null | undefined,
): string {
  if (charge.unitId && myUnitId && charge.unitId === myUnitId) {
    return 'Sua unidade';
  }
  if (charge.unitId && unitLabelById.has(charge.unitId)) {
    return unitLabelById.get(charge.unitId)!;
  }
  if (charge.unitId) {
    return `Unidade · ${charge.unitId.slice(0, 8)}…`;
  }
  return '—';
}

const rowVariants = {
  hidden: { opacity: 0, x: -8 },
  show: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { duration: 0.22, delay: i * 0.05, ease: [0.25, 0.1, 0.25, 1] as const },
  }),
  exit: { opacity: 0, x: 8, transition: { duration: 0.15 } },
};

export function ChargesPage() {
  const myUnitId = useAuthStore((s) => s.activeCondominium?.unitId);
  const {
    condId,
    canManage,
    statusFilter,
    setStatusFilter,
    search,
    setSearch,
    chargesQuery,
    condominiumQuery,
    unitLabelById,
    list,
    filtered,
    generateOpen,
    setGenerateOpen,
  } = useChargesPage();
  const {
    payMutation,
    payMineMutation,
    exemptMutation,
    resendWhatsappMutation,
  } = chargesQuery;
  const condominiumWithPix = condominiumQuery.data as
    | ({ pixKeyType?: string | null; pixKeyValue?: string | null } & object)
    | undefined;
  const hasPixConfigured = Boolean(
    condominiumWithPix?.pixKeyType && condominiumWithPix?.pixKeyValue,
  );
  const [editing, setEditing] = useState<Charge | null>(null);
  const [detailCharge, setDetailCharge] = useState<Charge | null>(null);
  // Estado dos dois confirmadores: marcar paga (somente confirma) e isentar
  // (confirma + pede o motivo em formulário) — evitam clique acidental.
  const [chargeToPay, setChargeToPay] = useState<Charge | null>(null);
  const [chargeToExempt, setChargeToExempt] = useState<Charge | null>(null);
  const [exemptReason, setExemptReason] = useState('');

  if (chargesQuery.isLoading) return <ListSkeleton rows={8} />;

  return (
    <div className="ds-page mx-auto max-w-5xl min-w-0 space-y-4 ds-md:space-y-5">
      {/* Page header — mobile: coluna; desktop: linha */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
        className="flex flex-col gap-4 ds-md:flex-row ds-md:flex-wrap ds-md:items-start ds-md:justify-between ds-md:gap-3"
      >
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-xl font-extrabold tracking-tight text-ds-body ds-sm:text-2xl">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-ds-xl bg-gradient-to-br from-brand-300 to-brand-600 shadow-lg shadow-brand-500/25">
              <Receipt className="h-4 w-4 text-ds-on-primary" strokeWidth={2} aria-hidden />
            </div>
            Cobranças
          </h1>
          <p className="mt-1 text-pretty text-ds-sm leading-relaxed text-ds-dim">
            {list.length} cobrança{list.length !== 1 ? 's' : ''} encontrada{list.length !== 1 ? 's' : ''}
            {canManage ? (
              <>
                <span className="ds-md:hidden"> — toque na linha para detalhes. Use 2ª via (WhatsApp) em pendente ou atraso.</span>
                <span className="hidden ds-md:inline">
                  {' '}
                  — use &quot;2ª via (WhatsApp)&quot; em cobranças pendentes ou em atraso para reenviar o aviso ao responsável (integração ativa).
                </span>
              </>
            ) : null}
            {!canManage ? (
              <span> Toque numa cobrança para ver valor, vencimento, chave Pix e contato da administração.</span>
            ) : null}
          </p>
        </div>
        {canManage ? (
          <div className="flex w-full min-w-0 flex-col gap-2 ds-sm:flex-row ds-sm:flex-wrap ds-md:w-auto ds-md:justify-end">
            {condId ? (
              <Link
                to={`/condominiums/${condId}?section=financial`}
                className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-ds-md bg-ds-surface px-3 py-2 text-ds-xs font-semibold text-ds-dim transition hover:bg-ds-elevated hover:text-ds-body dark:bg-white/[0.04] dark:hover:bg-white/[0.08] ds-sm:min-h-0 ds-sm:justify-start ds-sm:py-1.5"
                title="Editar valor da taxa, dia de geração e dia de vencimento"
              >
                <Settings2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Ajustar taxa
              </Link>
            ) : null}
            <Button
              size="sm"
              fullWidth
              className="ds-sm:w-auto"
              onClick={() => setGenerateOpen(true)}
            >
              <Zap className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Gerar cobranças
            </Button>
          </div>
        ) : null}
      </motion.div>

      {canManage && !hasPixConfigured ? (
        <div className="rounded-ds-lg border border-ds-warning/40 bg-ds-warning/10 px-3 py-2.5 text-pretty text-ds-sm text-ds-warning ds-md:px-4">
          Configure a chave Pix em <span className="font-semibold">Ajustar taxa</span> para habilitar os envios de cobrança no WhatsApp.
        </div>
      ) : null}

      {/* Filter bar — mobile: busca largura total + chips com scroll horizontal */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.3 }}
        className="flex min-w-0 flex-col gap-3 ds-md:flex-row ds-md:flex-wrap ds-md:items-center"
      >
        <div className="relative min-w-0 w-full ds-md:flex-1 ds-md:min-w-[12rem]">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ds-subtle"
            aria-hidden
          />
          <Input
            type="search"
            placeholder="Buscar por unidade…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-11 w-full rounded-ds-md bg-[var(--ds-input-well-bg)] pl-9 pr-4 text-ds-sm text-ds-body placeholder:text-ds-subtle backdrop-blur-sm transition hover:bg-[var(--ds-input-well-bg-hover)] focus:outline-none focus:ring-2 focus:ring-brand-400/40 ds-md:h-9"
          />
        </div>

        <div className="min-w-0 w-full ds-md:w-auto ds-md:max-w-full">
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-widest text-ds-subtle ds-md:sr-only">
            Status
          </p>
          <div className="-mx-1 flex min-w-0 touch-pan-x">
            <div className="flex max-w-full flex-nowrap gap-1 overflow-x-auto overscroll-x-contain rounded-ds-md bg-[var(--ds-filter-track-bg)] p-1.5 pb-2 backdrop-blur-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ds-md:flex-wrap ds-md:overflow-visible ds-md:pb-1.5">
              <Filter className="ml-0.5 h-3.5 w-3.5 shrink-0 self-center text-ds-subtle ds-md:ml-1" aria-hidden />
              {statusOptions.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setStatusFilter(key)}
                  className={cn(
                    'relative shrink-0 rounded-ds-lg px-3.5 py-2 text-ds-xs font-semibold transition-all duration-200 ds-md:py-1',
                    statusFilter === key ? 'text-brand-900 dark:text-white' : 'text-ds-dim hover:text-ds-body',
                  )}
                >
                  {statusFilter === key && (
                    <motion.div
                      layoutId="charge-filter-bg"
                      className="absolute inset-0 rounded-ds-lg bg-gradient-to-r from-brand-500/45 to-brand-600/30 dark:from-brand-400/40 dark:to-brand-500/25"
                      transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                    />
                  )}
                  <span className="relative whitespace-nowrap">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* List */}
      {list.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="Nenhuma cobrança por aqui"
          description="Esta lista reúne cobranças do condomínio com valor, vencimento e status."
          suggestion={
            canManage
              ? 'Se o condomínio acabou de ser configurado, revise unidades ativas e gere as cobranças.'
              : 'Quando o síndico gerar uma cobrança para a sua unidade, ela aparecerá aqui.'
          }
          action={canManage ? { to: '/units', label: 'Ver unidades' } : undefined}
        />
      ) : filtered.length === 0 ? (
        <div className="rounded-ds-xl bg-ds-surface px-6 py-10 text-center dark:bg-white/[0.025]">
          <p className="text-ds-sm text-ds-dim">Nenhum resultado para o filtro atual.</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStatusFilter('all');
              setSearch('');
            }}
            className="mt-3 text-brand-700 hover:text-brand-600 dark:text-brand-300 dark:hover:text-brand-200"
          >
            Limpar filtros
          </Button>
        </div>
      ) : (
        <GlassCard className="max-w-full overflow-hidden p-2 ds-md:p-0">
          {/* Cabeçalho tipo tabela — desktop */}
          <div className="hidden border-b border-ds-stroke/50 bg-ds-surface px-5 py-3 text-[11px] font-bold uppercase tracking-widest text-ds-subtle dark:bg-white/[0.03] ds-md:grid ds-md:grid-cols-[minmax(0,1fr)_6.5rem_6.5rem_minmax(0,1fr)] ds-md:gap-4">
            <span>Unidade</span>
            <span className="text-right">Valor</span>
            <span className="text-right">Vencimento</span>
            <span className="text-right">Status / Ações</span>
          </div>
          <AnimatePresence initial={false}>
            {filtered.map((charge, i) => {
              const status = charge.status?.toLowerCase() as
                | 'pending'
                | 'paid'
                | 'overdue'
                | 'exempt'
                | 'canceled';
              const canResendWhatsapp =
                (status === 'pending' || status === 'overdue') && hasPixConfigured;
              const rowUnitLabel = unitLabelForCharge(charge, unitLabelById, myUnitId);
              return (
                <motion.div
                  key={charge.id}
                  custom={i}
                  variants={rowVariants}
                  initial="hidden"
                  animate="show"
                  exit="exit"
                  role="button"
                  tabIndex={0}
                  className={cn(
                    'grid cursor-pointer grid-cols-1 gap-3 rounded-ds-xl border border-ds-stroke/35 bg-ds-surface px-3 py-4 shadow-sm transition dark:bg-white/[0.03]',
                    'mb-3 last:mb-0 ds-md:mb-0 ds-md:rounded-none ds-md:border-0 ds-md:border-b ds-md:border-ds-stroke/30 ds-md:bg-transparent ds-md:px-5 ds-md:py-3.5 ds-md:shadow-none ds-md:last:border-b-0',
                    'hover:bg-ds-elevated focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40 dark:hover:bg-white/[0.05] ds-md:hover:bg-ds-surface dark:ds-md:hover:bg-white/[0.04]',
                    'ds-md:grid-cols-[minmax(0,1fr)_6.5rem_6.5rem_minmax(0,1fr)] ds-md:items-center ds-md:gap-4',
                  )}
                  onClick={() => setDetailCharge(charge)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setDetailCharge(charge);
                    }
                  }}
                >
                  <div className="min-w-0">
                    <p className="text-ds-sm font-semibold text-ds-body">{rowUnitLabel}</p>
                    <p className="text-[11px] text-ds-subtle">
                      {canManage ? `ID: ${charge.id?.slice(0, 8)}…` : 'Toque para ver detalhes e Pix'}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-3 ds-md:block ds-md:text-right">
                    <span className="text-[11px] font-bold uppercase tracking-widest text-ds-subtle ds-md:hidden">
                      Valor
                    </span>
                    <p className="text-right text-ds-sm font-bold tabular-nums text-ds-body">
                      {formatBrl(charge.amount ?? 0)}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-3 ds-md:block ds-md:text-right">
                    <span className="text-[11px] font-bold uppercase tracking-widest text-ds-subtle ds-md:hidden">
                      Vencimento
                    </span>
                    <p className="text-right text-[11px] text-ds-dim ds-md:text-ds-sm">
                      {charge.dueDate ? formatDate(String(charge.dueDate)) : '—'}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 ds-md:items-end">
                    <span className="text-[11px] font-bold uppercase tracking-widest text-ds-subtle ds-md:hidden">
                      Status / ações
                    </span>
                    <div className="flex flex-col gap-2 ds-md:flex ds-md:flex-row ds-md:flex-wrap ds-md:items-center ds-md:justify-end">
                      <Badge status={status} />
                      <div
                        className="grid max-ds-md:[&_button]:min-h-10 grid-cols-2 gap-2 ds-md:contents"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                    {canManage && status !== 'paid' && status !== 'exempt' && status !== 'canceled' && (
                      <>
                        {canResendWhatsapp && condId && (
                          <Button
                            size="sm"
                            variant="secondary"
                            title="Reenvia mensagem (segunda via) ao responsável no WhatsApp do condomínio"
                            onClick={() => {
                              resendWhatsappMutation.mutate(charge.id, {
                                onSuccess: () => {
                                  toast.success(
                                    'Segunda via enfileirada. O responsável receberá o aviso se o WhatsApp estiver conectado.',
                                  );
                                },
                                onError: (err) => {
                                  const msg =
                                    err && typeof err === 'object' && 'response' in err
                                      ? (err as { response?: { data?: { message?: string } } }).response
                                          ?.data?.message
                                      : null;
                                  toast.error(
                                    (typeof msg === 'string' && msg) ||
                                      'Não foi possível enfileirar o reenvio.',
                                  );
                                },
                              });
                            }}
                            disabled={resendWhatsappMutation.isPending}
                          >
                            <Send className="h-3 w-3" aria-hidden />
                            2ª via
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditing(charge)}
                          title="Editar valor / vencimento"
                        >
                          <Pencil className="h-3 w-3" aria-hidden />
                          Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setChargeToPay(charge)}
                          disabled={payMutation.isPending}
                          title="Confirmar pagamento dessa cobrança"
                        >
                          <CheckCircle2 className="h-3 w-3" aria-hidden />
                          Marcar paga
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setChargeToExempt(charge);
                            setExemptReason('');
                          }}
                          disabled={exemptMutation.isPending}
                          title="Isentar (com justificativa) — registrado no histórico"
                        >
                          <Ban className="h-3 w-3" aria-hidden />
                          Isentar
                        </Button>
                      </>
                    )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </GlassCard>
      )}

      {canManage && condId ? (
        <>
          <GenerateChargesDialog
            open={generateOpen}
            onOpenChange={setGenerateOpen}
            condominiumId={condId}
            defaultAmount={condominiumQuery.data?.monthlyFeeAmount ?? null}
          />
          <EditChargeDialog
            open={Boolean(editing)}
            onOpenChange={(o) => !o && setEditing(null)}
            condominiumId={condId}
            charge={editing}
          />
        </>
      ) : null}

      <ChargeDetailDialog
        open={Boolean(detailCharge)}
        onOpenChange={(open) => !open && setDetailCharge(null)}
        charge={detailCharge}
        unitLabel={detailCharge ? unitLabelForCharge(detailCharge, unitLabelById, myUnitId) : '—'}
        condominium={condominiumQuery.data as CondominiumPaymentSlice | undefined}
        condominiumLoading={condominiumQuery.isLoading}
        markPaidPending={payMineMutation.isPending}
        onMarkPaidByResident={
          // Só morador (não-admin) vê o botão "Já paguei" — admin tem o
          // botão "Marcar paga" direto na linha da lista.
          !canManage
            ? async (id: string) => {
                try {
                  await payMineMutation.mutateAsync(id);
                  toast.success(
                    'Pagamento registrado. A administração vai revisar.',
                  );
                } catch {
                  toast.error(
                    'Não foi possível registrar o pagamento. Tente novamente em alguns minutos.',
                  );
                }
              }
            : undefined
        }
      />

      {canManage ? (
        <>
          <ConfirmDialog
            open={Boolean(chargeToPay)}
            onOpenChange={(open) => {
              if (!open) setChargeToPay(null);
            }}
            title="Confirmar pagamento?"
            description={
              chargeToPay
                ? `Marcar como paga a cobrança de ${unitLabelForCharge(chargeToPay, unitLabelById, myUnitId)} — ${formatBrl(chargeToPay.amount)} (venc. ${chargeToPay.dueDate ? formatDate(String(chargeToPay.dueDate)) : '—'})? O status muda para "Pago" e o morador é notificado.`
                : ''
            }
            confirmLabel="Marcar paga"
            confirmDisabled={payMutation.isPending}
            onConfirm={() => {
              if (!chargeToPay) return;
              payMutation.mutate(chargeToPay.id, {
                onSuccess: () => {
                  toast.success('Cobrança marcada como paga.');
                  setChargeToPay(null);
                },
                onError: () =>
                  toast.error('Não foi possível marcar como paga.'),
              });
            }}
          />

          <FormDialog
            open={Boolean(chargeToExempt)}
            onOpenChange={(open) => {
              if (!open) {
                setChargeToExempt(null);
                setExemptReason('');
              }
            }}
            title="Isentar cobrança"
            description={
              chargeToExempt
                ? `Unidade ${unitLabelForCharge(chargeToExempt, unitLabelById, myUnitId)} · ${formatBrl(chargeToExempt.amount)}. Registre o motivo da isenção — fica no histórico para auditoria.`
                : ''
            }
          >
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                const reason = exemptReason.trim();
                if (!chargeToExempt || reason.length < 4) {
                  toast.error('Informe um motivo (mín. 4 caracteres).');
                  return;
                }
                exemptMutation.mutate(
                  { id: chargeToExempt.id, reason },
                  {
                    onSuccess: () => {
                      toast.success('Cobrança isenta.');
                      setChargeToExempt(null);
                      setExemptReason('');
                    },
                    onError: () =>
                      toast.error('Não foi possível isentar a cobrança.'),
                  },
                );
              }}
            >
              <FormField
                label="Motivo da isenção"
                htmlFor="exempt-reason"
                required
                hint="Ex.: morador em ajuda social, decisão da assembleia, ajuste interno."
              >
                <Textarea
                  id="exempt-reason"
                  rows={3}
                  value={exemptReason}
                  onChange={(e) => setExemptReason(e.target.value)}
                  placeholder="Descreva por que essa cobrança será isenta…"
                  maxLength={240}
                />
              </FormField>
              <DialogFooter>
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => {
                    setChargeToExempt(null);
                    setExemptReason('');
                  }}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={exemptMutation.isPending}>
                  {exemptMutation.isPending ? 'Aplicando…' : 'Isentar cobrança'}
                </Button>
              </DialogFooter>
            </form>
          </FormDialog>
        </>
      ) : null}
    </div>
  );
}
