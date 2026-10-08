import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";
// Relative import: this file is also loaded by next.config.ts, where "@/" is not resolved.
import { DEFAULT_REDACT_KEYS } from "../logger/redact";

/**
 * Server environment, validated on first use (and at build time through
 * next.config.ts). Nothing here is exposed to the browser: values that differ
 * per environment are read at runtime on the server, so one image can run
 * everywhere.
 */
export const env = createEnv({
  server: {
    AUTH_URL: z.url(),
    AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
    ZITADEL_DOMAIN: z.url(),
    ZITADEL_CLIENT_ID: z.string().min(1),
    ZITADEL_CLIENT_SECRET: z.string().min(1),
    ZITADEL_PROJECT_ID: z.string().min(1),
    BACKEND_URL: z.url(),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
    LOG_FORMAT: z.enum(["pretty", "json"]).default("pretty"),
    LOG_REDACT_KEYS: z.string().default(DEFAULT_REDACT_KEYS),
  },
  client: {},
  experimental__runtimeEnv: {},
  // Docker/CI builds run without real secrets; validation then happens at runtime.
  // Defaults above are not applied when skipped, so code that runs at import
  // time must not rely on them.
  skipValidation: process.env.SKIP_ENV_VALIDATION === "1",
  emptyStringAsUndefined: true,
});
