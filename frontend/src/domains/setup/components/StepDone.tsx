import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, CheckCircle2, MessageCircle, Newspaper, UserPlus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import confetti from 'canvas-confetti';
import { SetupShell } from '@/domains/setup/components/SetupShell';
import { useSetupStore } from '@/domains/setup/store/setup.store';
import { useAuthStore } from '@/shared/stores/auth.store';
import { queryKeys } from '@/shared/lib/queryKeys';

interface StepDoneProps {
  onFinish: () => void;
}

function formatBrl(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

const nextSteps = [
  {
    to: '/units',
    icon: UserPlus,
    title: 'Cadastrar moradores',
    description: 'Abra uma unidade para vincular os moradores e responsáveis financeiros.',
  },
  {
    to: '/bulletin',
    icon: Newspaper,
    title: 'Publicar primeiro recado',
    description: 'Avise os moradores que a gestão agora é digital.',
  },
  {
    to: '/condominiums',
    icon: MessageCircle,
    title: 'Convidar subsíndico',
    description: 'Compartilhe a gestão com alguém de confiança.',
  },
];

export function StepDone({ onFinish }: StepDoneProps) {
  const reduce = useReducedMotion();
  const queryClient = useQueryClient();
  const condominium = useAuthStore((s) => s.activeCondominium);
  const financial = useSetupStore((s) => s.financial);
  const unitsCount = useSetupStore((s) => s.unitsCount);

  // Pré-aquece o cache de condomínios para que QUALQUER navegação a partir
  // daqui (botão principal ou Links de próximos passos) já encontre o novo
  // condomínio em `condominiums.mine` no ProtectedLayout — sem isso o usuário
  // entra num loop /setup → /units → /setup.
  useEffect(() => {
    void queryClient.refetchQueries({ queryKey: queryKeys.condominiums.root() });
  }, [queryClient]);

  useEffect(() => {
    if (reduce) return;
    const colors = ['#4f7df0', '#6a93f6', '#2ec886', '#f0b840'];
    const fire = (particleRatio: number, opts: confetti.Options) =>
      confetti({
        ...opts,
        origin: { y: 0.7 },
        particleCount: Math.floor(160 * particleRatio),
        colors,
        disableForReducedMotion: true,
      });
    fire(0.25, { spread: 26, startVelocity: 55 });
    fire(0.2, { spread: 60 });
    fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
    fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
    fire(0.1, { spread: 120, startVelocity: 45 });
  }, [reduce]);

  return (
    <SetupShell
      step="done"
      eyebrow="Tudo pronto"
      title={condominium?.name ? `${condominium.name} está configurado!` : 'Configuração concluída!'}
      description="Você já pode começar a usar o CondoSync. Aqui está um resumo do que ficou pronto:"
      onPrimary={onFinish}
      primaryLabel="Ir para o painel"
      hideProgress
    >
      <div className="space-y-6">
        {/* Success badge */}
        <motion.div
          initial={reduce ? false : { scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 220, damping: 18 }}
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-300 to-emerald-500 shadow-lg shadow-emerald-500/40"
        >
          <CheckCircle2 className="h-8 w-8 text-ds-on-primary" strokeWidth={2.25} aria-hidden />
        </motion.div>

        {/* Summary */}
        <div className="grid gap-3 ds-sm:grid-cols-3">
          <SummaryCard label="Unidades" value={`${unitsCount}`} hint="cadastradas" />
          <SummaryCard label="Taxa mensal" value={formatBrl(financial.monthlyFeeAmount)} hint="por unidade" />
          <SummaryCard
            label="Vencimento"
            value={`Dia ${financial.billingDueDay}`}
            hint={`gera no dia ${financial.billingGenerationDay}`}
          />
        </div>

        {/* Next steps */}
        <div className="rounded-ds-2xl border border-ds-stroke-subtle bg-white/[0.02] p-4">
          <p className="mb-3 px-1 text-[10px] font-semibold uppercase tracking-widest text-ds-dim dark:text-brand-300/70">
            Próximos passos sugeridos
          </p>
          <ul className="grid gap-2">
            {nextSteps.map(({ to, icon: Icon, title, description }) => (
              <li key={to}>
                <Link
                  to={to}
                  onClick={onFinish}
                  className="group flex items-center gap-3 rounded-ds-xl border border-transparent px-3 py-3 transition hover:border-brand-400/30 hover:bg-white/[0.04]"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-ds-lg bg-gradient-to-br from-brand-300/20 to-brand-500/5 ring-1 ring-brand-400/25">
                    <Icon className="h-4 w-4 text-brand-700 dark:text-brand-300" strokeWidth={2} aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-ds-sm font-semibold text-ds-body">{title}</p>
                    <p className="truncate text-ds-xs text-ds-dim">{description}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-ds-subtle transition group-hover:translate-x-0.5 group-hover:text-brand-700 dark:group-hover:text-brand-300" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </SetupShell>
  );
}

function SummaryCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-ds-2xl border border-ds-stroke-subtle bg-white/[0.025] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-ds-dim dark:text-brand-300/70">{label}</p>
      <p className="mt-1.5 text-2xl font-bold tracking-tight text-ds-body">{value}</p>
      <p className="mt-0.5 text-ds-xs text-ds-subtle">{hint}</p>
    </div>
  );
}
