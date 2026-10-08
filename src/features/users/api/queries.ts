import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createUserMutation, getUserOptions } from "@/lib/api/generated/@tanstack/react-query.gen";

/** Every backend call is scoped to the active tenant. */
export function tenantHeaders(tenant: string) {
  return { "X-Tenant-ID": tenant };
}

/** Query options for one user. The query key includes the tenant, so tenants never share cache entries. */
export function userQueryOptions(tenant: string, id: string) {
  return getUserOptions({ path: { id }, headers: tenantHeaders(tenant) });
}

export function useUser(tenant: string, id: string) {
  return useQuery(userQueryOptions(tenant, id));
}

export function useCreateUser(tenant: string) {
  const queryClient = useQueryClient();
  return useMutation({
    ...createUserMutation({ headers: tenantHeaders(tenant) }),
    onSuccess: (res) => {
      // The response already holds the new user: seed the detail page cache.
      if (res.data) queryClient.setQueryData(userQueryOptions(tenant, res.data.id).queryKey, res);
    },
  });
}
