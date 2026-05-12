import { useState } from 'react';
import { ExternalLink, FileStack, FileText, FileUp, Plus, Trash2 } from 'lucide-react';
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
import { documentsService } from '@/domains/documents/services/documents.service';
import { useDocumentsPage } from '@/domains/documents/hooks/useDocumentsPage';
import { documentFormSchema, type DocumentFormInput } from '@/domains/documents/schemas/documents.schema';
import { useAuthStore } from '@/shared/stores/auth.store';

const visibilityLabel: Record<string, string> = {
  ALL: 'Todos',
  ADMIN_ONLY: 'Somente admins',
};

export function DocumentsPage() {
  const condo = useAuthStore((state) => state.activeCondominium);
  const role = useAuthStore((state) => state.role);
  const canManage = role === 'ADMIN' || role === 'SUB_ADMIN';
  const [open, setOpen] = useState(false);

  const form = useForm<DocumentFormInput>({
    resolver: zodResolver(documentFormSchema),
    defaultValues: { title: '', category: '', documentDate: '', visibility: 'ALL', description: '' },
  });
  const { documentsQuery, createMutation, removeMutation } = useDocumentsPage(condo?.id);

  const openDoc = async (id: string) => {
    if (!condo?.id) return;
    try {
      const signed = await documentsService.signedUrl(condo.id, id);
      window.open(signed.url, '_blank', 'noopener,noreferrer');
    } catch {
      toast.error('Erro ao abrir documento.');
    }
  };

  if (!condo?.id) {
    return <p className="ds-page text-ds-sm text-ds-dim">Selecione um condomínio no topo da página.</p>;
  }

  if (documentsQuery.isLoading) return <ListSkeleton rows={4} />;

  const list = documentsQuery.data ?? [];

  return (
    <div className="ds-page space-y-6">
      <PageHeader
        title="Documentos"
        description="Atas, regulamentos, comprovantes e outros arquivos do condomínio."
        actions={
          canManage ? (
            <FormDialog
              open={open}
              onOpenChange={setOpen}
              trigger={
                <Button>
                  <Plus className="h-4 w-4" />
                  Novo documento
                </Button>
              }
              title="Novo documento"
              description="Envie um arquivo para disponibilizar aos moradores."
            >
              <form
                className="space-y-4"
                onSubmit={form.handleSubmit((p) =>
                  createMutation.mutate(p, {
                    onSuccess: () => {
                      toast.success('Documento enviado com sucesso!');
                      form.reset();
                      setOpen(false);
                    },
                    onError: () => {
                      toast.error('Erro ao enviar documento.');
                    },
                  }),
                )}
              >
                <FormField label="Título" htmlFor="doc-title" required error={form.formState.errors.title?.message}>
                  <Input id="doc-title" placeholder="Ex: Ata da assembleia" {...form.register('title', { required: 'Título obrigatório' })} />
                </FormField>

                <FormField label="Categoria" htmlFor="doc-category" required error={form.formState.errors.category?.message}>
                  <Input id="doc-category" placeholder="Ex: Atas, Regulamentos..." {...form.register('category', { required: 'Categoria obrigatória' })} />
                </FormField>

                <FormField label="Data do documento" htmlFor="doc-date" required error={form.formState.errors.documentDate?.message}>
                  <Input id="doc-date" type="date" {...form.register('documentDate', { required: 'Data obrigatória' })} />
                </FormField>

                <FormField label="Visibilidade" required>
                  <Controller
                    control={form.control}
                    name="visibility"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a visibilidade" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ALL">Todos</SelectItem>
                          <SelectItem value="ADMIN_ONLY">Somente admins</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </FormField>

                <FormField label="Descrição" htmlFor="doc-desc">
                  <Input id="doc-desc" placeholder="Descrição opcional..." {...form.register('description')} />
                </FormField>

                <FormField label="Arquivo" htmlFor="doc-file" required error={form.formState.errors.file?.message}>
                  <Input id="doc-file" type="file" {...form.register('file', { required: 'Arquivo obrigatório' })} />
                </FormField>

                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="ghost" type="button">Cancelar</Button>
                  </DialogClose>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? 'Enviando...' : 'Enviar documento'}
                  </Button>
                </DialogFooter>
              </form>
            </FormDialog>
          ) : undefined
        }
      />

      {list.length === 0 ? (
        <EmptyState
          icon={canManage ? FileUp : FileStack}
          title="Nenhum documento publicado"
          description={
            canManage
              ? 'Esta área concentra atas, regulamento interno, comprovantes e PDFs com assinatura digital visível a moradores (conforme a visibilidade).'
              : 'Quando a administração publicar arquivos, eles aparecerão aqui com título, categoria e data — prontos para abrir com link seguro.'
          }
          suggestion={
            canManage
              ? 'Documentos com visibilidade "todos" ajudam na transparência; "somente admin" restringe o conteúdo sensível.'
              : 'Se precisar de um documento que ainda não está no sistema, solicite à administração do condomínio o envio pelo painel.'
          }
          action={
            canManage
              ? { label: 'Enviar primeiro documento', onClick: () => setOpen(true) }
              : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 ds-sm:grid-cols-2 ds-lg:grid-cols-3">
          {list.map((doc) => (
            <GlassCard key={doc.id} className="flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-ds-lg bg-ds-surface">
                  <FileText className="h-5 w-5 text-ds-info" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-ds-md font-semibold text-ds-body">{doc.title}</h3>
                  <p className="text-ds-xs text-ds-dim">{doc.category}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-ds-xs text-ds-subtle">
                <span>
                  {new Date(doc.documentDate + 'T00:00:00').toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
                <span
                  className={`rounded-ds-md px-2 py-0.5 font-medium ${
                    doc.visibility === 'ADMIN_ONLY'
                      ? 'bg-amber-500/15 text-amber-400'
                      : 'bg-emerald-500/15 text-emerald-400'
                  }`}
                >
                  {visibilityLabel[doc.visibility]}
                </span>
              </div>

              <div className="mt-auto flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => openDoc(doc.id)}>
                  <ExternalLink className="h-3.5 w-3.5" />
                  Abrir
                </Button>
                {canManage && (
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() =>
                      removeMutation.mutate(doc.id, {
                        onSuccess: () => toast.success('Documento excluído.'),
                        onError: () => toast.error('Erro ao excluir documento.'),
                      })
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Excluir
                  </Button>
                )}
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
