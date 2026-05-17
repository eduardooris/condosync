import { QRCodeSVG } from 'qrcode.react';
import toast from 'react-hot-toast';
import { Copy, ExternalLink, Loader2, Trash2 } from 'lucide-react';
import { useIntercomTokenDetail } from '@/domains/intercom/hooks/useIntercomTokenDetail';
import { Button } from '@/shared/components/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/Dialog';
import { Spinner } from '@/shared/components/ui/Spinner';
import { Badge } from '@/shared/components/ui/Badge';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  condominiumId: string;
  tokenId: string | null;
  initialPortariaUrl?: string | null;
  initialRevoked?: boolean;
  onRevoke?: (tokenId: string) => void;
  isRevoking?: boolean;
};

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success('Copiado.');
  } catch {
    toast.error('Não foi possível copiar.');
  }
}

export function IntercomTokenDetailDialog({
  open,
  onOpenChange,
  condominiumId,
  tokenId,
  initialPortariaUrl,
  initialRevoked,
  onRevoke,
  isRevoking,
}: Props) {
  const shouldFetch = open && Boolean(tokenId) && initialPortariaUrl === undefined;
  const detailQuery = useIntercomTokenDetail(condominiumId, tokenId, shouldFetch);

  const detail = detailQuery.data;
  const portariaUrl =
    initialPortariaUrl !== undefined ? initialPortariaUrl : (detail?.portariaUrl ?? null);
  const label = detail?.label;
  const isRevoked = initialRevoked ?? Boolean(detail?.revokedAt);
  const isLoading = shouldFetch && detailQuery.isLoading;

  const title = label?.trim() ? label : 'Portaria virtual';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {title}
            {isRevoked ? <Badge label="Revogado" tone="neutral" /> : <Badge label="Ativo" tone="success" />}
          </DialogTitle>
          <DialogDescription>
            Compartilhe o QR ou o link na entrada do condomínio. Visitantes escolhem a unidade e chamam pelo vídeo.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : portariaUrl ? (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-4 rounded-xl border border-ds-border bg-ds-surface/50 p-4 sm:flex-row sm:items-start">
              <QRCodeSVG value={portariaUrl} size={180} level="M" className="rounded-lg bg-white p-2" />
              <div className="min-w-0 flex-1 space-y-3">
                <p className="break-all text-ds-sm text-ds-body">{portariaUrl}</p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" size="sm" onClick={() => void copyText(portariaUrl)}>
                    <Copy className="h-4 w-4" />
                    Copiar link
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.open(portariaUrl, '_blank', 'noopener,noreferrer')}
                  >
                    <ExternalLink className="h-4 w-4" />
                    Abrir
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <p className="rounded-xl border border-ds-border bg-ds-surface/40 px-4 py-3 text-ds-sm text-ds-dim">
            {isRevoked
              ? 'Este link foi revogado e não pode mais ser usado.'
              : 'Link indisponível para este token (gerado antes da atualização). Revogue e gere um novo QR para obter um link consultável.'}
          </p>
        )}

        <DialogFooter className="flex-wrap sm:justify-between">
          {!isRevoked && tokenId && onRevoke ? (
            <Button
              variant="ghost"
              size="sm"
              className="text-ds-danger"
              onClick={() => onRevoke(tokenId)}
              disabled={isRevoking}
            >
              {isRevoking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Revogar link
            </Button>
          ) : (
            <span />
          )}
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
