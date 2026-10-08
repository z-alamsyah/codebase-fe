import { requireTenant } from "@/lib/auth/session";
import { CreateUserPanel } from "./create-user-panel";

export default async function NewUserPage({ params }: PageProps<"/[tenant]/users/new">) {
  const { tenant } = await params;
  await requireTenant(tenant);
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Create user</h1>
      <CreateUserPanel tenant={tenant} />
    </div>
  );
}
