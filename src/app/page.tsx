import Link from "next/link";
import { Suspense } from "react";
import { LogoutButton } from "@/components/layout/logout-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getOptionalUser } from "@/lib/auth/session";

export default function HomePage() {
  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 p-8">
      <h1 className="text-2xl font-semibold">codebase-fe</h1>
      <p className="text-muted-foreground">Next.js + TanStack frontend template for codebase-go, with Zitadel login.</p>
      {/* Reads the session, so it renders at request time behind a boundary. */}
      <Suspense fallback={<p className="text-muted-foreground">Checking session…</p>}>
        <TenantPicker />
      </Suspense>
    </main>
  );
}

async function TenantPicker() {
  const user = await getOptionalUser();
  if (!user) {
    return (
      <Button render={<Link href="/login" />} nativeButton={false}>
        Log in
      </Button>
    );
  }

  const tenants = Object.entries(user.tenants);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Hello {user.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {tenants.length === 0 ? (
          <p className="text-muted-foreground">You are not a member of any tenant yet.</p>
        ) : (
          <ul className="space-y-2">
            {tenants.map(([tenant, roles]) => (
              <li key={tenant}>
                <Link className="text-primary underline-offset-4 hover:underline" href={`/${tenant}`}>
                  Tenant {tenant}
                </Link>{" "}
                <span className="text-muted-foreground text-sm">({roles.join(", ")})</span>
              </li>
            ))}
          </ul>
        )}
        <LogoutButton />
      </CardContent>
    </Card>
  );
}
