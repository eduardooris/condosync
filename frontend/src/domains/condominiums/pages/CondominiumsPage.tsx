import { useState } from 'react';
import { Building2, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import { Button } from '@/shared/components/ui/Button';
import { EmptyState } from '@/shared/components/ui/EmptyState';
import { FormDialog, DialogFooter } from '@/shared/components/ui/Dialog';
import { FormField } from '@/shared/components/ui/FormField';
import { GlassCard } from '@/shared/components/ui/GlassCard';
import { Input } from '@/shared/components/ui/Input';
import { PageHeader } from '@/shared/components/ui/PageHeader';
import { Spinner } from '@/shared/components/ui/Spinner';
import { useCondominiumsPage } from '@/domains/condominiums/hooks/useCondominiumsPage';
import {
  createCondominiumSchema,
  type CreateCondominiumInput,
} from '@/domains/condominiums/schemas/condominiums.schema';
import { useAuthStore } from '@/shared/stores/auth.store';
import { cn } from '@/shared/utils/cn';
import { canAccessCondominiumAdminRoutes } from '@/shared/utils/roles';

function formatCnpj(raw: string) {
  const digits = raw.replace(/\D/g, '').slice(0, 14);
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

export function CondominiumsPage() {
  const setActiveCondominium = useAuthStore((s) => s.setActiveCondominium);
  const activeCondominium = useAuthStore((s) => s.activeCondominium);

  const [open, setOpen] = useState(false);
  const form = useForm<CreateCondominiumInput>({
    resolver: zodResolver(createCondominiumSchema),
  });
  const { condominiumsQuery, createMutation } = useCondominiumsPage();

  if (condominiumsQuery.isLoading) return <Spinner />;

  const list = condominiumsQuery.data ?? [];

  return (
    <div className="ds-page space-y-6">
      <PageHeader
        title="Condomínios"
        description="Gerencie os condomínios vinculados à sua conta."
        actions={
          <FormDialog
            open={open}
            onOpenChange={setOpen}
            trigger={
              <Button variant="gradient">
                <Plus className="h-4 w-4" />
                Novo condomínio
              </Button>
            }
            title="Novo condomínio"
            description="Preencha os dados para cadastrar um novo condomínio."
          >
            <form
              className="space-y-4"
              onSubmit={form.handleSubmit((payload) =>
                createMutation.mutate(payload, {
                  onSuccess: () => {
                    toast.success('Condomínio criado com sucesso!');
                    form.reset();
                    setOpen(false);
                  },
                  onError: () => {
                    toast.error('Erro ao criar condomínio. Tente novamente.');
                  },
                }),
              )}
            >
              <FormField label="Nome" htmlFor="condo-name" required>
                <Input
                  id="condo-name"
                  placeholder="Ex: Residencial Aurora"
                  {...form.register('name', { required: true })}
                />
              </FormField>

              <FormField
                label="CNPJ"
                htmlFor="condo-cnpj"
                required
                hint="14 dígitos, sem pontuação"
              >
                <Input
                  id="condo-cnpj"
                  placeholder="00000000000000"
                  maxLength={14}
                  {...form.register('cnpj', { required: true })}
                />
              </FormField>

              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Criando…' : 'Criar condomínio'}
                </Button>
              </DialogFooter>
            </form>
          </FormDialog>
        }
      />

      {list.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Nenhum condomínio vinculado a você"
          description="Sua lista mostrará os empreendimentos aos quais você tem acesso (síndico, subsíndico ou visão de morador, conforme o cadastro)."
          suggestion="Use o Setup Assistant para criar o condomínio com identidade, regras financeiras e unidades em poucos cliques."
          action={{ to: '/setup', label: 'Abrir setup assistant' }}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 ds-sm:grid-cols-2 ds-lg:grid-cols-3">
          {list.map((condo) => {
            const isActive = activeCondominium?.id === condo.id;
            const canManageCondo = canAccessCondominiumAdminRoutes(condo.role);
            return (
              <GlassCard
                key={condo.id}
                className={cn(
                  'flex flex-col gap-4',
                  isActive && 'ring-2 ring-brand-400/60 shadow-[0_0_24px_-4px_rgba(99,179,237,0.25)]',
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-ds-xl bg-gradient-to-br from-brand-400/20 to-brand-500/10 text-brand-700 dark:text-brand-300">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-ds-md font-semibold text-ds-body">
                      {condo.name}
                    </h3>
                    <p className="text-ds-xs text-ds-dim">
                      {formatCnpj(condo.cnpj)}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Button
                    size="sm"
                    variant={isActive ? 'gradient' : 'secondary'}
                    className="w-full"
                    onClick={() =>
                      setActiveCondominium({
                        id: condo.id,
                        name: condo.name,
                        role: condo.role,
                        unitId: condo.unitId,
                      })
                    }
                  >
                    {isActive ? 'Ativo' : 'Selecionar'}
                  </Button>
                  {canManageCondo ? (
                    <Link to={`/condominiums/${condo.id}?section=team`} className="block">
                      <Button size="sm" variant="ghost" className="w-full">
                        Gerenciar equipe e convites
                      </Button>
                    </Link>
                  ) : null}
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
