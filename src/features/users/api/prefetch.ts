import "server-only";
import type { QueryClient } from "@tanstack/react-query";
import { getUser } from "@/lib/api/generated";
import { getServerAccessToken } from "@/lib/auth/session";
import { serverClient } from "@/lib/backend";
import { userQueryOptions } from "./queries";

/**
 * Prefetches a user on the server (calling the backend directly) under the
 * same query key the browser uses, so the page renders with data and the
 * client does not fetch again.
 */
export async function prefetchUser(queryClient: QueryClient, tenant: string, id: string): Promise<void> {
  const accessToken = await getServerAccessToken();
  // The token only authenticates the call; the result depends on tenant + id,
  // which are already part of the key (and must match the browser's key).
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  await queryClient.prefetchQuery({
    queryKey: userQueryOptions(tenant, id).queryKey,
    queryFn: async () => (await getUser({ client: serverClient(accessToken, tenant), path: { id } })).data,
  });
}
