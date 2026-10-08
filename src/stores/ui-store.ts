import { createStore, useSelector } from "@tanstack/react-store";

/**
 * Global client-side UI state (TanStack Store). Keep it small: server data
 * belongs in TanStack Query, filters and pagination belong in the URL.
 * @tanstack/react-store is still 0.x, so all usage goes through this file.
 */
type UiState = {
  sidebarOpen: boolean;
};

const uiStore = createStore<UiState>({ sidebarOpen: true });

export function useSidebarOpen(): boolean {
  return useSelector(uiStore, (s) => s.sidebarOpen);
}

export function toggleSidebar(): void {
  uiStore.setState((s) => ({ ...s, sidebarOpen: !s.sidebarOpen }));
}
