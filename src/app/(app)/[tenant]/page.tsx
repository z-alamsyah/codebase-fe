import Link from "next/link";
import { requireTenant } from "@/lib/auth/session";

export default async function TenantHomePage({ params }: PageProps<"/[tenant]">) {
  const { tenant } = await params;
  const user = await requireTenant(tenant);
  return (
    <div className="space-y-3">
      <h1 className="text-xl font-semibold">Tenant {tenant}</h1>
      <p className="text-muted-foreground">Your roles: {user.tenants[tenant]?.join(", ")}</p>
      <Link className="text-primary underline-offset-4 hover:underline" href={`/${tenant}/users/new`}>
        Create a user
      </Link>
    </div>
  );
}
