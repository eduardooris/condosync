import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Check, Copy, ShieldCheck, UserPlus } from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/Dialog';
import { FormField } from '@/shared/components/ui/FormField';
import { Input } from '@/shared/components/ui/Input';
import { invitationsService, type CreateInvitationInput } from '@/domains/invitations/services/invitations.service';
import { queryKeys } from '@/shared/lib/queryKeys';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  condominiumId: string;
}

export function GenerateResidentInviteDialog({ open, onOpenChange, condominiumId }: Props) {
  const queryClient = useQueryClient();
  const [expiresInHours, setExpiresInHours] = useState(72);
  const [maxUses, setMaxUses] = useState(20);
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const reset = () => {
    setExpiresInHours(72);
    setMaxUses(20);
    setCreatedUrl(null);
    setCopied(false);
  };

  const create = useMutation({
    mutationFn: () => {
      const payload: CreateInvitationInput = {
        type: 'GENERIC_LINK',
        role: 'RESIDENT',
        expiresInHours,
        maxUses,
      };
      return invitationsService.create(condominiumId, payload);
    },
    onSuccess: (inv) => {
      toast.success('Link de cadastro gerado.');
      setCreatedUrl(inv.url ?? null);
      queryClient.invalidateQueries({ queryKey: queryKeys.invitations.list(condominiumId) });
    },
    onError: () => toast.error('Não foi possível gerar o link.'),
  });

  const copy = async () => {
    if (!createdUrl) return;
    try {
      await navigator.clipboard.writeText(createdUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error('Não foi possível copiar.');
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Link de cadastro de moradores</DialogTitle>
          <DialogDescription>
            {createdUrl
              ? 'Link válido criado. Compartilhe com os moradores — você aprova cada cadastro depois.'
              : 'Gera um link único que pode ser usado por vários moradores. Após o cadastro, cada pessoa aguarda aprovação da síndica/síndico.'}
          </DialogDescription>
        </DialogHeader>

        {createdUrl ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-ds-lg border border-emerald-400/20 bg-emerald-400/[0.06] p-3">
              <ShieldCheck className="h-4 w-4 text-emerald-300" aria-hidden />
              <p className="text-ds-sm text-emerald-200">
                Esta URL aparece apenas uma vez. Copie agora.
              </p>
            </div>
            <div className="flex items-stretch gap-2">
              <Input
                readOnly
                value={createdUrl}
                onFocus={(e) => e.currentTarget.select()}
              />
              <Button variant="secondary" onClick={copy}>
                {copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
                {copied ? 'Copiado' : 'Copiar'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 ds-md:grid-cols-2">
              <FormField label="Validade (horas)" htmlFor="resident-invite-exp">
                <Input
                  id="resident-invite-exp"
                  type="number"
                  min={1}
                  max={720}
                  value={expiresInHours}
                  onChange={(e) => setExpiresInHours(Math.max(1, Number(e.target.value) || 1))}
                />
              </FormField>
              <FormField label="Máximo de usos" htmlFor="resident-invite-uses">
                <Input
                  id="resident-invite-uses"
                  type="number"
                  min={1}
                  max={500}
                  value={maxUses}
                  onChange={(e) => setMaxUses(Math.max(1, Number(e.target.value) || 1))}
                />
              </FormField>
            </div>
            <p className="flex items-start gap-1.5 text-ds-xs text-ds-dim">
              <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0 text-emerald-300" aria-hidden />
              Cada cadastro feito pelo link precisa ser aprovado em <strong className="text-ds-body">Configurações → Equipe e convites</strong>.
            </p>
          </div>
        )}

        <DialogFooter>
          {createdUrl ? (
            <Button variant="gradient" onClick={() => onOpenChange(false)}>
              Pronto
            </Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button variant="gradient" disabled={create.isPending} onClick={() => create.mutate()}>
                <UserPlus className="h-3.5 w-3.5" aria-hidden />
                {create.isPending ? 'Gerando…' : 'Gerar link'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
