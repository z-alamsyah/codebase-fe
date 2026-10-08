export const REDACTED = "[REDACTED]";

export const DEFAULT_REDACT_KEYS =
  "password,token,access_token,refresh_token,id_token,secret,authorization,cookie,pin,otp,cvv,card_number";

/** Returns a copy of value with every sensitive key masked, at any depth. */
export function redact(value: unknown, keys: ReadonlySet<string>): unknown {
  if (Array.isArray(value)) return value.map((v) => redact(v, keys));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = keys.has(k.toLowerCase()) ? REDACTED : redact(v, keys);
    }
    return out;
  }
  return value;
}

export function parseRedactKeys(csv: string): Set<string> {
  return new Set(
    csv
      .split(",")
      .map((k) => k.trim().toLowerCase())
      .filter(Boolean),
  );
}
