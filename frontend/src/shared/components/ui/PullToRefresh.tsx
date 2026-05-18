import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/shared/utils/cn';

/**
 * Pull-to-refresh nativo-like, sem libs. Funcionamento:
 *
 *   1. Só ativa em touch devices e quando o scroll está no topo (scrollY === 0).
 *   2. Acompanha `touchstart` → `touchmove` calculando o delta vertical.
 *   3. Aplica `translateY` no conteúdo (com resistência: 0.45) até o `threshold`.
 *   4. Ao soltar com delta >= threshold, dispara `onRefresh()` e mantém o
 *      indicador travado até a promise resolver.
 *
 * Não usa scroll-snap nem `overscroll-behavior: contain` no wrapper — manter
 * fora pra que listas internas possam scrollar normal. O `<html>` já tem
 * `overscroll-behavior-y: none` pra impedir o pull-to-refresh do Safari.
 */
const THRESHOLD = 72;
const MAX_PULL = 120;
const RESISTANCE = 0.45;

export function PullToRefresh({
  onRefresh,
  children,
  className,
  disabled = false,
}: {
  onRefresh: () => Promise<unknown> | unknown;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef<number | null>(null);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const isAtTop = useCallback((): boolean => {
    // window scroll (page-level) ou container interno — checamos ambos.
    const scroller =
      document.scrollingElement ?? document.documentElement ?? document.body;
    return scroller.scrollTop <= 0;
  }, []);

  useEffect(() => {
    if (disabled) return;
    const el = containerRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      if (refreshing) return;
      if (!isAtTop()) return;
      startY.current = e.touches[0]?.clientY ?? null;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (refreshing) return;
      if (startY.current == null) return;
      const currentY = e.touches[0]?.clientY ?? startY.current;
      const delta = currentY - startY.current;
      if (delta <= 0) {
        setPull(0);
        return;
      }
      // Só "captura" o gesto quando o scroll está no topo.
      if (!isAtTop()) {
        startY.current = null;
        setPull(0);
        return;
      }
      e.preventDefault();
      const eased = Math.min(delta * RESISTANCE, MAX_PULL);
      setPull(eased);
    };

    const onTouchEnd = async () => {
      if (refreshing) return;
      if (startY.current == null) return;
      startY.current = null;
      if (pull >= THRESHOLD) {
        setRefreshing(true);
        try {
          await onRefresh();
        } finally {
          setRefreshing(false);
          setPull(0);
        }
      } else {
        setPull(0);
      }
    };

    // passive:false em touchmove pra poder chamar preventDefault.
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [disabled, isAtTop, onRefresh, pull, refreshing]);

  // Pega progresso 0..1 do indicador.
  const progress = Math.min(pull / THRESHOLD, 1);
  const visible = pull > 8 || refreshing;
  const offset = refreshing ? THRESHOLD : pull;

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* Indicador no topo — segue a posição do dedo, fica fixo ao refrescar */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center"
        style={{
          transform: `translateY(${offset - 36}px)`,
          opacity: visible ? 1 : 0,
          transition: refreshing
            ? 'transform 200ms ease-out, opacity 200ms ease-out'
            : 'opacity 200ms ease-out',
        }}
        aria-hidden={!visible}
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-ds-surface shadow-ds-elev ring-1 ring-ds-stroke/40 backdrop-blur">
          <Loader2
            className={cn(
              'h-4 w-4 text-brand-500 transition-transform',
              refreshing ? 'animate-spin' : '',
            )}
            style={{
              transform: refreshing
                ? undefined
                : `rotate(${progress * 360}deg)`,
            }}
          />
        </div>
      </div>

      {/* Conteúdo — desloca pra revelar o indicador */}
      <div
        style={{
          transform: refreshing
            ? `translateY(${THRESHOLD}px)`
            : pull > 0
              ? `translateY(${pull}px)`
              : undefined,
          transition: refreshing
            ? 'transform 200ms ease-out'
            : pull > 0
              ? undefined
              : 'transform 200ms ease-out',
        }}
      >
        {children}
      </div>
    </div>
  );
}
