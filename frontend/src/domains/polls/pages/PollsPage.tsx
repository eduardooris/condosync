import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart2, Plus, Lock, Clock, CheckCircle2, PieChart } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  PieChart as RechartsPie,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import toast from 'react-hot-toast';
import { Button } from '@/shared/components/ui/Button';
import { EmptyState } from '@/shared/components/ui/EmptyState';
import { GlassCard } from '@/shared/components/ui/GlassCard';
import { Input } from '@/shared/components/ui/Input';
import { Textarea } from '@/shared/components/ui/Textarea';
import { Spinner } from '@/shared/components/ui/Spinner';
import { FormDialog, DialogFooter, DialogClose } from '@/shared/components/ui/Dialog';
import { FormField } from '@/shared/components/ui/FormField';
import { PageHeader } from '@/shared/components/ui/PageHeader';
import { usePollsPage } from '@/domains/polls/hooks/usePollsPage';
import { pollFormSchema, type PollFormValues } from '@/domains/polls/schemas/polls.schema';
import { useAuthStore } from '@/shared/stores/auth.store';
import { cn } from '@/shared/utils/cn';
import type { PollMyParticipationItem } from '@/shared/types/api';

function envelopeMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const data = (err as { response?: { data?: { message?: unknown } } }).response?.data;
    if (data && typeof data.message === 'string' && data.message.trim()) return data.message;
  }
  return fallback;
}

const PIE_COLORS = ['#5591eb', '#2ec886', '#f0b840', '#f05050', '#8b5cf6'];

function PollStatusChip({ status }: { status: string }) {
  const isOpen = status === 'OPEN';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-ds-pill px-2.5 py-1 text-[11px] font-bold',
        isOpen
          ? 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/25'
          : 'bg-slate-500/15 text-slate-400 ring-1 ring-slate-500/20',
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', isOpen ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500')} aria-hidden />
      {isOpen ? 'Aberta' : 'Encerrada'}
    </span>
  );
}

function ProgressBar({ percent, color = '#5591eb' }: { percent: number; color?: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
      <motion.div
        className="h-full rounded-full"
        style={{ background: color }}
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(100, percent)}%` }}
        transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
      />
    </div>
  );
}

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.28, delay: i * 0.07, ease: [0.25, 0.1, 0.25, 1] as const },
  }),
};

export function PollsPage() {
  const condo = useAuthStore((state) => state.activeCondominium);
  const role = useAuthStore((state) => state.role);
  const canManagePoll = role === 'ADMIN';
  const [selectedPollForResults, setSelectedPollForResults] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const form = useForm<PollFormValues>({
    resolver: zodResolver(pollFormSchema),
  });
  const { pollsQuery, participationQuery, resultsQuery, createMutation, closeMutation, voteMutation } =
    usePollsPage(condo?.id, selectedPollForResults);
  const polls = pollsQuery.data;
  const participation = participationQuery.data;
  const isParticipationLoading = participationQuery.isLoading;

  const participationByPollId = useMemo(() => {
    const m = new Map<string, PollMyParticipationItem>();
    for (const it of participation?.items ?? []) {
      m.set(it.pollId, it);
    }
    return m;
  }, [participation?.items]);

  const results = resultsQuery.data;

  if (!condo?.id) {
    return <p className="ds-page text-ds-sm text-ds-dim">Selecione um condomínio no topo da página.</p>;
  }

  if (pollsQuery.isLoading) return <Spinner />;

  const list = polls ?? [];

  const pieData = results
    ? Object.entries(results.counts).map(([id, count]) => ({
        name: id,
        value: count as number,
      }))
    : [];

  return (
    <div className="ds-page mx-auto max-w-3xl min-w-0 space-y-5">
      <PageHeader
        title="Enquetes"
        description={`${list.length} enquete${list.length !== 1 ? 's' : ''} — o voto da sua unidade é registrado pelo responsável financeiro (cadastrado em Moradores). Totais por opção aparecem após o encerramento.`}
        actions={
          canManagePoll ? (
            <FormDialog
              open={dialogOpen}
              onOpenChange={(v) => {
                setDialogOpen(v);
                if (!v) form.reset();
              }}
              trigger={
                <Button size="sm">
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                  Nova enquete
                </Button>
              }
              title="Nova enquete"
            >
              <form
                className="space-y-4"
                onSubmit={form.handleSubmit((v) =>
                  createMutation.mutate(v, {
                    onSuccess: () => {
                      toast.success('Enquete criada com sucesso!');
                      form.reset();
                      setDialogOpen(false);
                    },
                    onError: () => {
                      toast.error('Erro ao criar enquete. Tente novamente.');
                    },
                  }),
                )}
              >
                <FormField label="Título" htmlFor="poll-title" required error={form.formState.errors.title?.message}>
                  <Input
                    id="poll-title"
                    placeholder="Ex: Troca da administradora"
                    {...form.register('title', { required: 'Título é obrigatório' })}
                  />
                </FormField>

                <FormField label="Descrição" htmlFor="poll-desc">
                  <Textarea
                    id="poll-desc"
                    placeholder="Descreva o contexto da enquete (opcional)"
                    className="min-h-[5rem]"
                    {...form.register('description')}
                  />
                </FormField>

                <div className="grid grid-cols-1 gap-3 ds-sm:grid-cols-2">
                  <FormField label="Opção 1" htmlFor="poll-opt-a" required error={form.formState.errors.optionA?.message}>
                    <Input
                      id="poll-opt-a"
                      placeholder="Ex: Sim"
                      {...form.register('optionA', { required: 'Opção 1 é obrigatória' })}
                    />
                  </FormField>
                  <FormField label="Opção 2" htmlFor="poll-opt-b" required error={form.formState.errors.optionB?.message}>
                    <Input
                      id="poll-opt-b"
                      placeholder="Ex: Não"
                      {...form.register('optionB', { required: 'Opção 2 é obrigatória' })}
                    />
                  </FormField>
                </div>

                <FormField label="Encerramento" htmlFor="poll-closes" required error={form.formState.errors.closesAt?.message}>
                  <Input
                    id="poll-closes"
                    type="datetime-local"
                    className="min-h-11 w-full min-w-0 max-w-full font-mono text-ds-sm"
                    {...form.register('closesAt', { required: 'Data de encerramento é obrigatória' })}
                  />
                </FormField>

                <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="ghost" size="sm">
                      Cancelar
                    </Button>
                  </DialogClose>
                  <Button type="submit" variant="gradient" size="sm" disabled={createMutation.isPending}>
                    {createMutation.isPending ? 'Criando…' : 'Criar enquete'}
                  </Button>
                </DialogFooter>
              </form>
            </FormDialog>
          ) : undefined
        }
      />

      {list.length === 0 ? (
        <EmptyState
          icon={BarChart2}
          title="Nenhuma enquete ativa"
          description="Votações consultivas e assembleias simplificadas aparecem aqui com título, opções, prazo e contagem de votos."
          suggestion={canManagePoll ? undefined : 'Quando o síndico publicar enquetes, elas aparecerão aqui.'}
          action={
            canManagePoll
              ? { label: 'Criar primeira enquete', onClick: () => setDialogOpen(true) }
              : undefined
          }
        />
      ) : (
        <motion.div
          className="space-y-4"
          variants={{ show: { transition: { staggerChildren: 0.07 } } }}
          initial="hidden"
          animate="show"
        >
          {list.map((poll, i) => {
            const isOpen = poll.status === 'OPEN';
            const part = participationByPollId.get(poll.id);
            const canVoteThis = part?.canVote === true;
            const hasVoted = part?.hasVoted === true;
            const selectedOptionId = part?.selectedOptionId ?? null;
            const totalVotes = poll.options.reduce((acc, o) => acc + ((o as { voteCount?: number }).voteCount ?? 0), 0);

            return (
              <motion.div key={poll.id} custom={i} variants={cardVariants}>
                <GlassCard className={cn('space-y-4', !isOpen && 'opacity-90')}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <PollStatusChip status={poll.status} />
                        {!isOpen && (
                          <span className="flex items-center gap-1 text-[11px] text-ds-subtle">
                            <Lock className="h-3 w-3" aria-hidden />
                            Encerrada
                          </span>
                        )}
                      </div>
                      <h3 className="text-ds-md font-bold text-ds-body">{poll.title}</h3>
                      {poll.closesAt && (
                        <p className="mt-0.5 flex items-center gap-1 text-[11px] text-ds-subtle">
                          <Clock className="h-3 w-3" aria-hidden />
                          {isOpen ? 'Encerra em' : 'Encerrou em'}{' '}
                          {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(poll.closesAt))}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {canManagePoll && isOpen && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            closeMutation.mutate(poll.id, {
                              onError: () => toast.error('Não foi possível encerrar a enquete.'),
                            })
                          }
                          disabled={closeMutation.isPending}
                        >
                          Encerrar
                        </Button>
                      )}
                      {!isOpen && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setSelectedPollForResults(
                              selectedPollForResults === poll.id ? null : poll.id,
                            )
                          }
                        >
                          <PieChart className="h-3.5 w-3.5" aria-hidden />
                          {selectedPollForResults === poll.id ? 'Ocultar' : 'Resultado'}
                        </Button>
                      )}
                    </div>
                  </div>

                  {isOpen && !isParticipationLoading && canVoteThis && hasVoted && (
                    <p className="flex items-center gap-1.5 rounded-ds-md bg-emerald-500/10 px-2.5 py-1.5 text-[12px] text-emerald-300 ring-1 ring-emerald-500/20">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      Sua unidade já votou nesta enquete. Os percentuais por opção aparecem quando a enquete for encerrada.
                    </p>
                  )}

                  {isOpen && !isParticipationLoading && !canVoteThis && (
                    <p className="text-[12px] text-ds-dim">
                      Somente o <strong className="text-ds-body">responsável financeiro</strong> da unidade (definido em
                      Moradores) pode votar. Se o seu acesso ainda for outro perfil, peça ao síndico para conferir o
                      cadastro.
                    </p>
                  )}

                  <div className="space-y-3">
                    {poll.options.map((option, oi) => {
                      const voteCount = (option as { voteCount?: number }).voteCount ?? 0;
                      const percent = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
                      const color = PIE_COLORS[oi % PIE_COLORS.length]!;
                      const isMySelection = hasVoted && selectedOptionId === option.id;
                      const showOpenVoteUi =
                        isOpen && !isParticipationLoading && canVoteThis && !hasVoted;

                      return (
                        <div key={option.id} className="space-y-1.5">
                          <div className="flex min-w-0 items-center justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-2">
                              {showOpenVoteUi && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    voteMutation.mutate(
                                      { pollId: poll.id, optionId: option.id },
                                      {
                                        onSuccess: () => toast.success('Voto registrado com sucesso.'),
                                        onError: (err) =>
                                          toast.error(envelopeMessage(err, 'Não foi possível registrar o voto.')),
                                      },
                                    )
                                  }
                                  disabled={voteMutation.isPending}
                                  className={cn(
                                    'group flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition',
                                    'border-ds-stroke/60 hover:border-brand-400 hover:bg-brand-400/10',
                                  )}
                                  aria-label={`Votar em ${option.label}`}
                                >
                                  <span className="h-2 w-2 rounded-full bg-brand-300 opacity-0 transition group-hover:opacity-100" />
                                </button>
                              )}
                              {isOpen && hasVoted && isMySelection && (
                                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
                              )}
                              {!isOpen && (
                                <CheckCircle2 className="h-4 w-4 shrink-0 text-ds-subtle" aria-hidden />
                              )}
                              <span className="min-w-0 truncate text-ds-sm font-medium text-ds-body">
                                {option.label}
                              </span>
                            </div>
                            <span className="shrink-0 text-ds-xs font-bold tabular-nums text-ds-dim">
                              {isOpen
                                ? '—'
                                : `${voteCount} voto${voteCount !== 1 ? 's' : ''} · ${percent}%`}
                            </span>
                          </div>
                          {!isOpen && <ProgressBar percent={percent} color={color} />}
                        </div>
                      );
                    })}
                  </div>

                  {!isOpen && totalVotes > 0 && (
                    <p className="text-[11px] text-ds-subtle">
                      {totalVotes} voto{totalVotes !== 1 ? 's' : ''} registrado{totalVotes !== 1 ? 's' : ''}
                    </p>
                  )}
                </GlassCard>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      <AnimatePresence>
        {results && selectedPollForResults && pieData.length > 0 && (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
          >
            <GlassCard className="border-violet-400/20">
              <h3 className="mb-1 flex items-center gap-2 text-ds-md font-bold text-ds-body">
                <PieChart className="h-4 w-4 text-violet-400" aria-hidden />
                Resultado: {results.title}
              </h3>
              <p className="mb-4 text-ds-xs text-ds-dim">
                {results.totalVotes} voto{results.totalVotes !== 1 ? 's' : ''} /{' '}
                {results.totalOccupiedUnits} unidade{results.totalOccupiedUnits !== 1 ? 's' : ''} ocupada{results.totalOccupiedUnits !== 1 ? 's' : ''}
              </p>
              <div className="h-[min(220px,50vh)] w-full min-w-0 max-w-full">
                <ResponsiveContainer width="100%" height="100%">
                <RechartsPie>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((_, idx) => (
                      <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="rounded-ds-lg border border-ds-stroke/80 bg-ds-elevated/95 px-3 py-2 text-ds-xs backdrop-blur-md">
                          <p className="font-bold text-ds-body">{String(payload[0]?.name)}</p>
                          <p className="text-ds-dim">{String(payload[0]?.value)} votos</p>
                        </div>
                      );
                    }}
                  />
                  <Legend
                    formatter={(value) => (
                      <span className="text-[11px] text-ds-dim">{value}</span>
                    )}
                  />
                </RechartsPie>
              </ResponsiveContainer>
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      {!canManagePoll && (
        <p className="text-center text-ds-xs text-ds-subtle">
          Apenas administradores criam enquetes. O voto da unidade fica a cargo do responsável financeiro.
        </p>
      )}
    </div>
  );
}
