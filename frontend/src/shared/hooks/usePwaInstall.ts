import { useCallback, useEffect, useMemo, useState } from 'react';

const DISMISS_KEY = 'condosync-pwa-install-dismiss-until';

function readDismissUntil(): number {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return 0;
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function writeDismissUntil(ts: number) {
  try {
    localStorage.setItem(DISMISS_KEY, String(ts));
  } catch {
    /* ignore */
  }
}

function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && (navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints! > 1);
}

function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false;
  const mq = window.matchMedia?.('(display-mode: standalone)');
  if (mq?.matches) return true;
  return Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
}

/**
 * Atualiza `nowMs` quando o prazo de “dispensar banner” pode ter passado.
 * Não usa `useSyncExternalStore` com `Date.now()` no snapshot — isso retorna
 * valor novo a cada leitura e quebra o React (Maximum update depth exceeded).
 */
function useWallClockMsForDeadline(deadlineMs: number): number {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (typeof window === 'undefined' || deadlineMs <= 0) {
      setNowMs(Date.now());
      return;
    }
    const tick = () => setNowMs(Date.now());
    tick();
    const delay = deadlineMs - Date.now();
    const tid =
      delay > 0
        ? window.setTimeout(tick, Math.min(delay + 100, 2_147_483_647))
        : null;
    const iid = window.setInterval(tick, 60_000);
    return () => {
      if (tid !== null) window.clearTimeout(tid);
      window.clearInterval(iid);
    };
  }, [deadlineMs]);

  return deadlineMs > 0 ? nowMs : 0;
}

export type BeforeInstallPromptEventLike = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

/**
 * Instalação PWA: `beforeinstallprompt` (Chromium) ou instruções manuais (Safari iOS).
 */
export function usePwaInstall() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEventLike | null>(null);
  const [dismissUntil, setDismissUntil] = useState(() => readDismissUntil());

  const isStandalone = useMemo(() => isStandaloneDisplay(), []);
  const isIos = useMemo(() => isIosDevice(), []);

  useEffect(() => {
    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEventLike);
    };
    window.addEventListener('beforeinstallprompt', onBip);
    return () => window.removeEventListener('beforeinstallprompt', onBip);
  }, []);

  const nowMs = useWallClockMsForDeadline(dismissUntil);
  const isDismissed = dismissUntil > 0 && dismissUntil > nowMs;

  const dismissForDays = useCallback((days: number) => {
    const until = Date.now() + days * 86_400_000;
    writeDismissUntil(until);
    setDismissUntil(until);
  }, []);

  const clearDeferred = useCallback(() => setDeferred(null), []);

  const promptNativeInstall = useCallback(async () => {
    if (!deferred) return { outcome: 'unavailable' as const };
    try {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      setDeferred(null);
      return { outcome };
    } catch {
      setDeferred(null);
      return { outcome: 'error' as const };
    }
  }, [deferred]);

  /** Banner útil quando o Chromium oferece instalação, ou no iOS (instruções). */
  const shouldOfferSoftPrompt =
    !isStandalone &&
    !isDismissed &&
    (deferred !== null || isIos);

  return {
    deferred,
    isStandalone,
    isIos,
    isDismissed,
    shouldOfferSoftPrompt,
    dismissForDays,
    clearDeferred,
    promptNativeInstall,
  };
}
