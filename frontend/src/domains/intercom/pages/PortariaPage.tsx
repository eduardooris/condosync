import { useParams } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Building2,
  Loader2,
  PhoneCall,
  PhoneOff,
  User,
} from 'lucide-react';
import { PortariaUnitCard } from '@/domains/intercom/components/PortariaUnitCard';
import { RemoteResidentPlayback } from '@/domains/intercom/components/RemoteResidentPlayback';
import { VideoPreview } from '@/domains/intercom/components/VideoPreview';
import { usePortaria } from '@/domains/intercom/hooks/usePortaria';
import {
  portariaVisitorSchema,
  type PortariaVisitorForm,
} from '@/domains/intercom/schemas/portaria.schema';
import { Button } from '@/shared/components/ui/Button';
import { FieldError } from '@/shared/components/ui/FieldError';
import { Input } from '@/shared/components/ui/Input';
import { Label } from '@/shared/components/ui/Label';
import { Spinner } from '@/shared/components/ui/Spinner';

export function PortariaPage() {
  const { accessToken = '' } = useParams<{ accessToken: string }>();
  const portaria = usePortaria(accessToken);

  const form = useForm<PortariaVisitorForm>({
    resolver: zodResolver(portariaVisitorSchema),
    defaultValues: { unitId: '', visitorName: '' },
  });

  const selectedUnit = portaria.units.find((u) => u.id === portaria.selectedUnitId);

  if (portaria.unitsLoading) {
    return (
      <PageShell>
        <Spinner size="lg" />
      </PageShell>
    );
  }

  if (portaria.unitsError) {
    return (
      <PageShell>
        <div className="ds-surface-elevated mx-auto max-w-md p-8 text-center">
          <h1 className="text-ds-xl font-bold text-ds-body">Portaria indisponível</h1>
          <p className="mt-3 text-ds-sm text-ds-dim">{portaria.unitsErrorMessage}</p>
        </div>
      </PageShell>
    );
  }

  if (portaria.step === 'ended') {
    return (
      <PageShell>
        <div className="ds-surface-elevated mx-auto max-w-md space-y-6 p-8 text-center">
          <PhoneOff className="mx-auto h-12 w-12 text-ds-dim" />
          <h1 className="text-ds-xl font-bold text-ds-body">
            {portaria.statusLabel || 'Chamada finalizada'}
          </h1>
          <Button onClick={portaria.reset}>Nova chamada</Button>
        </div>
      </PageShell>
    );
  }

  if (portaria.step === 'calling' || portaria.step === 'in_call') {
    return (
      <PageShell>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto w-full max-w-lg space-y-6"
        >
          <header className="text-center">
            <p className="text-ds-sm font-medium text-brand-400">
              {portaria.statusLabel}
            </p>
            <h1 className="mt-1 text-ds-2xl font-bold text-ds-body">
              {form.getValues('visitorName')}
            </h1>
            {selectedUnit ? (
              <p className="mt-1 text-ds-sm text-ds-dim">{selectedUnit.label}</p>
            ) : null}
          </header>

          <VideoPreview stream={portaria.localStream} muted mirror label="Você" />
          <RemoteResidentPlayback stream={portaria.remoteStream} />

          <div className="flex flex-col gap-3">
            {portaria.step === 'calling' ? (
              <Button variant="secondary" onClick={() => void portaria.cancelCall()}>
                <PhoneOff className="h-4 w-4" />
                Cancelar
              </Button>
            ) : (
              <Button variant="danger" onClick={() => void portaria.endCall()}>
                <PhoneOff className="h-4 w-4" />
                Encerrar chamada
              </Button>
            )}
          </div>
        </motion.div>
      </PageShell>
    );
  }

  if (portaria.step === 'preview') {
    return (
      <PageShell>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto w-full max-w-lg space-y-5"
        >
          <header>
            <button
              type="button"
              onClick={portaria.backToUnits}
              className="mb-4 flex items-center gap-1.5 text-ds-sm text-ds-dim transition hover:text-ds-body"
            >
              <ArrowLeft className="h-4 w-4" />
              Escolher outra unidade
            </button>
            <h1 className="text-ds-2xl font-bold text-ds-body">
              {selectedUnit?.label ?? 'Unidade'}
            </h1>
            <p className="mt-1 text-ds-sm text-ds-dim">
              Informe seu nome e confira a câmera antes de chamar.
            </p>
          </header>

          <VideoPreview stream={portaria.localStream} muted mirror label="Você" />

          <form
            className="ds-surface-elevated space-y-4 p-5"
            onSubmit={form.handleSubmit((data) =>
              void portaria.startCall(data.unitId, data.visitorName),
            )}
          >
            <input type="hidden" {...form.register('unitId')} />

            <div>
              <Label htmlFor="portaria-name" className="mb-1.5 flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" />
                Seu nome
              </Label>
              <Input
                id="portaria-name"
                placeholder="Como o morador vai te ver"
                autoFocus
                invalid={Boolean(form.formState.errors.visitorName)}
                {...form.register('visitorName')}
              />
              {form.formState.errors.visitorName ? (
                <FieldError>{form.formState.errors.visitorName.message}</FieldError>
              ) : null}
            </div>

            <Button type="submit" className="w-full" disabled={portaria.isStartingCall}>
              {portaria.isStartingCall ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <PhoneCall className="h-4 w-4" />
              )}
              Chamar morador
            </Button>
          </form>
        </motion.div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto w-full max-w-lg"
      >
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/20 text-brand-400">
            <Building2 className="h-7 w-7" />
          </div>
          <h1 className="text-ds-2xl font-bold tracking-tight text-ds-body">
            Portaria virtual
          </h1>
          <p className="mt-2 text-ds-sm text-ds-dim">
            Toque na unidade que deseja chamar.
          </p>
        </div>

        {portaria.mediaError ? (
          <p className="mb-4 text-center text-ds-sm text-ds-danger">{portaria.mediaError}</p>
        ) : null}

        {portaria.units.length === 0 ? (
          <div className="ds-surface-elevated p-6 text-center">
            <p className="text-ds-sm text-ds-dim">Nenhuma unidade disponível no momento.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {portaria.units.map((unit) => (
              <li key={unit.id}>
                <PortariaUnitCard
                  unit={unit}
                  disabled={portaria.isSelectingUnit}
                  onSelect={(unitId) => {
                    form.setValue('unitId', unitId, { shouldValidate: true });
                    void portaria.selectUnit(unitId);
                  }}
                />
              </li>
            ))}
          </ul>
        )}

        {portaria.isSelectingUnit ? (
          <p className="mt-4 flex items-center justify-center gap-2 text-ds-sm text-ds-dim">
            <Loader2 className="h-4 w-4 animate-spin" />
            Abrindo câmera…
          </p>
        ) : null}
      </motion.div>
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="ds-page relative flex min-h-screen min-w-0 items-center justify-center overflow-hidden bg-ds-deep px-5 py-10">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-brand-400/15 blur-3xl" />
        <div className="absolute -right-32 top-1/3 h-96 w-96 rounded-full bg-brand-500/10 blur-3xl" />
      </div>
      <div className="relative z-10 w-full min-w-0">{children}</div>
    </main>
  );
}
