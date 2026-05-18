import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import {
  Outlet,
  useLocation,
  useNavigate,
  useNavigationType,
} from 'react-router-dom';
import { useCallback, useEffect, useRef, useState } from 'react';
import { condominiumsService } from '@/domains/condominiums/services/condominiums.service';
import { useAuthStore } from '@/shared/stores/auth.store';
import { Header } from '@/shared/components/layout/Header';
import { MobileQuickNav } from '@/shared/components/layout/MobileQuickNav';
import { Sidebar } from '@/shared/components/layout/Sidebar';
import { CommandPalette } from '@/shared/components/layout/CommandPalette';
import { PwaInstallBanner } from '@/shared/components/layout/PwaInstallBanner';
import { useCommandPaletteShortcut } from '@/shared/hooks/useCommandPaletteShortcut';
import { useNotificationsRealtime } from '@/domains/notifications/hooks/useNotificationsRealtime';
import { Spinner } from '@/shared/components/ui/Spinner';
import { queryKeys } from '@/shared/lib/queryKeys';

/** `pb` considera tab bar fixa + safe area (notch/home indicator em PWA). */
const mainClassName =
  'flex-1 overflow-y-auto overflow-x-hidden px-3 pb-[calc(6rem+env(safe-area-inset-bottom,0px))] pt-3 ds-sm:px-4 ds-md:px-6 ds-md:pb-6 ds-md:pt-4';

function pendingListsEqual(
  a: { condominiumId: string }[] | undefined,
  b: { condominiumId: string }[] | undefined,
): boolean {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  return a.every((x, i) => x.condominiumId === b[i]?.condominiumId);
}

export function ProtectedLayout() {
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const location = useLocation();
  // POP = botão voltar do browser/gesto; PUSH = navegação pra frente.
  // REPLACE não tem direção — tratamos como PUSH (mais comum).
  const navType = useNavigationType();
  const direction = navType === 'POP' ? -1 : 1;
  const canCreateCondominium = useAuthStore((state) => state.canCreateCondominium);
  const activeCondominium = useAuthStore((state) => state.activeCondominium);
  const setActiveCondominium = useAuthStore((state) => state.setActiveCondominium);
  const setPendingMemberships = useAuthStore((state) => state.setPendingMemberships);
  const { data: condominiums, isLoading, isFetching } = useQuery({
    queryKey: queryKeys.condominiums.mine(),
    queryFn: condominiumsService.listMine,
  });
  const { data: pending, isLoading: pendingLoading, isFetching: pendingFetching } = useQuery({
    queryKey: queryKeys.condominiums.minePending(),
    queryFn: condominiumsService.listMyPending,
  });

  const [paletteOpen, setPaletteOpen] = useState(false);
  const emptyListNavigateDoneRef = useRef(false);
  const togglePalette = useCallback(() => setPaletteOpen((v) => !v), []);
  const openPalette = useCallback(() => setPaletteOpen(true), []);
  const closePalette = useCallback(() => setPaletteOpen(false), []);
  useCommandPaletteShortcut(togglePalette);
  // Mantém o socket de notificações aberto enquanto o usuário está no shell
  // autenticado — entrega real-time + atualiza badge sem polling agressivo.
  useNotificationsRealtime();

  useEffect(() => {
    if (!pending) return;
    const current = useAuthStore.getState().pendingMemberships;
    if (pendingListsEqual(current, pending)) return;
    setPendingMemberships(pending);
  }, [pending, setPendingMemberships]);

  useEffect(() => {
    if (!condominiums || !pending) return;
    // Não redireciona durante refetches em vôo. Cenário típico: usuário acabou
    // de finalizar o setup; o cache marcado como stale ainda mostra `[]`, mas
    // já existe uma requisição buscando o condomínio recém-criado — esperar
    // ela completar evita um redirect /setup espúrio.
    if (isFetching || pendingFetching) return;
    if (condominiums.length === 0) {
      if (emptyListNavigateDoneRef.current) return;
      emptyListNavigateDoneRef.current = true;
      // Sem memberships APROVADOS:
      // - Se há membership PENDING, vai para /no-condo (mostra "aguardando aprovação").
      // - Senão, se o usuário pode criar condomínio (realm role condo-admin), /setup.
      // - Caso contrário (morador sem convite), /no-condo (mostra orientação).
      if (pending.length > 0 || !canCreateCondominium) {
        navigate('/no-condo', { replace: true });
      } else {
        navigate('/setup', { replace: true });
      }
      return;
    }
    emptyListNavigateDoneRef.current = false;

    const first = condominiums[0];
    if (!first?.id) return;
    const activeId = activeCondominium?.id;
    const activeStillValid =
      Boolean(activeId) && condominiums.some((c) => c.id === activeId);
    if (activeStillValid) return;

    setActiveCondominium({
      id: first.id,
      name: first.name,
      role: first.role,
      unitId: first.unitId,
    });
  }, [
    activeCondominium,
    canCreateCondominium,
    condominiums,
    isFetching,
    navigate,
    pending,
    pendingFetching,
    setActiveCondominium,
  ]);

  if (isLoading || pendingLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="relative flex h-dvh overflow-hidden bg-transparent">
      <div className="pointer-events-none absolute -left-20 top-10 h-72 w-72 rounded-full bg-brand-400/10 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -right-32 top-1/3 h-96 w-96 rounded-full bg-brand-300/[0.06] blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-brand-600/10 blur-3xl" aria-hidden />
      <Sidebar onOpenCommandPalette={openPalette} />
      <main className="relative z-10 flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header onOpenCommandPalette={openPalette} />
        <MobileQuickNav />
        {reduce ? (
          <section className={mainClassName}>
            <Outlet />
          </section>
        ) : (
          // AnimatePresence + key=pathname → cada rota é um nó animado.
          // Em mobile: slide horizontal direcionado (forward = entra da
          // direita; back = entra da esquerda) imitando stack nativo.
          // Em ds-md+ (tablet+): fade vertical sutil (sem slide horizontal).
          <section className={mainClassName + ' relative'}>
            <AnimatePresence mode="wait" initial={false} custom={direction}>
              <motion.div
                key={location.pathname}
                custom={direction}
                initial={(d: number) => ({
                  opacity: 0,
                  x:
                    window.matchMedia('(min-width: 768px)').matches
                      ? 0
                      : 24 * d,
                  y: window.matchMedia('(min-width: 768px)').matches ? 8 : 0,
                })}
                animate={{ opacity: 1, x: 0, y: 0 }}
                exit={(d: number) => ({
                  opacity: 0,
                  x:
                    window.matchMedia('(min-width: 768px)').matches
                      ? 0
                      : -24 * d,
                  y: 0,
                })}
                transition={{ duration: 0.24, ease: [0.32, 0.72, 0, 1] }}
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </section>
        )}
      </main>
      <CommandPalette open={paletteOpen} onClose={closePalette} />
      <PwaInstallBanner />
    </div>
  );
}
