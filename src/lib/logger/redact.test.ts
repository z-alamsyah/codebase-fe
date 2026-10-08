import { describe, expect, it } from "vitest";
import { parseRedactKeys, REDACTED, redact } from "./redact";

describe("redact", () => {
  const keys = parseRedactKeys(" Password, token ,authorization");

  it("masks sensitive keys at any depth, case-insensitive", () => {
    const input = {
      user: { name: "a", PASSWORD: "p" },
      items: [{ token: "t" }, { ok: 1 }],
      headers: { Authorization: "Bearer x" },
    };
    expect(redact(input, keys)).toEqual({
      user: { name: "a", PASSWORD: REDACTED },
      items: [{ token: REDACTED }, { ok: 1 }],
      headers: { Authorization: REDACTED },
    });
  });

  it("does not modify the input", () => {
    const input = { password: "p" };
    redact(input, keys);
    expect(input.password).toBe("p");
  });

  it("keeps non-object values", () => {
    expect(redact("text", keys)).toBe("text");
    expect(redact(null, keys)).toBeNull();
  });
});
