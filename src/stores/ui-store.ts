import { createStore } from "zustand/vanilla";

/**
 * Global client-side UI state (Zustand). Keep it small: server data belongs
 * in TanStack Query, filters and pagination belong in the URL.
 *
 * The store is created per request through UiStoreProvider instead of being a
 * module-level global: a Next.js server renders many requests at once, and a
 * global store would share state between users.
 */
export type UiState = {
  sidebarOpen: boolean;
};

export type UiActions = {
  toggleSidebar: () => void;
};

export type UiStore = UiState & UiActions;

export const defaultUiState: UiState = { sidebarOpen: true };

export function createUiStore(initState: UiState = defaultUiState) {
  return createStore<UiStore>()((set) => ({
    ...initState,
    toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  }));
}

export type UiStoreApi = ReturnType<typeof createUiStore>;
