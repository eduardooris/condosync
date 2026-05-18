import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { CalendarDays, Coins, Send } from 'lucide-react';
import { FormField } from '@/shared/components/ui/FormField';
import { Input } from '@/shared/components/ui/Input';
import { NativeSelect } from '@/shared/components/ui/NativeSelect';
import { SetupShell } from '@/domains/setup/components/SetupShell';
import { useSetupStore } from '@/domains/setup/store/setup.store';
import { condominiumsService } from '@/domains/condominiums/services/condominiums.service';
import { DayOfMonthGrid } from '@/shared/components/ui/DayOfMonthGrid';
import { queryKeys } from '@/shared/lib/queryKeys';

interface StepFinancialProps {
  onBack: () => void;
  onContinue: () => void;
}

function formatBrl(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

const PIX_TYPES: Array<{
  value: 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'EVP';
  label: string;
}> = [
  { value: 'CPF', label: 'CPF' },
  { value: 'CNPJ', label: 'CNPJ' },
  { value: 'EMAIL', label: 'E-mail' },
  { value: 'PHONE', label: 'Telefone' },
  { value: 'EVP', label: 'Chave aleatória' },
];

export function StepFinancial({ onBack, onContinue }: StepFinancialProps) {
  const queryClient = useQueryClient();
  const condominiumId = useSetupStore((s) => s.condominiumId);
  const financial = useSetupStore((s) => s.financial);
  const patchFinancial = useSetupStore((s) => s.patchFinancial);

  const [feeText, setFeeText] = useState(() =>
    financial.monthlyFeeAmount ? String(financial.monthlyFeeAmount).replace('.', ',') : '',
  );
  const [genDay, setGenDayState] = useState(financial.billingGenerationDay);
  const [dueDay, setDueDay] = useState(financial.billingDueDay);
  const [pixKeyType, setPixKeyType] = useState(financial.pixKeyType);
  const [pixKeyValue, setPixKeyValue] = useState(financial.pixKeyValue);

  function setGenDay(day: number) {
    setGenDayState(day);
    if (day > dueDay) setDueDay(day);
  }

  const feeNumber = Number(feeText.replace(/\./g, '').replace(',', '.'));
  const feeValid = !Number.isNaN(feeNumber) && feeNumber >= 0;
  const pixKeyValid = pixKeyValue?.trim().length > 0;

  const mutation = useMutation({
    mutationFn: async () => {
      if (!condominiumId) throw new Error('missing condominium');
      patchFinancial({
        monthlyFeeAmount: feeNumber,
        billingGenerationDay: genDay,
        billingDueDay: dueDay,
        pixKeyType,
        pixKeyValue: pixKeyValue?.trim(),
      });
      return condominiumsService.update(condominiumId, {
        monthlyFeeAmount: feeNumber,
        billingGenerationDay: genDay,
        billingDueDay: dueDay,
        pixKeyType,
        pixKeyValue: pixKeyValue?.trim(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.condominium.detail(condominiumId) });
      onContinue();
    },
    onError: () => {
      toast.error('Não foi possível salvar as configurações financeiras.');
    },
  });

  return (
    <SetupShell
      step="financial"
      eyebrow="Passo 2 de 5"
      title="Como funcionará a cobrança mensal?"
      description="Você pode mudar isso depois em Configurações. Esses valores são aplicados a todas as unidades ocupadas."
      onBack={onBack}
      onPrimary={() => mutation.mutate()}
      primaryLoading={mutation.isPending}
      primaryDisabled={!feeValid || !pixKeyValid}
      secondaryLabel="Pular por enquanto"
      onSecondary={onContinue}
    >
      <div className="space-y-5">
        {/* Fee */}
        <div className="rounded-ds-2xl border border-ds-stroke-subtle bg-ds-surface p-5 dark:bg-white/[0.02]">
          <div className="mb-3 flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-ds-lg bg-gradient-to-br from-emerald-400/20 to-emerald-600/10 ring-1 ring-emerald-400/30">
              <Coins className="h-4 w-4 text-emerald-300" strokeWidth={2} aria-hidden />
            </span>
            <h2 className="text-ds-md font-semibold text-ds-body">Taxa mensal por unidade</h2>
          </div>
          <FormField label="Valor (R$)" htmlFor="setup-fee" required>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-ds-sm font-semibold text-ds-subtle">
                R$
              </span>
              <Input
                id="setup-fee"
                value={feeText}
                onChange={(e) => setFeeText(e.target.value)}
                placeholder="180,00"
                inputMode="decimal"
                className="pl-10 text-lg font-semibold"
              />
            </div>
          </FormField>
          {feeValid && feeNumber > 0 ? (
            <p className="mt-2 text-ds-xs text-ds-dim">
              Cada unidade ocupada receberá uma cobrança de{' '}
              <span className="font-semibold text-ds-body">{formatBrl(feeNumber)}</span> por mês.
            </p>
          ) : null}
        </div>

        {/* Days */}
        <div className="grid gap-4 ds-md:grid-cols-2">
          <DayPicker
            icon={<Send className="h-4 w-4 text-brand-700 dark:text-brand-300" strokeWidth={2} aria-hidden />}
            label="Dia de geração"
            hint="Quando o sistema gera a cobrança do mês."
            value={genDay}
            onChange={setGenDay}
          />
          <DayPicker
            icon={<CalendarDays className="h-4 w-4 text-brand-700 dark:text-brand-300" strokeWidth={2} aria-hidden />}
            label="Dia de vencimento"
            hint="Após 5 dias sem pagamento → atrasada (RN-03.5)."
            value={dueDay}
            onChange={setDueDay}
            min={genDay}
          />
        </div>

        <div className="rounded-ds-2xl border border-ds-stroke-subtle bg-ds-surface p-5 dark:bg-white/[0.02]">
          <div className="mb-3 flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-ds-lg bg-gradient-to-br from-brand-300/30 to-brand-600/10 ring-1 ring-brand-400/30">
              <Send className="h-4 w-4 text-brand-700 dark:text-brand-300" strokeWidth={2} aria-hidden />
            </span>
            <h2 className="text-ds-sm font-semibold text-ds-body">
              Chave Pix do condomínio
            </h2>
          </div>
          <div className="grid gap-3 ds-md:grid-cols-[12rem_1fr]">
            <FormField label="Tipo da chave" htmlFor="setup-pix-type" required>
              <NativeSelect
                id="setup-pix-type"
                value={pixKeyType}
                onChange={(e) =>
                  setPixKeyType(
                    e.target.value as 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'EVP',
                  )
                }
              >
                {PIX_TYPES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField label="Valor da chave" htmlFor="setup-pix-value" required>
              <Input
                id="setup-pix-value"
                value={pixKeyValue}
                onChange={(e) => setPixKeyValue(e.target.value)}
                placeholder="Informe a chave Pix do condomínio"
              />
            </FormField>
          </div>
        </div>
      </div>
    </SetupShell>
  );
}

function DayPicker({
  icon,
  label,
  hint,
  value,
  onChange,
  min = 1,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
}) {
  return (
    <div className="rounded-ds-2xl border border-ds-stroke-subtle bg-ds-surface p-5 dark:bg-white/[0.02]">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-ds-lg bg-gradient-to-br from-brand-300/30 to-brand-600/10 ring-1 ring-brand-400/30">
          {icon}
        </span>
        <h2 className="text-ds-sm font-semibold text-ds-body">{label}</h2>
      </div>
      <DayOfMonthGrid value={value} onChange={onChange} min={min} />
      <p className="mt-3 text-ds-xs text-ds-subtle">{hint}</p>
    </div>
  );
}
