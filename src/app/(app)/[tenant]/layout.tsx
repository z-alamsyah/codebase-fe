import Link from "next/link";
import { Suspense } from "react";
import { LogoutButton } from "@/components/layout/logout-button";
import { Sidebar } from "@/components/layout/sidebar";
import { requireTenant } from "@/lib/auth/session";

/**
 * Shell for every tenant page. params and the session are request data, so
 * they are read inside <Suspense> boundaries instead of at the top level
 * (Cache Components keeps the rest of the shell static).
 */
export default function TenantLayout({ children, params }: LayoutProps<"/[tenant]">) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <Link href="/" className="font-semibold">
          codebase-fe
        </Link>
        <Suspense fallback={<span className="text-muted-foreground text-sm">…</span>}>
          {params.then(({ tenant }) => (
            <UserMenu tenant={tenant} />
          ))}
        </Suspense>
      </header>
      <div className="flex flex-1">
        <Suspense fallback={<aside className="w-56 border-r" />}>
          {params.then(({ tenant }) => (
            <Sidebar tenant={tenant} />
          ))}
        </Suspense>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}

async function UserMenu({ tenant }: { tenant: string }) {
  const user = await requireTenant(tenant);
  return (
    <div className="flex items-center gap-3 text-sm">
      <span>
        {user.name} · <span className="text-muted-foreground">{user.tenants[tenant]?.join(", ")}</span>
      </span>
      <LogoutButton />
    </div>
  );
}
