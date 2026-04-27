import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, HelpCircle, X } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  usePwaInstall,
  type BeforeInstallPromptEventLike,
} from '@/shared/hooks/usePwaInstall';
import { useUIStore } from '@/shared/stores/ui.store';
import { Button } from '@/shared/components/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/Dialog';
import { cn } from '@/shared/utils/cn';

/**
 * Convite à instalação PWA: banner acima da tab bar (mobile) e diálogo com instruções
 * (Safari iOS / navegadores sem `beforeinstallprompt`).
 */
export function PwaInstallBanner() {
  const {
    deferred,
    isStandalone,
    isIos,
    shouldOfferSoftPrompt,
    dismissForDays,
    promptNativeInstall,
  } = usePwaInstall();

  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    return useUIStore.subscribe((state, prev) => {
      if (state.pwaInstallHelpSignal > prev.pwaInstallHelpSignal) {
        queueMicrotask(() => setDialogOpen(true));
      }
    });
  }, []);

  if (isStandalone) {
    return (
      <PwaInstallInstructionsDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        isIos={isIos}
        hasNativePrompt={Boolean(deferred)}
      />
    );
  }

  return (
    <>
      <AnimatePresence>
        {shouldOfferSoftPrompt ? (
          <PwaInstallSoftOffer
            key="pwa-install-offer"
            deferred={deferred}
            dismissForDays={dismissForDays}
            promptNativeInstall={promptNativeInstall}
            onOpenHelp={() => setDialogOpen(true)}
          />
        ) : null}
      </AnimatePresence>

      <PwaInstallInstructionsDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        isIos={isIos}
        hasNativePrompt={Boolean(deferred)}
      />
    </>
  );
}

function PwaInstallSoftOffer({
  deferred,
  dismissForDays,
  promptNativeInstall,
  onOpenHelp,
}: {
  deferred: BeforeInstallPromptEventLike | null;
  dismissForDays: (days: number) => void;
  promptNativeInstall: () => Promise<{ outcome: 'accepted' | 'dismissed' | 'unavailable' | 'error' }>;
  onOpenHelp: () => void;
}) {
  const [sessionHidden, setSessionHidden] = useState(false);

  return (
    <AnimatePresence>
      {!sessionHidden ? (
        <motion.div
          key="pwa-install-panel"
          role="region"
          aria-label="Instalar aplicativo CondoSync"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{
            delay: 4,
            type: 'spring',
            stiffness: 420,
            damping: 32,
          }}
          className={cn(
            'fixed inset-x-3 z-[38] max-w-lg rounded-ds-xl border border-ds-stroke/80 bg-[var(--ds-pwa-offer-bg)] px-4 py-3 shadow-ds-elev backdrop-blur-xl',
            'bottom-[calc(5.25rem+env(safe-area-inset-bottom,0px))] ds-md:bottom-6 ds-md:left-auto ds-md:right-6 ds-md:max-w-md',
          )}
        >
      <div className="flex gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-ds-lg bg-gradient-to-br from-brand-400/30 to-brand-600/20 ring-1 ring-brand-400/25">
          <Download className="h-5 w-5 text-brand-200" strokeWidth={2} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-ds-sm font-semibold text-ds-body">Instalar o CondoSync</p>
          <p className="mt-0.5 text-ds-xs leading-relaxed text-ds-dim">
            {deferred
              ? 'Use como app no celular ou computador: ícone na tela inicial, abre em tela cheia e carrega mais rápido.'
              : 'No iPhone ou iPad, adicione à Tela de Início pelo menu Compartilhar do Safari.'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {deferred ? (
              <Button
                size="sm"
                variant="gradient"
                onClick={async () => {
                  const r = await promptNativeInstall();
                  if (r.outcome === 'accepted') {
                    toast.success('Instalação iniciada. Confirme na janela do navegador.');
                    setSessionHidden(true);
                  } else if (r.outcome === 'dismissed') {
                    toast('Instalação cancelada.', { icon: 'ℹ️' });
                  }
                }}
              >
                Instalar
              </Button>
            ) : (
              <Button size="sm" variant="gradient" onClick={onOpenHelp}>
                Ver como instalar
              </Button>
            )}
            <Button size="sm" variant="secondary" onClick={onOpenHelp}>
              <HelpCircle className="h-3.5 w-3.5" aria-hidden />
              Instruções
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-ds-dim"
              onClick={() => {
                dismissForDays(14);
                setSessionHidden(true);
              }}
            >
              Depois
            </Button>
          </div>
        </div>
        <button
          type="button"
          className="shrink-0 rounded-ds-md p-1 text-ds-subtle transition hover:bg-white/[0.06] hover:text-ds-body"
          aria-label="Fechar convite de instalação"
          onClick={() => {
            dismissForDays(14);
            setSessionHidden(true);
          }}
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function PwaInstallInstructionsDialog({
  open,
  onOpenChange,
  isIos,
  hasNativePrompt,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  isIos: boolean;
  hasNativePrompt: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md min-w-0">
        <DialogHeader>
          <DialogTitle>Instalar o CondoSync</DialogTitle>
          <DialogDescription>
            O CondoSync é um aplicativo web (PWA). Você pode fixá-lo na tela inicial como um app nativo.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-ds-sm text-ds-dim">
          {hasNativePrompt ? (
            <section>
              <p className="font-semibold text-ds-body">Android / Chrome / Edge</p>
              <ol className="mt-2 list-decimal space-y-1.5 pl-4">
                <li>
                  Toque em <strong className="text-ds-body">Instalar</strong> no aviso acima ou use o menu do
                  navegador (⋮ ou ⋯).
                </li>
                <li>Confirme na janela do sistema.</li>
              </ol>
            </section>
          ) : null}
          {isIos ? (
            <section>
              <p className="font-semibold text-ds-body">iPhone e iPad (Safari)</p>
              <ol className="mt-2 list-decimal space-y-1.5 pl-4">
                <li>
                  Toque no botão <strong className="text-ds-body">Compartilhar</strong> (quadrado com seta para cima)
                  na barra inferior.
                </li>
                <li>
                  Role a lista e escolha <strong className="text-ds-body">Adicionar à Tela de Início</strong>.
                </li>
                <li>
                  Confirme com <strong className="text-ds-body">Adicionar</strong> no canto superior direito.
                </li>
              </ol>
            </section>
          ) : (
            <section>
              <p className="font-semibold text-ds-body">Outros navegadores</p>
              <p className="mt-2">
                Procure no menu do navegador por “Instalar aplicativo”, “Adicionar à tela inicial” ou equivalente. Se
                não aparecer, continue usando pelo navegador — todas as funções seguem disponíveis.
              </p>
            </section>
          )}
        </div>
        <div className="flex justify-end pt-2">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Entendi
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
