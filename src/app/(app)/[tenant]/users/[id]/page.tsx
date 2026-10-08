import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { prefetchUser } from "@/features/users/api/prefetch";
import { UserDetail } from "@/features/users/components/user-detail";
import { requireTenant } from "@/lib/auth/session";
import { getQueryClient } from "@/lib/query/query-client";

export default async function UserPage({ params }: PageProps<"/[tenant]/users/[id]">) {
  const { tenant, id } = await params;
  await requireTenant(tenant);

  // Fetch on the server; the client component reuses it from the cache.
  // prefetchQuery never throws: on error nothing is cached and UserDetail
  // fetches again in the browser, then renders the error state.
  const queryClient = getQueryClient();
  await prefetchUser(queryClient, tenant, id);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">User</h1>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <UserDetail tenant={tenant} id={id} />
      </HydrationBoundary>
    </div>
  );
}
