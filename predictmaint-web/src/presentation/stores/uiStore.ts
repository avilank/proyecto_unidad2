import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface UiState {
  /** Desktop: true = ancho completo, false = solo iconos */
  sidebarExpanded: boolean;
  /** Mobile: drawer lateral abierto */
  mobileNavOpen: boolean;
  toggleSidebarExpanded: () => void;
  setSidebarExpanded: (expanded: boolean) => void;
  toggleMobileNav: () => void;
  setMobileNavOpen: (open: boolean) => void;
  closeMobileNav: () => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarExpanded: true,
      mobileNavOpen: false,
      toggleSidebarExpanded: () => set((s) => ({ sidebarExpanded: !s.sidebarExpanded })),
      setSidebarExpanded: (expanded) => set({ sidebarExpanded: expanded }),
      toggleMobileNav: () => set((s) => ({ mobileNavOpen: !s.mobileNavOpen })),
      setMobileNavOpen: (open) => set({ mobileNavOpen: open }),
      closeMobileNav: () => set({ mobileNavOpen: false }),
    }),
    {
      name: 'predictmaint-ui',
      partialize: (state) => ({ sidebarExpanded: state.sidebarExpanded }),
      storage: createJSONStorage(() =>
        typeof window !== 'undefined'
          ? window.localStorage
          : {
              getItem: () => null,
              setItem: () => {},
              removeItem: () => {},
            },
      ),
      migrate: (persisted) => {
        const state = persisted as Record<string, unknown> | undefined;
        if (state && 'sidebarOpen' in state && !('sidebarExpanded' in state)) {
          return { sidebarExpanded: state.sidebarOpen as boolean };
        }
        return state as { sidebarExpanded: boolean };
      },
      version: 1,
    },
  ),
);
