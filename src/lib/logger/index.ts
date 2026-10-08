import "server-only";
import pino from "pino";
import pretty from "pino-pretty";
import { env } from "@/lib/config/env";
import { DEFAULT_REDACT_KEYS, parseRedactKeys, redact } from "./redact";

// Fallbacks cover builds with SKIP_ENV_VALIDATION=1 (no defaults applied).
const redactKeys = parseRedactKeys(env.LOG_REDACT_KEYS ?? DEFAULT_REDACT_KEYS);

/**
 * Server-side structured logger. LOG_FORMAT=pretty for local development,
 * json for servers and log collectors. Sensitive keys are masked at any depth.
 */
export const logger = pino(
  {
    level: env.LOG_LEVEL ?? "info",
    base: { service: "codebase-fe" },
    formatters: {
      log: (obj) => redact(obj, redactKeys) as Record<string, unknown>,
    },
  },
  env.LOG_FORMAT !== "json"
    ? pretty({ colorize: true, singleLine: true, translateTime: "SYS:HH:MM:ss", ignore: "pid,hostname,service" })
    : undefined,
);
