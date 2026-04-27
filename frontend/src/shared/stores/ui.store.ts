import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type UITheme = 'dark' | 'light';

interface UIStore {
  sidebarOpen: boolean;
  theme: UITheme;
  /** Incrementado para abrir o sheet de instalação PWA a partir de Configurações. */
  pwaInstallHelpSignal: number;
  toggleSidebar: () => void;
  setTheme: (theme: UITheme) => void;
  openPwaInstallHelp: () => void;
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      theme: 'dark',
      pwaInstallHelpSignal: 0,
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setTheme: (theme) => set({ theme }),
      openPwaInstallHelp: () =>
        set((state) => ({ pwaInstallHelpSignal: state.pwaInstallHelpSignal + 1 })),
    }),
    {
      name: 'condosync-ui',
      partialize: (state) => ({ theme: state.theme }),
    },
  ),
);
