import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import toast from 'react-hot-toast';
import { Copy, DoorOpen, History, Link2, Loader2, Trash2 } from 'lucide-react';
import { useIntercomAdmin } from '@/domains/intercom/hooks/useIntercomAdmin';
import { Button } from '@/shared/components/ui/Button';
import { GlassCard } from '@/shared/components/ui/GlassCard';
import { Input } from '@/shared/components/ui/Input';
import { Label } from '@/shared/components/ui/Label';
import { Spinner } from '@/shared/components/ui/Spinner';
import { Badge } from '@/shared/components/ui/Badge';
import type { IntercomSessionStatus } from '@/shared/types/intercom';

const STATUS_LABEL: Record<IntercomSessionStatus, string> = {
  INITIATED: 'Iniciada',
  RINGING: 'Chamando',
  PREVIEW: 'Preview',
  ANSWERED: 'Atendida',
  ENDED: 'Encerrada',
  MISSED: 'Não atendida',
  CANCELED_BY_VISITOR: 'Cancelada',
  REJECTED: 'Recusada',
  FAILED: 'Falha',
};

type Props = {
  condominiumId: string;
};

export function IntercomAdminPanel({ condominiumId }: Props) {
  const [label, setLabel] = useState('');
  const {
    tokens,
    sessions,
    isLoading,
    createTokenMutation,
    revokeTokenMutation,
    lastCreated,
  } = useIntercomAdmin(condominiumId);

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copiado.');
    } catch {
      toast.error('Não foi possível copiar.');
    }
  };

  if (isLoading) return <Spinner />;

  return (
    <div className="space-y-6">
      <GlassCard className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/15 text-brand-400">
            <DoorOpen className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-ds-base font-semibold text-ds-body">Portaria virtual</h3>
            <p className="mt-1 text-ds-sm text-ds-dim">
              Gere o QR da entrada. Visitantes escolhem a unidade e chamam pelo vídeo.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="intercom-label">Rótulo (opcional)</Label>
          <Input
            id="intercom-label"
            placeholder="Ex.: Portaria principal"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>

        <Button
          onClick={() => createTokenMutation.mutate(label.trim() || undefined)}
          disabled={createTokenMutation.isPending}
        >
          {createTokenMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Link2 className="h-4 w-4" />
          )}
          Gerar novo link / QR
        </Button>

        {lastCreated ? (
          <div className="rounded-xl border border-ds-border bg-ds-surface/50 p-4 space-y-4">
            <p className="text-ds-xs font-medium text-ds-warning">
              Salve o link agora — o token completo não será exibido novamente.
            </p>
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
              <QRCodeSVG value={lastCreated.portariaUrl} size={160} level="M" />
              <div className="min-w-0 flex-1 space-y-2">
                <p className="break-all text-ds-sm text-ds-body">{lastCreated.portariaUrl}</p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void copyText(lastCreated.portariaUrl)}
                >
                  <Copy className="h-4 w-4" />
                  Copiar link
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {tokens.length > 0 ? (
          <ul className="space-y-2 border-t border-ds-border pt-4">
            {tokens.map((t) => (
              <li
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-2 text-ds-sm"
              >
                <span className="text-ds-dim">
                  {t.label ?? 'Portaria'} ·{' '}
                  {new Date(t.createdAt).toLocaleString('pt-BR')}
                  {t.revokedAt ? (
                    <Badge label="Revogado" tone="neutral" className="ml-2" />
                  ) : (
                    <Badge label="Ativo" tone="success" className="ml-2" />
                  )}
                </span>
                {!t.revokedAt ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => revokeTokenMutation.mutate(t.id)}
                    disabled={revokeTokenMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                    Revogar
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </GlassCard>

      <GlassCard className="space-y-3">
        <div className="flex items-center gap-2 text-ds-body">
          <History className="h-5 w-5 text-ds-dim" />
          <h3 className="font-semibold">Histórico de chamadas</h3>
        </div>
        {sessions.length === 0 ? (
          <p className="text-ds-sm text-ds-dim">Nenhuma chamada registrada ainda.</p>
        ) : (
          <ul className="divide-y divide-ds-border">
            {sessions.map((s) => (
              <li key={s.id} className="py-3 text-ds-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-ds-body">{s.visitorName}</span>
                  <Badge
                    label={STATUS_LABEL[s.status] ?? s.status}
                    tone={s.status === 'ANSWERED' ? 'success' : 'warning'}
                  />
                </div>
                <p className="mt-1 text-ds-dim">
                  {s.unitLabel} · {new Date(s.createdAt).toLocaleString('pt-BR')}
                  {s.answeredByName ? ` · Atendido por ${s.answeredByName}` : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </GlassCard>
    </div>
  );
}
