import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Check,
  Copy,
  Mail,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
  UserX,
  X,
} from 'lucide-react';
import { queryKeys } from '@/shared/lib/queryKeys';
import { Button } from '@/shared/components/ui/Button';
import { FormField } from '@/shared/components/ui/FormField';
import { Input } from '@/shared/components/ui/Input';
import { NativeSelect } from '@/shared/components/ui/NativeSelect';
import { Spinner } from '@/shared/components/ui/Spinner';
import { cn } from '@/shared/utils/cn';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/Dialog';
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog';
import { SectionCard, SectionShell } from '@/domains/condominiums/components/SectionShell';
import {
  membersService,
  type ApproveMemberInput,
  type Member,
} from '@/domains/condominiums/services/members.service';
import {
  invitationsService,
  type CreateInvitationInput,
  type Invitation,
} from '@/domains/invitations/services/invitations.service';
import { unitsService } from '@/domains/units/services/units.service';
import type { UserRole } from '@/shared/types/auth.types';

interface TeamSectionProps {
  condominiumId: string;
}

const ROLE_LABELS: Record<UserRole, { label: string; description: string }> = {
  ADMIN: {
    label: 'Síndico',
    description: 'Controle total sobre o condomínio.',
  },
  SUB_ADMIN: {
    label: 'Subsíndico',
    description: 'Auxiliar do síndico, com acesso parcial configurável.',
  },
  RESPONSIBLE: {
    label: 'Responsável financeiro',
    description: 'Acesso financeiro de uma unidade.',
  },
  RESIDENT: {
    label: 'Morador',
    description: 'Acesso de leitura ao mural, documentos e extrato.',
  },
};

const PENDING_APPROVAL_ROLES: UserRole[] = ['RESPONSIBLE', 'RESIDENT'];

type PillTone = 'amber' | 'emerald' | 'sky' | 'slate';
const PILL_TONE: Record<PillTone, string> = {
  amber: 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/25',
  emerald: 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/25',
  sky: 'bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/25',
  slate: 'bg-slate-500/15 text-slate-300 ring-1 ring-slate-500/20',
};

function Pill({ tone, children }: { tone: PillTone; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-ds-pill px-2.5 py-1 text-[11px] font-semibold',
        PILL_TONE[tone],
      )}
    >
      {children}
    </span>
  );
}

export function TeamSection({ condominiumId }: TeamSectionProps) {
  const [inviteOpen, setInviteOpen] = useState(false);

  return (
    <SectionShell
      title="Equipe"
      description="Convide subsíndicos por e-mail e aprove solicitações de autocadastro de moradores."
      actions={
        <Button variant="gradient" onClick={() => setInviteOpen(true)}>
          <UserPlus className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
          Novo convite
        </Button>
      }
    >
      <PendingMembersCard condominiumId={condominiumId} />
      <ApprovedMembersCard condominiumId={condominiumId} />
      <InvitationsCard condominiumId={condominiumId} />

      <CreateInvitationDialog
        condominiumId={condominiumId}
        open={inviteOpen}
        onOpenChange={setInviteOpen}
      />
    </SectionShell>
  );
}

// ============================================================================
// Pending members
// ============================================================================

function PendingMembersCard({ condominiumId }: { condominiumId: string }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.members.pending(condominiumId),
    queryFn: () => membersService.listPending(condominiumId),
  });

  if (isLoading) {
    return (
      <SectionCard title="Aguardando aprovação">
        <Spinner />
      </SectionCard>
    );
  }
  if (!data || data.length === 0) return null;

  return (
    <SectionCard
      title="Aguardando aprovação"
      description="Pessoas que aceitaram um convite genérico e ainda precisam ser revisadas por você."
    >
      <ul className="space-y-2">
        {data.map((m) => (
          <PendingRow
            key={m.membershipId}
            member={m}
            condominiumId={condominiumId}
            onChanged={() => {
              qc.invalidateQueries({
                queryKey: queryKeys.members.pending(condominiumId),
              });
              qc.invalidateQueries({
                queryKey: queryKeys.members.approved(condominiumId),
              });
            }}
          />
        ))}
      </ul>
    </SectionCard>
  );
}

function PendingRow({
  member,
  condominiumId,
  onChanged,
}: {
  member: Member;
  condominiumId: string;
  onChanged: () => void;
}) {
  const [role, setRole] = useState<UserRole>(member.role);
  const [unitId, setUnitId] = useState<string>(member.unitId ?? '');

  const { data: units } = useQuery({
    queryKey: queryKeys.units.list(condominiumId),
    queryFn: () => unitsService.list(condominiumId),
  });

  const approve = useMutation({
    mutationFn: (payload: ApproveMemberInput) =>
      membersService.approve(condominiumId, member.membershipId, payload),
    onSuccess: () => {
      toast.success('Membro aprovado.');
      onChanged();
    },
    onError: () => toast.error('Não foi possível aprovar este membro.'),
  });

  const reject = useMutation({
    mutationFn: () => membersService.reject(condominiumId, member.membershipId),
    onSuccess: () => {
      toast.success('Solicitação rejeitada.');
      onChanged();
    },
    onError: () => toast.error('Não foi possível rejeitar.'),
  });

  return (
    <li className="rounded-ds-xl border border-amber-400/15 bg-amber-400/[0.04] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-ds-sm font-semibold text-ds-body">
            {member.fullName ?? member.email}
          </p>
          <p className="truncate text-ds-xs text-ds-subtle">{member.email}</p>
        </div>
        <Pill tone="amber">Pendente</Pill>
      </div>

      <div className="mt-3 grid min-w-0 grid-cols-1 gap-2 ds-md:grid-cols-[1fr_1fr_auto]">
        <NativeSelect
          aria-label="Papel"
          className="min-w-0"
          value={role}
          onChange={(e) => setRole(e.target.value as UserRole)}
        >
          {PENDING_APPROVAL_ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r].label}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label="Unidade"
          className="min-w-0"
          value={unitId}
          onChange={(e) => setUnitId(e.target.value)}
        >
          <option value="">Sem unidade</option>
          {(units ?? []).map((u) => (
            <option key={u.id} value={u.id}>
              {u.block} • {u.number}
            </option>
          ))}
        </NativeSelect>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="gradient"
            size="sm"
            disabled={approve.isPending}
            onClick={() =>
              approve.mutate({
                role,
                ...(unitId ? { unitId } : {}),
              })
            }
          >
            <UserCheck className="h-3.5 w-3.5" aria-hidden />
            Aprovar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={reject.isPending}
            onClick={() => reject.mutate()}
          >
            <UserX className="h-3.5 w-3.5" aria-hidden />
            Rejeitar
          </Button>
        </div>
      </div>
    </li>
  );
}

// ============================================================================
// Approved members
// ============================================================================

function ApprovedMembersCard({ condominiumId }: { condominiumId: string }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.members.approved(condominiumId),
    queryFn: () => membersService.listApproved(condominiumId),
  });

  return (
    <SectionCard
      title="Membros ativos"
      description="Quem tem acesso ao painel deste condomínio."
    >
      {isLoading ? (
        <Spinner />
      ) : !data || data.length === 0 ? (
        <p className="text-ds-sm text-ds-dim">Nenhum membro cadastrado ainda.</p>
      ) : (
        <ul className="space-y-2">
          {data.map((m) => (
            <ApprovedRow
              key={m.membershipId}
              member={m}
              condominiumId={condominiumId}
              onChanged={() =>
                qc.invalidateQueries({
                  queryKey: queryKeys.members.approved(condominiumId),
                })
              }
            />
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

function ApprovedRow({
  member,
  condominiumId,
  onChanged,
}: {
  member: Member;
  condominiumId: string;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);
  const [role, setRole] = useState<UserRole>(member.role);
  const [unitId, setUnitId] = useState<string>(member.unitId ?? '');

  const { data: units } = useQuery({
    queryKey: queryKeys.units.list(condominiumId),
    queryFn: () => unitsService.list(condominiumId),
    enabled: editing,
  });

  const update = useMutation({
    mutationFn: () =>
      membersService.update(condominiumId, member.membershipId, {
        role,
        unitId: unitId || null,
      }),
    onSuccess: () => {
      toast.success('Membro atualizado.');
      setEditing(false);
      onChanged();
    },
    onError: () => toast.error('Não foi possível atualizar.'),
  });

  const remove = useMutation({
    mutationFn: () => membersService.remove(condominiumId, member.membershipId),
    onSuccess: () => {
      toast.success('Membro removido.');
      onChanged();
    },
    onError: () => toast.error('Não foi possível remover.'),
  });

  return (
    <li className="rounded-ds-xl border border-ds-stroke-subtle bg-white/[0.02] p-4">
      <ConfirmDialog
        open={confirmRemoveOpen}
        onOpenChange={setConfirmRemoveOpen}
        title="Confirmar remoção de membro"
        description="Deseja remover este membro do condomínio?"
        confirmLabel="Remover membro"
        confirmDisabled={remove.isPending}
        onConfirm={() =>
          remove.mutate(undefined, {
            onSettled: () => setConfirmRemoveOpen(false),
          })
        }
      />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-ds-sm font-semibold text-ds-body">
            {member.fullName ?? member.email}
          </p>
          <p className="truncate text-ds-xs text-ds-subtle">{member.email}</p>
        </div>
        <Pill tone={member.role === 'ADMIN' ? 'emerald' : 'slate'}>
          {ROLE_LABELS[member.role].label}
        </Pill>
      </div>

      {editing ? (
        <div className="mt-3 grid min-w-0 grid-cols-1 gap-2 ds-md:grid-cols-[1fr_1fr_auto]">
          <NativeSelect
            aria-label="Papel"
            className="min-w-0"
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
          >
            {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r].label}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect
            aria-label="Unidade"
            className="min-w-0"
            value={unitId}
            onChange={(e) => setUnitId(e.target.value)}
          >
            <option value="">Sem unidade</option>
            {(units ?? []).map((u) => (
              <option key={u.id} value={u.id}>
                {u.block} • {u.number}
              </option>
            ))}
          </NativeSelect>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="gradient"
              size="sm"
              disabled={update.isPending}
              onClick={() => update.mutate()}
            >
              <Check className="h-3.5 w-3.5" aria-hidden />
              Salvar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditing(false);
                setRole(member.role);
                setUnitId(member.unitId ?? '');
              }}
            >
              <X className="h-3.5 w-3.5" aria-hidden />
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
            Editar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={remove.isPending}
            onClick={() => setConfirmRemoveOpen(true)}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
            Remover
          </Button>
        </div>
      )}
    </li>
  );
}

// ============================================================================
// Invitations
// ============================================================================

function InvitationsCard({ condominiumId }: { condominiumId: string }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.invitations.list(condominiumId),
    queryFn: () => invitationsService.list(condominiumId),
  });

  const revoke = useMutation({
    mutationFn: (invitationId: string) => invitationsService.revoke(invitationId),
    onSuccess: () => {
      toast.success('Convite revogado.');
      qc.invalidateQueries({ queryKey: queryKeys.invitations.list(condominiumId) });
    },
    onError: () => toast.error('Não foi possível revogar.'),
  });

  return (
    <SectionCard
      title="Convites ativos"
      description="Links e convites por e-mail que ainda podem ser aceitos."
    >
      {isLoading ? (
        <Spinner />
      ) : !data || data.length === 0 ? (
        <p className="text-ds-sm text-ds-dim">
          Nenhum convite ativo no momento.
        </p>
      ) : (
        <ul className="space-y-2">
          {data.map((inv) => (
            <InvitationRow
              key={inv.id}
              invitation={inv}
              onRevoke={() => revoke.mutate(inv.id)}
            />
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

function InvitationRow({
  invitation,
  onRevoke,
}: {
  invitation: Invitation;
  onRevoke: () => void;
}) {
  const expiresLabel = useMemo(() => {
    const expires = new Date(invitation.expiresAt);
    return expires.toLocaleString('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  }, [invitation.expiresAt]);

  // O backend só devolve `url` na criação. Para os convites listados depois,
  // mostramos só o e-mail / quantidade de usos.
  return (
    <li className="rounded-ds-xl border border-ds-stroke-subtle bg-white/[0.02] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone={invitation.type === 'EMAIL_DIRECT' ? 'sky' : 'slate'}>
              {invitation.type === 'EMAIL_DIRECT'
                ? 'Convite por e-mail'
                : 'Link genérico'}
            </Pill>
            <Pill tone="slate">{ROLE_LABELS[invitation.role].label}</Pill>
          </div>
          {invitation.email ? (
            <p className="truncate text-ds-sm text-ds-body">
              <Mail className="mr-1.5 inline h-3 w-3" aria-hidden />
              {invitation.email}
            </p>
          ) : null}
          <p className="text-ds-xs text-ds-subtle">
            Expira em {expiresLabel} • Usos: {invitation.usedCount}/
            {invitation.maxUses}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onRevoke}>
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
          Revogar
        </Button>
      </div>
    </li>
  );
}

// ============================================================================
// Create invitation dialog
// ============================================================================

function CreateInvitationDialog({
  condominiumId,
  open,
  onOpenChange,
}: {
  condominiumId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const [type, setType] = useState<'EMAIL_DIRECT' | 'GENERIC_LINK'>(
    'EMAIL_DIRECT',
  );
  const [email, setEmail] = useState('');
  const [expiresInHours, setExpiresInHours] = useState(72);
  const [maxUses, setMaxUses] = useState(1);
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const reset = () => {
    setType('EMAIL_DIRECT');
    setEmail('');
    setExpiresInHours(72);
    setMaxUses(1);
    setCreatedUrl(null);
    setCopied(false);
  };

  const create = useMutation({
    mutationFn: () => {
      const payload: CreateInvitationInput = {
        type,
        role: type === 'EMAIL_DIRECT' ? 'SUB_ADMIN' : 'RESIDENT',
        expiresInHours,
        maxUses: type === 'GENERIC_LINK' ? maxUses : 1,
      };
      if (type === 'EMAIL_DIRECT') payload.email = email.trim().toLowerCase();
      return invitationsService.create(condominiumId, payload);
    },
    onSuccess: (inv) => {
      toast.success('Convite criado!');
      setCreatedUrl(inv.url ?? null);
      qc.invalidateQueries({ queryKey: queryKeys.invitations.list(condominiumId) });
    },
    onError: () => toast.error('Não foi possível criar o convite.'),
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
          <DialogTitle>Novo convite</DialogTitle>
          <DialogDescription>
            {createdUrl
              ? 'Convite criado. Copie o link abaixo e envie ao convidado — ele só será exibido uma vez.'
              : 'Convide alguém por e-mail (acesso direto) ou gere um link genérico (entrada com aprovação).'}
          </DialogDescription>
        </DialogHeader>

        {createdUrl ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-ds-lg border border-emerald-400/20 bg-emerald-400/[0.06] p-3">
              <ShieldCheck className="h-4 w-4 text-emerald-300" aria-hidden />
              <p className="text-ds-sm text-emerald-200">
                Convite válido. Compartilhe com cuidado.
              </p>
            </div>
            <div className="flex items-stretch gap-2">
              <Input
                readOnly
                value={createdUrl}
                onFocus={(e) => e.currentTarget.select()}
              />
              <Button variant="secondary" onClick={copy}>
                {copied ? (
                  <Check className="h-3.5 w-3.5" aria-hidden />
                ) : (
                  <Copy className="h-3.5 w-3.5" aria-hidden />
                )}
                {copied ? 'Copiado' : 'Copiar'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <FormField label="Tipo" htmlFor="invite-type">
              <NativeSelect
                id="invite-type"
                value={type}
                onChange={(e) =>
                  setType(e.target.value as 'EMAIL_DIRECT' | 'GENERIC_LINK')
                }
              >
                <option value="EMAIL_DIRECT">
                  Convidar subsíndico por e-mail
                </option>
                <option value="GENERIC_LINK">
                  Link genérico para autocadastro de morador
                </option>
              </NativeSelect>
            </FormField>

            {type === 'EMAIL_DIRECT' ? (
              <FormField label="E-mail do convidado" htmlFor="invite-email" required>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="pessoa@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </FormField>
            ) : null}

            <div className="rounded-ds-lg border border-ds-stroke-subtle bg-white/[0.02] p-3 text-ds-xs text-ds-dim">
              {type === 'EMAIL_DIRECT'
                ? 'Este convite cria acesso de SUB_ADMIN diretamente no condomínio.'
                : 'Este link permite autocadastro de moradores. O síndico aprova depois e define unidade/papel.'}
            </div>

            <div className="grid gap-3 ds-md:grid-cols-2">
              <FormField label="Validade (horas)" htmlFor="invite-exp">
                <Input
                  id="invite-exp"
                  type="number"
                  min={1}
                  max={720}
                  value={expiresInHours}
                  onChange={(e) =>
                    setExpiresInHours(Math.max(1, Number(e.target.value) || 1))
                  }
                />
              </FormField>
              {type === 'GENERIC_LINK' ? (
                <FormField label="Máximo de usos" htmlFor="invite-uses">
                  <Input
                    id="invite-uses"
                    type="number"
                    min={1}
                    max={500}
                    value={maxUses}
                    onChange={(e) =>
                      setMaxUses(Math.max(1, Number(e.target.value) || 1))
                    }
                  />
                </FormField>
              ) : null}
            </div>

            <p className="flex items-start gap-1.5 text-ds-xs text-ds-dim">
              <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0 text-emerald-300" aria-hidden />
              {type === 'EMAIL_DIRECT'
                ? ROLE_LABELS.SUB_ADMIN.description
                : ROLE_LABELS.RESIDENT.description}
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
              <Button
                variant="gradient"
                disabled={
                  create.isPending ||
                  (type === 'EMAIL_DIRECT' && !email.trim().includes('@'))
                }
                onClick={() => create.mutate()}
              >
                <UserPlus className="h-3.5 w-3.5" aria-hidden />
                {create.isPending ? 'Criando…' : 'Criar convite'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
