import { AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { StepWelcome } from '@/domains/setup/components/StepWelcome';
import { StepIdentity } from '@/domains/setup/components/StepIdentity';
import { StepFinancial } from '@/domains/setup/components/StepFinancial';
import { StepPayments } from '@/domains/setup/components/StepPayments';
import { StepUnits } from '@/domains/setup/components/StepUnits';
import { StepDone } from '@/domains/setup/components/StepDone';
import { nextStep, prevStep, useSetupStore } from '@/domains/setup/store/setup.store';
import { useAuthStore } from '@/shared/stores/auth.store';
import { queryKeys } from '@/shared/lib/queryKeys';

export function SetupPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const step = useSetupStore((s) => s.step);
  const setStep = useSetupStore((s) => s.setStep);
  const reset = useSetupStore((s) => s.reset);
  const userName = useAuthStore((s) => s.user?.name ?? undefined);

  const goNext = () => setStep(nextStep(step));
  const goBack = () => setStep(prevStep(step));

  const finish = async () => {
    // /setup vive FORA do ProtectedLayout, então invalidate sozinho não basta:
    // a query `condominiums.mine` está inativa e só re-fetcha ao montar de novo.
    // Garantimos cache fresco ANTES de navegar para evitar o loop onde o
    // ProtectedLayout enxerga `[]` (stale) e devolve o usuário pro setup.
    await queryClient.refetchQueries({ queryKey: queryKeys.condominiums.root() });
    navigate('/', { replace: true });
    reset();
  };

  return (
    <AnimatePresence mode="wait">
      {step === 'welcome' ? (
        <StepWelcome key="welcome" onContinue={goNext} userName={userName} />
      ) : null}
      {step === 'identity' ? <StepIdentity key="identity" onBack={goBack} onContinue={goNext} /> : null}
      {step === 'financial' ? <StepFinancial key="financial" onBack={goBack} onContinue={goNext} /> : null}
      {step === 'payments' ? <StepPayments key="payments" onBack={goBack} onContinue={goNext} /> : null}
      {step === 'units' ? <StepUnits key="units" onBack={goBack} onContinue={goNext} /> : null}
      {step === 'done' ? <StepDone key="done" onFinish={finish} /> : null}
    </AnimatePresence>
  );
}
