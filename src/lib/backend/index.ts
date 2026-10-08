import "server-only";
import { createClient, createConfig } from "@/lib/api/generated/client";
import { env } from "@/lib/config/env";

/** Headers sent to the backend on behalf of the user. */
export function backendHeaders(accessToken: string, tenantId?: string, requestId?: string): Headers {
  const headers = new Headers({ Authorization: `Bearer ${accessToken}` });
  if (tenantId) headers.set("X-Tenant-ID", tenantId);
  headers.set("X-Request-Id", requestId ?? crypto.randomUUID());
  return headers;
}

/**
 * Generated API client that calls the backend directly from the server
 * (Server Components). The browser uses the default client, which goes
 * through the BFF at /api/backend.
 */
export function serverClient(accessToken: string, tenantId?: string) {
  return createClient(
    createConfig({
      baseUrl: env.BACKEND_URL,
      headers: Object.fromEntries(backendHeaders(accessToken, tenantId)),
      throwOnError: true,
      cache: "no-store",
    }),
  );
}
