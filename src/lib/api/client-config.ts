import type { CreateClientConfig } from "./generated/client.gen";

/**
 * Default config of the generated client. In the browser every call goes to
 * the BFF (/api/backend/*), which adds the access token. Server code uses
 * `serverClient()` from '@/lib/backend' instead.
 */
export const createClientConfig: CreateClientConfig = (config) => ({
  ...config,
  baseUrl: "/api/backend",
  throwOnError: true,
});
