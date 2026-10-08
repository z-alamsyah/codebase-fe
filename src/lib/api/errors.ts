import type { RestErrorResponse } from "@/lib/api/generated";

export type ApiErrorCode =
  "INVALID_INPUT" | "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "INTERNAL" | "NETWORK";

const KNOWN_CODES = new Set<string>([
  "INVALID_INPUT",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "INTERNAL",
]);

/**
 * The one place where backend errors become UI errors. The generated client
 * throws the backend's JSON envelope ({ error, meta }); network failures throw
 * a TypeError.
 */
export class ApiError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
    readonly fieldErrors: Record<string, string> = {},
    readonly requestId?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** 4xx errors: retrying will not help. */
  get isClientError(): boolean {
    return this.code !== "INTERNAL" && this.code !== "NETWORK";
  }

  static from(err: unknown): ApiError {
    if (err instanceof ApiError) return err;
    if (isErrorEnvelope(err)) {
      const { code, message, details } = err.error;
      const fieldErrors = Object.fromEntries((details ?? []).map((d) => [d.field, d.message]));
      return new ApiError(
        (KNOWN_CODES.has(code) ? code : "INTERNAL") as ApiErrorCode,
        message,
        fieldErrors,
        err.meta?.request_id,
      );
    }
    return new ApiError("NETWORK", "Cannot reach the server. Check your connection and try again.");
  }
}

function isErrorEnvelope(err: unknown): err is RestErrorResponse {
  return (
    typeof err === "object" &&
    err !== null &&
    "error" in err &&
    typeof (err as { error: unknown }).error === "object" &&
    typeof (err as { error: { code?: unknown } }).error?.code === "string"
  );
}

/** Message safe to show to users (no technical details). */
export function userMessage(error: ApiError): string {
  switch (error.code) {
    case "INVALID_INPUT":
      return "Some fields are not valid.";
    case "UNAUTHORIZED":
      return "Your session has ended. Please log in again.";
    case "FORBIDDEN":
      return "You do not have access to this.";
    case "NOT_FOUND":
      return "Not found.";
    case "CONFLICT":
      return error.message;
    case "NETWORK":
      return error.message;
    default:
      return `Something went wrong. Reference: ${error.requestId ?? "n/a"}`;
  }
}
