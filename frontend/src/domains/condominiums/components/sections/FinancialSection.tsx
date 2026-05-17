import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Button } from '@/shared/components/ui/Button';
import { DayOfMonthGrid } from '@/shared/components/ui/DayOfMonthGrid';
import { FormField } from '@/shared/components/ui/FormField';
import { Input } from '@/shared/components/ui/Input';
import { NativeSelect } from '@/shared/components/ui/NativeSelect';
import { SectionCard, SectionShell } from '@/domains/condominiums/components/SectionShell';
import {
  condominiumsService,
  type PixKeyType,
} from '@/domains/condominiums/services/condominiums.service';
import type { Condominium } from '@/shared/types/api';
import { queryKeys } from '@/shared/lib/queryKeys';

interface FinancialSectionProps {
  condominium: Condominium;
}

const PIX_TYPES: Array<{ value: PixKeyType; label: string }> = [
  { value: 'CPF', label: 'CPF' },
  { value: 'CNPJ', label: 'CNPJ' },
  { value: 'EMAIL', label: 'E-mail' },
  { value: 'PHONE', label: 'Telefone' },
  { value: 'EVP', label: 'Chave aleatória' },
];

function formatBrl(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

export function FinancialSection({ condominium }: FinancialSectionProps) {
  const queryClient = useQueryClient();
  const initialFee = Number(condominium.monthlyFeeAmount ?? 0);
  const [feeText, setFeeText] = useState(initialFee ? String(initialFee).replace('.', ',') : '');
  const [genDay, setGenDay] = useState(condominium.billingGenerationDay ?? 1);
  const [dueDay, setDueDay] = useState(condominium.billingDueDay ?? 10);
  const condoWithPix = condominium as Condominium & {
    pixKeyType?: PixKeyType | null;
    pixKeyValue?: string | null;
  };
  const [pixKeyType, setPixKeyType] = useState<PixKeyType>(
    condoWithPix.pixKeyType ?? 'EVP',
  );
  const [pixKeyValue, setPixKeyValue] = useState(condoWithPix.pixKeyValue ?? '');
  const [adminContactPhone, setAdminContactPhone] = useState(
    (condominium as Condominium & { adminContactPhone?: string | null }).adminContactPhone ?? '',
  );

  const feeNumber = Number(feeText.replace(/\./g, '').replace(',', '.'));
  const feeValid = !Number.isNaN(feeNumber) && feeNumber >= 0;
  const pixKeyValid = pixKeyValue.trim().length > 0;
  const adminPhoneDigits = onlyDigits(adminContactPhone);
  const adminPhoneValid =
    adminPhoneDigits.length === 0 ||
    adminPhoneDigits.length === 10 ||
    adminPhoneDigits.length === 11;

  const mutation = useMutation({
    mutationFn: () =>
      condominiumsService.update(condominium.id, {
        monthlyFeeAmount: feeNumber,
        billingGenerationDay: genDay,
        billingDueDay: dueDay,
        pixKeyType,
        pixKeyValue: pixKeyValue.trim(),
        adminContactPhone: adminPhoneDigits || undefined,
      }),
    onSuccess: () => {
      toast.success('Configurações financeiras salvas.');
      queryClient.invalidateQueries({ queryKey: queryKeys.condominium.detail(condominium.id) });
    },
    onError: () => toast.error('Não foi possível salvar.'),
  });

  return (
    <SectionShell
      title="Financeiro"
      description="Define como as cobranças mensais são geradas e quando ficam atrasadas."
    >
      <SectionCard title="Taxa mensal" description="Valor cobrado de cada unidade ocupada todo mês.">
        <FormField label="Valor (R$)" htmlFor="fin-fee" required>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-ds-sm font-semibold text-ds-subtle">
              R$
            </span>
            <Input
              id="fin-fee"
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
            Cada unidade ocupada receberá <span className="font-semibold text-ds-body">{formatBrl(feeNumber)}</span> por mês.
          </p>
        ) : null}
      </SectionCard>

      <SectionCard
        title="Chave Pix para cobranças"
        description="Usada nas mensagens automáticas de cobrança enviadas no WhatsApp."
      >
        <div className="grid gap-3 ds-md:grid-cols-[12rem_1fr]">
          <FormField label="Tipo da chave" htmlFor="fin-pix-type" required>
            <NativeSelect
              id="fin-pix-type"
              value={pixKeyType}
              onChange={(e) => setPixKeyType(e.target.value as PixKeyType)}
            >
              {PIX_TYPES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label="Valor da chave" htmlFor="fin-pix-value" required>
            <Input
              id="fin-pix-value"
              value={pixKeyValue}
              onChange={(e) => setPixKeyValue(e.target.value)}
              placeholder="Informe a chave Pix do condomínio"
            />
          </FormField>
        </div>
        <div className="mt-3">
          <FormField
            label="Telefone da administração"
            htmlFor="fin-admin-phone"
            hint="DDD + número. Será enviado no WhatsApp para dúvidas dos moradores."
          >
            <Input
              id="fin-admin-phone"
              value={adminContactPhone}
              onChange={(e) => setAdminContactPhone(e.target.value)}
              inputMode="numeric"
              placeholder="85991712228"
              invalid={!adminPhoneValid}
            />
          </FormField>
        </div>
      </SectionCard>

      <div className="grid gap-4 ds-md:grid-cols-2">
        <DayCard
          title="Dia de geração"
          hint="Quando o sistema cria as cobranças do mês."
          value={genDay}
          onChange={setGenDay}
        />
        <DayCard
          title="Dia de vencimento"
          hint="Após 5 dias sem pagamento → atrasada (RN-03.5)."
          value={dueDay}
          onChange={setDueDay}
          min={genDay}
        />
      </div>

      <div className="flex justify-end">
        <Button
          onClick={() => mutation.mutate()}
          disabled={!feeValid || !pixKeyValid || !adminPhoneValid || mutation.isPending}
        >
          {mutation.isPending ? 'Salvando…' : 'Salvar alterações'}
        </Button>
      </div>
    </SectionShell>
  );
}

function DayCard({
  title,
  hint,
  value,
  onChange,
  min = 1,
}: {
  title: string;
  hint: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
}) {
  return (
    <SectionCard title={title} description={hint}>
      <DayOfMonthGrid value={value} onChange={onChange} min={min} />
    </SectionCard>
  );
}
