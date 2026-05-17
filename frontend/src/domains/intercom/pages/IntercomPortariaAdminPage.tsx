import { useState } from 'react';
import { DoorOpen, History, Link2, Loader2, QrCode } from 'lucide-react';
import { useAuthStore } from '@/shared/stores/auth.store';
import { useIntercomAdmin } from '@/domains/intercom/hooks/useIntercomAdmin';
import { IntercomTokenDetailDialog } from '@/domains/intercom/components/IntercomTokenDetailDialog';
import { PageHeader } from '@/shared/components/ui/PageHeader';
import { Button } from '@/shared/components/ui/Button';
import { GlassCard } from '@/shared/components/ui/GlassCard';
import { Input } from '@/shared/components/ui/Input';
import { Label } from '@/shared/components/ui/Label';
import { Spinner } from '@/shared/components/ui/Spinner';
import { Badge } from '@/shared/components/ui/Badge';
import { cn } from '@/shared/utils/cn';
import type { IntercomAccessTokenCreated, IntercomSessionStatus } from '@/shared/types/intercom';

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

type AdminTab = 'tokens' | 'history';

export function IntercomPortariaAdminPage() {
  const condo = useAuthStore((s) => s.activeCondominium);
  const condominiumId = condo?.id;
  const [tab, setTab] = useState<AdminTab>('tokens');
  const [label, setLabel] = useState('');
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);
  const [initialPortariaUrl, setInitialPortariaUrl] = useState<string | null | undefined>(
    undefined,
  );
  const [initialRevoked, setInitialRevoked] = useState<boolean | undefined>(undefined);

  const {
    tokens,
    sessions,
    isLoading,
    createTokenMutation,
    revokeTokenMutation,
  } = useIntercomAdmin(condominiumId);

  const openTokenDetail = (
    tokenId: string,
    opts?: { portariaUrl?: string | null; revoked?: boolean },
  ) => {
    setSelectedTokenId(tokenId);
    setInitialPortariaUrl(opts?.portariaUrl);
    setInitialRevoked(opts?.revoked);
    setDetailOpen(true);
  };

  const handleDetailOpenChange = (open: boolean) => {
    setDetailOpen(open);
    if (!open) {
      setSelectedTokenId(null);
      setInitialPortariaUrl(undefined);
      setInitialRevoked(undefined);
    }
  };

  const handleCreate = () => {
    createTokenMutation.mutate(label.trim() || undefined, {
      onSuccess: (created: IntercomAccessTokenCreated) => {
        setLabel('');
        openTokenDetail(created.id, { portariaUrl: created.portariaUrl });
      },
    });
  };

  const handleRevoke = (tokenId: string) => {
    revokeTokenMutation.mutate(tokenId, {
      onSuccess: () => handleDetailOpenChange(false),
    });
  };

  if (!condominiumId) {
    return (
      <p className="text-ds-sm text-ds-dim">Selecione um condomínio para gerenciar a portaria.</p>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Portaria virtual"
        description="QR codes de entrada e histórico de chamadas dos visitantes."
      />

      <div
        className="inline-flex rounded-ds-lg border border-ds-border bg-ds-surface/60 p-1"
        role="tablist"
        aria-label="Seções da portaria"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'tokens'}
          className={cn(
            'inline-flex items-center gap-2 rounded-ds-md px-3 py-2 text-ds-sm font-medium transition',
            tab === 'tokens'
              ? 'bg-brand-500/15 text-brand-700 dark:text-brand-200'
              : 'text-ds-dim hover:text-ds-body',
          )}
          onClick={() => setTab('tokens')}
        >
          <QrCode className="h-4 w-4" />
          Links & QR
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'history'}
          className={cn(
            'inline-flex items-center gap-2 rounded-ds-md px-3 py-2 text-ds-sm font-medium transition',
            tab === 'history'
              ? 'bg-brand-500/15 text-brand-700 dark:text-brand-200'
              : 'text-ds-dim hover:text-ds-body',
          )}
          onClick={() => setTab('history')}
        >
          <History className="h-4 w-4" />
          Histórico
        </button>
      </div>

      {isLoading ? (
        <Spinner />
      ) : tab === 'tokens' ? (
        <GlassCard className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/15 text-brand-400">
              <DoorOpen className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-ds-base font-semibold text-ds-body">Links da entrada</h2>
              <p className="mt-1 text-ds-sm text-ds-dim">
                Gere um QR para a portaria. Clique em um link ativo para ver o QR e copiar a URL
                novamente.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="portaria-label">Rótulo (opcional)</Label>
            <Input
              id="portaria-label"
              placeholder="Ex.: Portaria principal"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>

          <Button onClick={handleCreate} disabled={createTokenMutation.isPending}>
            {createTokenMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Link2 className="h-4 w-4" />
            )}
            Gerar novo link / QR
          </Button>

          {tokens.length === 0 ? (
            <p className="border-t border-ds-border pt-4 text-ds-sm text-ds-dim">
              Nenhum link gerado ainda.
            </p>
          ) : (
            <ul className="space-y-2 border-t border-ds-border pt-4">
              {tokens.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    className={cn(
                      'flex w-full flex-wrap items-center justify-between gap-2 rounded-xl border border-ds-border px-3 py-3 text-left text-ds-sm transition',
                      'hover:border-brand-400/40 hover:bg-ds-surface/80',
                    )}
                    onClick={() => openTokenDetail(t.id, { revoked: Boolean(t.revokedAt) })}
                  >
                    <span className="min-w-0">
                      <span className="font-medium text-ds-body">{t.label ?? 'Portaria'}</span>
                      <span className="mt-0.5 block text-ds-dim">
                        {new Date(t.createdAt).toLocaleString('pt-BR')}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      {t.revokedAt ? (
                        <Badge label="Revogado" tone="neutral" />
                      ) : (
                        <Badge label="Ativo" tone="success" />
                      )}
                      {!t.revokedAt && t.canRevealLink ? (
                        <span className="text-ds-xs text-brand-600 dark:text-brand-300">
                          Ver QR / link
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </GlassCard>
      ) : (
        <GlassCard className="space-y-3">
          <div className="flex items-center gap-2 text-ds-body">
            <History className="h-5 w-5 text-ds-dim" />
            <h2 className="font-semibold">Histórico de chamadas</h2>
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
      )}

      <IntercomTokenDetailDialog
        open={detailOpen}
        onOpenChange={handleDetailOpenChange}
        condominiumId={condominiumId}
        tokenId={selectedTokenId}
        initialPortariaUrl={initialPortariaUrl}
        initialRevoked={initialRevoked}
        onRevoke={handleRevoke}
        isRevoking={revokeTokenMutation.isPending}
      />
    </div>
  );
}
