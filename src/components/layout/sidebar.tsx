"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useUiStore } from "@/stores/ui-store-provider";

export function Sidebar({ tenant }: { tenant: string }) {
  const open = useUiStore((s) => s.sidebarOpen);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const pathname = usePathname();
  const links = [
    { href: `/${tenant}`, label: "Overview" },
    { href: `/${tenant}/users/new`, label: "Create user" },
  ];

  return (
    <aside className={open ? "w-56 shrink-0 border-r p-4" : "w-14 shrink-0 border-r p-2"}>
      <Button variant="ghost" size="sm" onClick={toggleSidebar} aria-label="Toggle sidebar">
        {open ? "«" : "»"}
      </Button>
      {open && (
        <nav className="mt-4 flex flex-col gap-1">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={pathname === l.href ? "page" : undefined}
              className="hover:bg-muted rounded-md px-2 py-1.5 text-sm aria-[current=page]:font-semibold"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      )}
    </aside>
  );
}
