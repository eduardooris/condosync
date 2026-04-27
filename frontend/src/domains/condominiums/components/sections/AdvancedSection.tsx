import { AlertTriangle, Archive } from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import { SectionShell } from '@/domains/condominiums/components/SectionShell';
import type { Condominium } from '@/shared/types/api';

interface AdvancedSectionProps {
  condominium: Condominium;
}

export function AdvancedSection({ condominium }: AdvancedSectionProps) {
  return (
    <SectionShell
      title="Avançado"
      description="Operações irreversíveis. Use com calma."
    >
      <div className="rounded-ds-2xl border border-ds-danger/20 bg-ds-danger/[0.04] p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-ds-lg bg-ds-danger/15 text-ds-danger">
            <Archive className="h-4 w-4" strokeWidth={2} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-ds-md font-semibold text-ds-body">Arquivar condomínio</h3>
            <p className="mt-1 text-ds-sm text-ds-dim">
              {condominium.name} ficará oculto da lista. Cobranças e dados históricos são preservados.
              Não é possível arquivar enquanto houver saldo pendente (RN-01.3).
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Button variant="danger" disabled>
                Arquivar condomínio
              </Button>
              <span className="inline-flex items-center gap-1.5 text-ds-xs text-ds-subtle">
                <AlertTriangle className="h-3 w-3" aria-hidden />
                Disponível em breve
              </span>
            </div>
          </div>
        </div>
      </div>
    </SectionShell>
  );
}
