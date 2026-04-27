import { useState } from 'react';
import {
  Banknote,
  Plus,
  Wrench,
  SprayCan,
  ShieldCheck,
  Scale,
  MoreHorizontal,
  RefreshCw,
} from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import { Button } from '@/shared/components/ui/Button';
import { EmptyState } from '@/shared/components/ui/EmptyState';
import { GlassCard } from '@/shared/components/ui/GlassCard';
import { Input } from '@/shared/components/ui/Input';
import { Spinner } from '@/shared/components/ui/Spinner';
import { PageHeader } from '@/shared/components/ui/PageHeader';
import { FormDialog, DialogFooter, DialogClose } from '@/shared/components/ui/Dialog';
import { FormField } from '@/shared/components/ui/FormField';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/shared/components/ui/Select';
import { useAuthStore } from '@/shared/stores/auth.store';
import { canAccessCondominiumAdminRoutes } from '@/shared/utils/roles';
import { useExpenses } from '@/domains/expenses/hooks/useExpenses';
import { useExpensesPage } from '@/domains/expenses/hooks/useExpensesPage';
import { expenseFormSchema, type ExpenseFormValues } from '@/domains/expenses/schemas/expenses.schema';
import type { Expense } from '@/shared/types/api';
import { cn } from '@/shared/utils/cn';

type ExpenseCategory = Expense['category'];

const CATEGORY_CONFIG: Record<
  ExpenseCategory,
  { label: string; icon: typeof Wrench; color: string }
> = {
  MAINTENANCE: { label: 'Manutenção', icon: Wrench, color: 'text-amber-400 bg-amber-400/10' },
  CLEANING: { label: 'Limpeza', icon: SprayCan, color: 'text-sky-400 bg-sky-400/10' },
  CONCIERGE: { label: 'Portaria', icon: ShieldCheck, color: 'text-emerald-400 bg-emerald-400/10' },
  LEGAL: { label: 'Jurídico', icon: Scale, color: 'text-violet-400 bg-violet-400/10' },
  OTHER: { label: 'Outros', icon: MoreHorizontal, color: 'text-ds-dim bg-white/5' },
};

function isExpenseCategory(v: string): v is ExpenseCategory {
  return v in CATEGORY_CONFIG;
}

function formatBRL(value: string | number | null | undefined) {
  const n = typeof value === 'number' ? value : Number(String(value ?? '').replace(',', '.'));
  if (!Number.isFinite(n)) {
    return '—';
  }
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(raw: string | null | undefined) {
  if (!raw || !String(raw).trim()) return '—';
  const s = String(raw).trim();
  const d = s.includes('T') ? new Date(s) : new Date(`${s.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) {
    return s.slice(0, 10) || '—';
  }
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function ExpensesPage() {
  const condId = useAuthStore((state) => state.activeCondominium?.id);
  const role = useAuthStore((state) => state.role);
  const canManageExpenses = canAccessCondominiumAdminRoutes(role);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: { category: 'MAINTENANCE' },
  });

  const { data, isLoading, isError, error, refetch, isFetching } = useExpenses(condId);
  const { createMutation } = useExpensesPage(condId);

  if (isLoading && condId) return <Spinner />;

  const list = data ?? [];

  if (!condId) {
    return (
      <div className="ds-page mx-auto max-w-6xl min-w-0 space-y-6">
        <PageHeader
          title="Despesas"
          description="Consulte as despesas do condomínio selecionado."
        />
        <EmptyState
          icon={Banknote}
          title="Nenhum condomínio selecionado"
          description="Escolha um condomínio no menu lateral para ver as despesas."
        />
      </div>
    );
  }

  return (
    <div className="ds-page mx-auto max-w-6xl min-w-0 space-y-5 ds-md:space-y-6">
      <PageHeader
        title="Despesas"
        description={
          canManageExpenses
            ? 'Acompanhe e gerencie todas as despesas do condomínio.'
            : 'Consulte as despesas registradas pela administração do condomínio.'
        }
        className="min-w-0"
        actionsClassName="w-full ds-sm:w-auto"
        actions={
          canManageExpenses ? (
            <Button
              onClick={() => setDialogOpen(true)}
              fullWidth
              className="min-h-11 ds-sm:min-h-0"
            >
              <Plus className="h-4 w-4 shrink-0" aria-hidden />
              Lançar despesa
            </Button>
          ) : undefined
        }
      />

      {canManageExpenses ? (
        <FormDialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) reset();
          }}
          title="Lançar despesa"
          description="Preencha os dados da nova despesa"
        >
          <form
            className="space-y-4"
            onSubmit={handleSubmit((values) =>
              createMutation.mutate(values, {
                onSuccess: () => {
                  toast.success('Despesa lançada com sucesso!');
                  setDialogOpen(false);
                  reset();
                },
                onError: () => {
                  toast.error('Erro ao lançar despesa. Tente novamente.');
                },
              }),
            )}
          >
            <FormField label="Descrição" htmlFor="description" required error={errors.description?.message}>
              <Input
                id="description"
                placeholder="Ex: Manutenção do elevador"
                {...register('description', { required: 'Descrição é obrigatória' })}
              />
            </FormField>

            <div className="grid min-w-0 grid-cols-1 gap-4 ds-sm:grid-cols-2">
              <FormField label="Valor" htmlFor="amount" required error={errors.amount?.message}>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0,00"
                  {...register('amount', {
                    required: 'Valor é obrigatório',
                    valueAsNumber: true,
                    min: { value: 0.01, message: 'Valor deve ser maior que zero' },
                  })}
                />
              </FormField>

              <FormField label="Data" htmlFor="expenseDate" required error={errors.expenseDate?.message}>
                <Input
                  id="expenseDate"
                  type="date"
                  {...register('expenseDate', { required: 'Data é obrigatória' })}
                />
              </FormField>
            </div>

            <FormField label="Categoria" required error={errors.category?.message}>
              <Controller
                control={control}
                name="category"
                rules={{ required: 'Categoria é obrigatória' }}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="min-w-0">
                      <SelectValue placeholder="Selecione a categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MAINTENANCE">Manutenção</SelectItem>
                      <SelectItem value="CLEANING">Limpeza</SelectItem>
                      <SelectItem value="CONCIERGE">Portaria</SelectItem>
                      <SelectItem value="LEGAL">Jurídico</SelectItem>
                      <SelectItem value="OTHER">Outros</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>

            <FormField label="Fornecedor" htmlFor="vendor">
              <Input id="vendor" placeholder="Ex: Empresa Elevadores LTDA" {...register('vendor')} />
            </FormField>

            <DialogFooter>
              <DialogClose asChild>
                <Button variant="ghost" type="button">
                  Cancelar
                </Button>
              </DialogClose>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Salvando...' : 'Salvar despesa'}
              </Button>
            </DialogFooter>
          </form>
        </FormDialog>
      ) : null}

      {isError ? (
        <GlassCard variant="default" className="border-ds-danger/25 p-5">
          <p className="text-ds-sm font-semibold text-ds-body">Não foi possível carregar as despesas</p>
          <p className="mt-1 text-pretty text-ds-xs text-ds-dim">
            {(error as Error)?.message ?? 'Verifique sua conexão e tente outra vez.'}
          </p>
          <Button
            type="button"
            variant="secondary"
            className="mt-4"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} aria-hidden />
            Recarregar lista
          </Button>
        </GlassCard>
      ) : list.length === 0 ? (
        <EmptyState
          icon={Banknote}
          title="Nenhuma despesa"
          description="Ainda não há despesas registradas neste condomínio."
          suggestion={
            canManageExpenses
              ? "Clique em 'Lançar despesa' para adicionar a primeira."
              : 'O síndico registra as despesas aprovadas. Quando houver lançamentos, eles aparecerão aqui.'
          }
        />
      ) : (
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((expense) => {
            const cat: ExpenseCategory = isExpenseCategory(expense.category)
              ? expense.category
              : 'OTHER';
            const config = CATEGORY_CONFIG[cat];
            const Icon = config.icon;

            return (
              <GlassCard key={expense.id} className="min-w-0 overflow-hidden">
                <div className="flex min-w-0 items-start gap-3">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-ds-lg ${config.color}`}
                  >
                    <Icon className="h-5 w-5 shrink-0" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <h3 className="break-words font-medium text-ds-body">{expense.description}</h3>
                    <p className="mt-0.5 text-ds-lg font-semibold tabular-nums text-ds-body">
                      {formatBRL(expense.amount)}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex max-w-full items-center truncate rounded-full px-2 py-0.5 text-ds-xs font-medium ${config.color}`}
                      >
                        {config.label}
                      </span>
                      <span className="shrink-0 text-ds-xs text-ds-dim">{formatDate(expense.expenseDate)}</span>
                    </div>
                    {expense.vendor ? (
                      <p className="mt-1 break-words text-ds-xs text-ds-subtle">{expense.vendor}</p>
                    ) : null}
                  </div>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
