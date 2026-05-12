import { useState } from 'react';
import { Megaphone, Plus } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import { Button } from '@/shared/components/ui/Button';
import { EmptyState } from '@/shared/components/ui/EmptyState';
import { FormDialog, DialogFooter, DialogClose } from '@/shared/components/ui/Dialog';
import { FormField } from '@/shared/components/ui/FormField';
import { GlassCard } from '@/shared/components/ui/GlassCard';
import { Input } from '@/shared/components/ui/Input';
import { PageHeader } from '@/shared/components/ui/PageHeader';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/shared/components/ui/Select';
import { ListSkeleton } from '@/shared/components/ui/Skeleton';
import { Textarea } from '@/shared/components/ui/Textarea';
import { useBulletinPage } from '@/domains/bulletin/hooks/useBulletinPage';
import { bulletinFormSchema, type BulletinFormInput } from '@/domains/bulletin/schemas/bulletin.schema';
import { useAuthStore } from '@/shared/stores/auth.store';
import { canAccessCondominiumAdminRoutes } from '@/shared/utils/roles';

type Priority = 'INFO' | 'ATTENTION' | 'URGENT';

const priorityConfig: Record<Priority, { label: string; border: string; badge: string }> = {
  INFO: {
    label: 'Informativo',
    border: 'border-l-blue-500',
    badge: 'bg-blue-500/15 text-blue-400',
  },
  ATTENTION: {
    label: 'Atenção',
    border: 'border-l-amber-500',
    badge: 'bg-amber-500/15 text-amber-400',
  },
  URGENT: {
    label: 'Urgente',
    border: 'border-l-red-500',
    badge: 'bg-red-500/15 text-red-400',
  },
};

export function BulletinPage() {
  const condo = useAuthStore((state) => state.activeCondominium);
  const role = useAuthStore((state) => state.role);
  const canPublish = canAccessCondominiumAdminRoutes(role);
  const [open, setOpen] = useState(false);

  const form = useForm<BulletinFormInput>({
    resolver: zodResolver(bulletinFormSchema),
    defaultValues: { title: '', body: '', priority: 'INFO' },
  });

  const { bulletinQuery, createMutation } = useBulletinPage(condo?.id);

  if (!condo?.id) {
    return <p className="ds-page text-ds-sm text-ds-dim">Selecione um condomínio no topo da página.</p>;
  }

  if (bulletinQuery.isLoading) return <ListSkeleton rows={4} />;

  const list = bulletinQuery.data ?? [];

  return (
    <div className="ds-page space-y-6">
      <PageHeader
        title="Mural de Avisos"
        description="Avisos oficiais do condomínio — reformas, assembleias, manutenção e comunicados gerais."
        actions={
          canPublish ? (
            <FormDialog
              open={open}
              onOpenChange={setOpen}
              trigger={
                <Button>
                  <Plus className="h-4 w-4" />
                  Novo recado
                </Button>
              }
              title="Novo recado"
              description="Publique um aviso para todos os moradores do condomínio."
            >
              <form
                className="space-y-4"
                onSubmit={form.handleSubmit((p) =>
                  createMutation.mutate(p, {
                    onSuccess: () => {
                      toast.success('Recado publicado com sucesso!');
                      form.reset();
                      setOpen(false);
                    },
                    onError: () => toast.error('Erro ao publicar recado.'),
                  }),
                )}
              >
                <FormField label="Título" htmlFor="title" required error={form.formState.errors.title?.message}>
                  <Input id="title" placeholder="Ex: Manutenção da piscina" {...form.register('title', { required: 'Título obrigatório' })} />
                </FormField>

                <FormField label="Mensagem" htmlFor="body" required error={form.formState.errors.body?.message}>
                  <Textarea id="body" placeholder="Descreva o aviso..." rows={4} {...form.register('body', { required: 'Mensagem obrigatória' })} />
                </FormField>

                <FormField label="Prioridade" required>
                  <Controller
                    control={form.control}
                    name="priority"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a prioridade" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="INFO">Informativo</SelectItem>
                          <SelectItem value="ATTENTION">Atenção</SelectItem>
                          <SelectItem value="URGENT">Urgente</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </FormField>

                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="ghost" type="button">Cancelar</Button>
                  </DialogClose>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? 'Publicando...' : 'Publicar'}
                  </Button>
                </DialogFooter>
              </form>
            </FormDialog>
          ) : undefined
        }
      />

      {list.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="Mural ainda vazio"
          description="Aqui ficam avisos oficiais do condomínio — reformas, assembleias, manutenção da piscina, alteração de regras, etc."
          suggestion={
            canPublish
              ? 'Com o tempo, este mural vira o histórico de comunicação com todos os moradores.'
              : 'Quando o síndico publicar avisos, eles aparecerão aqui.'
          }
          action={
            canPublish
              ? { label: 'Publicar primeiro recado', onClick: () => setOpen(true) }
              : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 ds-md:grid-cols-2">
          {list.map((item) => {
            const cfg = priorityConfig[item.priority];
            return (
              <GlassCard key={item.id} className={`border-l-4 ${cfg.border}`}>
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-ds-md font-semibold text-ds-body">{item.title}</h3>
                  <span className={`shrink-0 rounded-ds-md px-2 py-0.5 text-ds-xs font-medium ${cfg.badge}`}>
                    {cfg.label}
                  </span>
                </div>
                <p className="mt-2 text-ds-sm text-ds-dim whitespace-pre-line">{item.body}</p>
                {item.createdAt && (
                  <p className="mt-3 text-ds-xs text-ds-subtle">
                    {new Date(item.createdAt).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                )}
              </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
