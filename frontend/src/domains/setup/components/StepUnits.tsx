import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Building2, FileSpreadsheet, ListPlus, Plus, Sparkles, UploadCloud, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/shared/components/ui/Button';
import { FormField } from '@/shared/components/ui/FormField';
import { Input } from '@/shared/components/ui/Input';
import { SetupShell } from '@/domains/setup/components/SetupShell';
import { useSetupStore } from '@/domains/setup/store/setup.store';
import { unitsService } from '@/domains/units/services/units.service';
import { cn } from '@/shared/utils/cn';
import { queryKeys } from '@/shared/lib/queryKeys';

type Mode = 'generator' | 'csv' | 'manual';

interface StepUnitsProps {
  onBack: () => void;
  onContinue: () => void;
}

const CSV_TEMPLATE = 'block,number,type,status\nA,101,APARTMENT,OCCUPIED\nA,102,APARTMENT,VACANT\nB,201,APARTMENT,OCCUPIED\n';

export function StepUnits({ onBack, onContinue }: StepUnitsProps) {
  const queryClient = useQueryClient();
  const condominiumId = useSetupStore((s) => s.condominiumId);
  const setUnitsCount = useSetupStore((s) => s.setUnitsCount);
  const [mode, setMode] = useState<Mode>('generator');

  const { data: units } = useQuery({
    queryKey: queryKeys.units.list(condominiumId),
    queryFn: () => unitsService.list(condominiumId!),
    enabled: Boolean(condominiumId),
  });

  const totalUnits = units?.length ?? 0;

  return (
    <SetupShell
      step="units"
      eyebrow="Passo 3 de 4"
      title="Vamos cadastrar as unidades"
      description="Escolha o jeito mais rápido para você. As unidades podem ser editadas depois individualmente."
      onBack={onBack}
      onPrimary={() => {
        setUnitsCount(totalUnits);
        onContinue();
      }}
      primaryDisabled={totalUnits === 0}
      primaryLabel={totalUnits === 0 ? 'Adicione pelo menos 1 unidade' : `Continuar com ${totalUnits} unidade${totalUnits === 1 ? '' : 's'}`}
    >
      <div className="space-y-5">
        <ModeTabs mode={mode} onChange={setMode} />

        {mode === 'generator' ? (
          <GeneratorMode condominiumId={condominiumId} onCreated={() => queryClient.invalidateQueries({ queryKey: queryKeys.units.list(condominiumId) })} />
        ) : null}
        {mode === 'csv' ? (
          <CsvMode condominiumId={condominiumId} onCreated={() => queryClient.invalidateQueries({ queryKey: queryKeys.units.list(condominiumId) })} />
        ) : null}
        {mode === 'manual' ? (
          <ManualMode condominiumId={condominiumId} onCreated={() => queryClient.invalidateQueries({ queryKey: queryKeys.units.list(condominiumId) })} />
        ) : null}

        <UnitsPreview units={units ?? []} total={totalUnits} />
      </div>
    </SetupShell>
  );
}

function ModeTabs({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  const tabs: { id: Mode; label: string; description: string; icon: React.ComponentType<{ className?: string; strokeWidth?: number }> }[] = [
    { id: 'generator', label: 'Gerador rápido', description: 'Vários blocos × N apartamentos', icon: Sparkles },
    { id: 'csv', label: 'Importar CSV', description: 'Subir planilha pronta', icon: FileSpreadsheet },
    { id: 'manual', label: 'Manual', description: 'Adicionar uma a uma', icon: ListPlus },
  ];

  return (
    <div className="grid gap-2 ds-sm:grid-cols-3">
      {tabs.map((tab) => {
        const active = mode === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              'relative flex flex-col items-start gap-2 rounded-ds-2xl border p-3.5 text-left transition',
              active
                ? 'border-brand-400/60 bg-gradient-to-br from-brand-400/15 to-brand-500/5 shadow-md shadow-brand-500/20'
                : 'border-ds-stroke-subtle bg-ds-surface hover:border-brand-400/30 hover:bg-ds-elevated dark:bg-white/[0.02] dark:hover:bg-white/[0.04]',
            )}
          >
            <span
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-ds-lg ring-1 transition',
                active
                  ? 'bg-gradient-to-br from-brand-300 to-brand-500 text-white ring-transparent'
                  : 'bg-ds-surface text-brand-800/90 ring-ds-stroke dark:bg-white/[0.05] dark:text-brand-300/80',
              )}
            >
              <Icon className="h-4 w-4" strokeWidth={2} />
            </span>
            <div>
              <p className="text-ds-sm font-semibold text-ds-body">{tab.label}</p>
              <p className="text-ds-xs text-ds-subtle">{tab.description}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function GeneratorMode({ condominiumId, onCreated }: { condominiumId: string | null; onCreated: () => void }) {
  const [blocksText, setBlocksText] = useState('A,B');
  const [perBlock, setPerBlock] = useState(20);
  const [startNumber, setStartNumber] = useState(101);

  const blocks = useMemo(
    () => blocksText.split(',').map((s) => s.trim()).filter(Boolean),
    [blocksText],
  );
  const previewCount = blocks.length * perBlock;

  const sample = useMemo(() => {
    const items: { block: string; number: string }[] = [];
    blocks.slice(0, 2).forEach((block) => {
      for (let i = 0; i < Math.min(perBlock, 3); i += 1) {
        items.push({ block, number: String(startNumber + i) });
      }
    });
    return items;
  }, [blocks, perBlock, startNumber]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!condominiumId) throw new Error('missing condominium');
      const csvLines = ['block,number,type,status'];
      blocks.forEach((block) => {
        for (let i = 0; i < perBlock; i += 1) {
          csvLines.push(`${block},${startNumber + i},APARTMENT,VACANT`);
        }
      });
      return unitsService.importCsv(condominiumId, csvLines.join('\n'));
    },
    onSuccess: (result) => {
      toast.success(`${result.count} unidades geradas!`);
      onCreated();
    },
    onError: () => toast.error('Não foi possível gerar as unidades.'),
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-ds-2xl border border-ds-stroke-subtle bg-ds-surface dark:bg-white/[0.02] p-5"
    >
      <div className="grid grid-cols-1 gap-4 ds-sm:grid-cols-[1fr_140px_140px]">
        <FormField label="Blocos (separe por vírgula)" htmlFor="gen-blocks" required>
          <Input id="gen-blocks" value={blocksText} onChange={(e) => setBlocksText(e.target.value)} placeholder="A, B, C" />
        </FormField>
        <FormField label="Unidades / bloco" htmlFor="gen-per" required>
          <Input
            id="gen-per"
            type="number"
            min={1}
            max={500}
            value={perBlock}
            onChange={(e) => setPerBlock(Math.max(1, Number(e.target.value) || 0))}
          />
        </FormField>
        <FormField label="Começar em" htmlFor="gen-start" required>
          <Input
            id="gen-start"
            type="number"
            min={1}
            value={startNumber}
            onChange={(e) => setStartNumber(Math.max(1, Number(e.target.value) || 1))}
          />
        </FormField>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-ds-xl border border-brand-400/20 bg-brand-400/[0.06] px-4 py-3">
        <div className="text-ds-sm text-ds-dim">
          Será gerado um total de{' '}
          <span className="font-semibold text-ds-body">{previewCount}</span> unidades.{' '}
          {sample.length > 0 ? (
            <>
              Ex.: <span className="font-semibold text-ds-body">{sample.map((s) => `${s.block}-${s.number}`).join(', ')}…</span>
            </>
          ) : null}
        </div>
        <Button
          variant="gradient"
          size="sm"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || blocks.length === 0 || perBlock < 1}
        >
          <Sparkles className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
          {mutation.isPending ? 'Gerando…' : 'Gerar unidades'}
        </Button>
      </div>
    </motion.div>
  );
}

function CsvMode({ condominiumId, onCreated }: { condominiumId: string | null; onCreated: () => void }) {
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!condominiumId) throw new Error('missing condominium');
      return unitsService.importCsv(condominiumId, csvText.trim());
    },
    onSuccess: (result) => {
      toast.success(`${result.count} unidades importadas!`);
      onCreated();
      setCsvText('');
      setFileName(null);
    },
    onError: () => toast.error('CSV inválido ou houve um erro ao importar.'),
  });

  function handleFile(file: File | null) {
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => setCsvText(String(reader.result ?? ''));
    reader.readAsText(file);
  }

  function downloadTemplate() {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'condosync-unidades-modelo.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4 rounded-ds-2xl border border-ds-stroke-subtle bg-ds-surface dark:bg-white/[0.02] p-5"
    >
      <label
        htmlFor="csv-file"
        className="group flex cursor-pointer flex-col items-center justify-center gap-2 rounded-ds-2xl border border-dashed border-ds-stroke-strong bg-ds-surface px-6 py-10 text-center transition hover:border-brand-400/50 hover:bg-brand-400/[0.06] dark:bg-white/[0.02]"
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-ds-xl bg-gradient-to-br from-brand-300/30 to-brand-500/10 ring-1 ring-brand-400/30">
          <UploadCloud className="h-5 w-5 text-brand-700 dark:text-brand-300" strokeWidth={1.75} aria-hidden />
        </span>
        <div>
          <p className="text-ds-sm font-semibold text-ds-body">
            {fileName ?? 'Solte o CSV aqui ou clique para selecionar'}
          </p>
          <p className="text-ds-xs text-ds-subtle">Formato: block, number, type, status</p>
        </div>
        <input
          id="csv-file"
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
      </label>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={downloadTemplate}
          className="px-0 text-brand-700 hover:text-brand-600 dark:text-brand-300 dark:hover:text-brand-200"
        >
          ↓ Baixar modelo de planilha
        </Button>
        {csvText ? (
          <span className="text-ds-xs text-ds-dim">
            {csvText.split('\n').filter((l) => l.trim()).length - 1} linhas detectadas
          </span>
        ) : null}
      </div>

      <Button
        variant="gradient"
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending || !csvText.trim()}
        className="w-full"
      >
        {mutation.isPending ? 'Importando…' : 'Importar unidades'}
      </Button>
    </motion.div>
  );
}

function ManualMode({ condominiumId, onCreated }: { condominiumId: string | null; onCreated: () => void }) {
  const [block, setBlock] = useState('');
  const [number, setNumber] = useState('');

  const mutation = useMutation({
    mutationFn: async () => {
      if (!condominiumId) throw new Error('missing condominium');
      return unitsService.create(condominiumId, {
        block: block.trim(),
        number: number.trim(),
        type: 'APARTMENT',
        status: 'VACANT',
      });
    },
    onSuccess: () => {
      setBlock('');
      setNumber('');
      onCreated();
    },
    onError: () => toast.error('Não foi possível criar a unidade.'),
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-ds-2xl border border-ds-stroke-subtle bg-ds-surface dark:bg-white/[0.02] p-5"
    >
      <div className="grid grid-cols-1 gap-3 ds-sm:grid-cols-[140px_1fr_auto]">
        <FormField label="Bloco" htmlFor="man-block">
          <Input id="man-block" value={block} onChange={(e) => setBlock(e.target.value)} placeholder="A" />
        </FormField>
        <FormField label="Número" htmlFor="man-number">
          <Input id="man-number" value={number} onChange={(e) => setNumber(e.target.value)} placeholder="101" />
        </FormField>
        <div className="flex items-end">
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !block.trim() || !number.trim()}
            className="w-full ds-sm:w-auto"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
            Adicionar
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

interface PreviewUnit {
  id: string;
  block: string;
  number: string;
}

function UnitsPreview({ units, total }: { units: PreviewUnit[]; total: number }) {
  if (total === 0) {
    return (
      <div className="flex items-center gap-3 rounded-ds-2xl border border-ds-stroke-subtle bg-ds-surface dark:bg-white/[0.02] px-4 py-3.5">
        <Building2 className="h-4 w-4 text-ds-subtle" strokeWidth={1.75} aria-hidden />
        <p className="text-ds-sm text-ds-dim">Nenhuma unidade ainda. Use uma das opções acima para começar.</p>
      </div>
    );
  }

  const visible = units.slice(0, 16);
  const more = total - visible.length;

  return (
    <div className="rounded-ds-2xl border border-ds-stroke-subtle bg-ds-surface dark:bg-white/[0.02] p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-ds-sm font-semibold text-ds-body">
          {total} unidade{total === 1 ? '' : 's'} cadastrada{total === 1 ? '' : 's'}
        </p>
        {more > 0 ? <span className="text-ds-xs text-ds-subtle">mostrando {visible.length}</span> : null}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {visible.map((unit) => (
          <span
            key={unit.id}
            className="inline-flex items-center gap-1 rounded-ds-md border border-ds-stroke bg-ds-elevated px-2.5 py-1 text-ds-xs font-semibold text-ds-body dark:bg-white/[0.04]"
          >
            {unit.block}-{unit.number}
            <X className="h-3 w-3 text-ds-subtle/60" aria-hidden />
          </span>
        ))}
        {more > 0 ? (
          <span className="inline-flex items-center rounded-ds-md border border-brand-400/30 bg-brand-400/10 px-2.5 py-1 text-ds-xs font-semibold text-brand-200">
            +{more} mais
          </span>
        ) : null}
      </div>
    </div>
  );
}
