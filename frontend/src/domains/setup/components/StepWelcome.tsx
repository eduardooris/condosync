import { motion, useReducedMotion } from 'framer-motion';
import { Building2, ListChecks, MessageCircle, Sparkles, Wallet } from 'lucide-react';
import { SetupShell } from '@/domains/setup/components/SetupShell';

interface StepWelcomeProps {
  onContinue: () => void;
  userName?: string;
}

const highlights = [
  { icon: Building2, label: 'Cadastrar o condomínio e suas unidades' },
  { icon: Wallet, label: 'Definir taxa, vencimento e regras financeiras' },
  { icon: ListChecks, label: 'Importar moradores em poucos cliques' },
  { icon: MessageCircle, label: 'Ativar comunicação por WhatsApp' },
];

export function StepWelcome({ onContinue, userName }: StepWelcomeProps) {
  const reduce = useReducedMotion();
  const greeting = userName?.split(' ')[0];

  return (
    <SetupShell
      step="welcome"
      eyebrow={greeting ? `Olá, ${greeting}` : 'Boas-vindas'}
      title="Vamos preparar seu condomínio em poucos minutos"
      description="Em 4 passos rápidos você terá tudo configurado: identidade, finanças, unidades e moradores. Pode pausar e retomar quando quiser — salvamos automaticamente."
      onPrimary={onContinue}
      primaryLabel="Vamos começar"
    >
      <div className="relative">
        {/* Decorative ring around CTA */}
        {!reduce ? (
          <motion.div
            className="pointer-events-none absolute -top-24 left-1/2 hidden h-32 w-32 -translate-x-1/2 rounded-full ds-md:block"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="ds-pulse-ring h-full w-full rounded-full bg-gradient-to-br from-brand-300/20 to-brand-500/5" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Sparkles className="h-7 w-7 text-brand-700 dark:text-brand-300" aria-hidden />
            </div>
          </motion.div>
        ) : null}

        <ul className="grid gap-3 ds-sm:grid-cols-2">
          {highlights.map(({ icon: Icon, label }, idx) => (
            <motion.li
              key={label}
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 * idx + 0.1, duration: 0.32 }}
              className="ds-surface flex items-start gap-3 px-4 py-3.5 hover:border-ds-stroke-strong"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-ds-lg bg-gradient-to-br from-brand-300/30 to-brand-500/10 ring-1 ring-brand-400/30">
                <Icon className="h-4 w-4 text-brand-700 dark:text-brand-300" strokeWidth={2} aria-hidden />
              </span>
              <span className="pt-1 text-ds-sm leading-relaxed text-ds-body">{label}</span>
            </motion.li>
          ))}
        </ul>
      </div>
      <p className="mt-6 text-ds-xs text-ds-subtle">
        Os dados são salvos automaticamente em cada etapa. Você pode sair e voltar sem perder o progresso.
      </p>
    </SetupShell>
  );
}
