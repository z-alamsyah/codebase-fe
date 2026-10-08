import { describe, expect, it } from "vitest";
import { ApiError, userMessage } from "./errors";

describe("ApiError.from", () => {
  it("maps the backend error envelope, including field errors", () => {
    const err = ApiError.from({
      error: {
        code: "INVALID_INPUT",
        message: "request validation failed",
        details: [{ field: "email", message: "must be a valid email address" }],
      },
      meta: { request_id: "req-1" },
    });
    expect(err.code).toBe("INVALID_INPUT");
    expect(err.fieldErrors).toEqual({ email: "must be a valid email address" });
    expect(err.requestId).toBe("req-1");
    expect(err.isClientError).toBe(true);
  });

  it("treats unknown codes as INTERNAL and network failures as NETWORK", () => {
    expect(ApiError.from({ error: { code: "WEIRD", message: "x" }, meta: {} }).code).toBe("INTERNAL");
    const net = ApiError.from(new TypeError("fetch failed"));
    expect(net.code).toBe("NETWORK");
    expect(net.isClientError).toBe(false);
  });
});

describe("userMessage", () => {
  it("hides technical details of internal errors but shows the request id", () => {
    const err = new ApiError("INTERNAL", "pq: connection refused", {}, "req-9");
    expect(userMessage(err)).not.toContain("pq:");
    expect(userMessage(err)).toContain("req-9");
  });
});
