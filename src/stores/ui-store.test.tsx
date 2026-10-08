import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Sidebar } from "@/components/layout/sidebar";
import { createUiStore } from "./ui-store";
import { UiStoreProvider, useUiStore } from "./ui-store-provider";

vi.mock("next/navigation", () => ({ usePathname: () => "/t1" }));

describe("ui store", () => {
  it("toggles the sidebar", () => {
    const store = createUiStore();
    expect(store.getState().sidebarOpen).toBe(true);
    store.getState().toggleSidebar();
    expect(store.getState().sidebarOpen).toBe(false);
  });

  it("gives every provider its own store (no state shared between requests)", () => {
    const a = createUiStore();
    const b = createUiStore();
    a.getState().toggleSidebar();
    expect(b.getState().sidebarOpen).toBe(true);
  });

  it("drives the sidebar through the provider", async () => {
    render(
      <UiStoreProvider>
        <Sidebar tenant="t1" />
      </UiStoreProvider>,
    );
    expect(screen.getByRole("link", { name: "Create user" })).toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole("button", { name: "Toggle sidebar" }));

    expect(screen.queryByRole("link", { name: "Create user" })).not.toBeInTheDocument();
  });

  it("fails loudly when used outside the provider", () => {
    function Reader() {
      useUiStore((s) => s.sidebarOpen);
      return null;
    }
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Reader />)).toThrow("useUiStore must be used within UiStoreProvider");
  });
});
