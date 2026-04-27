import { AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { StepWelcome } from '@/domains/setup/components/StepWelcome';
import { StepIdentity } from '@/domains/setup/components/StepIdentity';
import { StepFinancial } from '@/domains/setup/components/StepFinancial';
import { StepUnits } from '@/domains/setup/components/StepUnits';
import { StepDone } from '@/domains/setup/components/StepDone';
import { nextStep, prevStep, useSetupStore } from '@/domains/setup/store/setup.store';
import { useAuthStore } from '@/shared/stores/auth.store';

export function SetupPage() {
  const navigate = useNavigate();
  const step = useSetupStore((s) => s.step);
  const setStep = useSetupStore((s) => s.setStep);
  const reset = useSetupStore((s) => s.reset);
  const userName = useAuthStore((s) => s.user?.name ?? undefined);

  const goNext = () => setStep(nextStep(step));
  const goBack = () => setStep(prevStep(step));

  const finish = () => {
    reset();
    navigate('/', { replace: true });
  };

  return (
    <AnimatePresence mode="wait">
      {step === 'welcome' ? (
        <StepWelcome key="welcome" onContinue={goNext} userName={userName} />
      ) : null}
      {step === 'identity' ? <StepIdentity key="identity" onBack={goBack} onContinue={goNext} /> : null}
      {step === 'financial' ? <StepFinancial key="financial" onBack={goBack} onContinue={goNext} /> : null}
      {step === 'units' ? <StepUnits key="units" onBack={goBack} onContinue={goNext} /> : null}
      {step === 'done' ? <StepDone key="done" onFinish={finish} /> : null}
    </AnimatePresence>
  );
}
