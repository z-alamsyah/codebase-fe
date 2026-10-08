"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { useStore } from "zustand";
import { createUiStore, type UiStore, type UiStoreApi } from "./ui-store";

const UiStoreContext = createContext<UiStoreApi | null>(null);

/** Creates one UI store per request (server) / per page load (browser). */
export function UiStoreProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => createUiStore());
  return <UiStoreContext value={store}>{children}</UiStoreContext>;
}

/** Reads from the UI store with a selector, so components re-render only when the selected value changes. */
export function useUiStore<T>(selector: (state: UiStore) => T): T {
  const store = useContext(UiStoreContext);
  if (!store) throw new Error("useUiStore must be used within UiStoreProvider");
  return useStore(store, selector);
}
