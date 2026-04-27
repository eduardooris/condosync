import { Info } from 'lucide-react';
import { SectionCard, SectionShell } from '@/domains/condominiums/components/SectionShell';

interface ToggleRow {
  label: string;
  description: string;
  defaultOn?: boolean;
  comingSoon?: boolean;
}

const COMMUNICATION: ToggleRow[] = [
  {
    label: 'Notificar cobranças via WhatsApp',
    description: 'Envia link de pagamento ao responsável financeiro a cada cobrança gerada.',
    defaultOn: true,
  },
  {
    label: 'Lembrete de atraso (5 dias)',
    description: 'Dispara mensagem automática 5 dias após o vencimento (RN-03.5).',
    defaultOn: true,
  },
  {
    label: 'Recados urgentes via WhatsApp',
    description: 'Comunicados marcados como urgentes notificam todos os responsáveis.',
    defaultOn: true,
    comingSoon: true,
  },
];

const POLLS: ToggleRow[] = [
  {
    label: 'Voto anônimo por padrão',
    description: 'Ao criar uma enquete, o anonimato vem ativado (configurável por enquete).',
    defaultOn: true,
  },
  {
    label: 'Bloquear resultado até encerrar',
    description: 'Resultados ficam invisíveis até o encerramento oficial (RN-04.3).',
    defaultOn: true,
  },
];

const OCCURRENCES: ToggleRow[] = [
  {
    label: 'Permitir ocorrências anônimas',
    description: 'Moradores podem abrir ocorrências sem expor a identidade aos demais.',
    defaultOn: true,
  },
  {
    label: 'Notificar autor ao mudar status',
    description: 'Avisa o morador in-app a cada mudança de status (RN-05.2).',
    defaultOn: true,
  },
];

export function CommunicationSection() {
  return (
    <SectionShell
      title="Comunicação"
      description="Como o CondoSync conversa com seus moradores. Mexa aqui antes de gerar a primeira cobrança."
    >
      <ToggleGroup rows={COMMUNICATION} />
    </SectionShell>
  );
}

export function PollsSection() {
  return (
    <SectionShell
      title="Enquetes"
      description="Regras padrão aplicadas a todas as enquetes deste condomínio."
    >
      <ToggleGroup rows={POLLS} />
    </SectionShell>
  );
}

export function OccurrencesSection() {
  return (
    <SectionShell
      title="Ocorrências"
      description="Como reclamações e solicitações dos moradores são tratadas."
    >
      <ToggleGroup rows={OCCURRENCES} />
    </SectionShell>
  );
}

function ToggleGroup({ rows }: { rows: ToggleRow[] }) {
  return (
    <SectionCard>
      <ul className="divide-y divide-ds-stroke-subtle">
        {rows.map((row) => (
          <li key={row.label} className="flex items-start gap-4 py-3.5 first:pt-0 last:pb-0">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-ds-sm font-semibold text-ds-body">{row.label}</p>
                {row.comingSoon ? (
                  <span className="inline-flex items-center gap-1 rounded-ds-pill border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-200">
                    <Info className="h-2.5 w-2.5" aria-hidden /> Em breve
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 text-ds-xs text-ds-dim">{row.description}</p>
            </div>
            <ToggleSwitch defaultOn={row.defaultOn} disabled={row.comingSoon} />
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

function ToggleSwitch({ defaultOn, disabled }: { defaultOn?: boolean; disabled?: boolean }) {
  return (
    <label className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition ${disabled ? 'opacity-40' : ''}`}>
      <input type="checkbox" defaultChecked={defaultOn} disabled={disabled} className="peer sr-only" />
      <span className="absolute inset-0 rounded-full border border-ds-stroke bg-white/[0.06] transition peer-checked:border-brand-400/40 peer-checked:bg-gradient-to-r peer-checked:from-brand-300 peer-checked:to-brand-500" />
      <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-md transition peer-checked:left-[1.375rem]" />
    </label>
  );
}
