import { describe, expect, it } from "vitest";
import { createUserSchema, toCreateUserRequest } from "./create-user";

const valid = { name: "Andi", email: "andi@example.com", phone: "", password: "Password123!" };

describe("createUserSchema", () => {
  it("accepts valid input, with or without phone", () => {
    expect(createUserSchema.safeParse(valid).success).toBe(true);
    expect(createUserSchema.safeParse({ ...valid, phone: "+6281234567890" }).success).toBe(true);
  });

  it.each([
    ["name", { ...valid, name: "A" }],
    ["email", { ...valid, email: "nope" }],
    ["phone", { ...valid, phone: "0812" }],
    ["password", { ...valid, password: "short" }],
    ["password", { ...valid, password: "x".repeat(73) }],
  ])("rejects invalid %s", (field, input) => {
    const res = createUserSchema.safeParse(input);
    expect(res.success).toBe(false);
    expect(res.error?.issues[0]?.path).toEqual([field]);
  });
});

describe("toCreateUserRequest", () => {
  it("drops an empty phone and trims the name", () => {
    expect(toCreateUserRequest({ ...valid, name: " Andi " })).toEqual({
      name: "Andi",
      email: "andi@example.com",
      password: "Password123!",
    });
  });
});
