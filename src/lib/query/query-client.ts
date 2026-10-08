import { environmentManager, QueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/errors";

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Data prefetched on the server is not fetched again right away.
        staleTime: 60 * 1000,
        // Retry network errors and 5xx only; 4xx will not get better.
        retry: (failureCount, error) => !ApiError.from(error).isClientError && failureCount < 2,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

/** A new client per request on the server, one shared client in the browser. */
export function getQueryClient(): QueryClient {
  if (environmentManager.isServer()) return makeQueryClient();
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}
