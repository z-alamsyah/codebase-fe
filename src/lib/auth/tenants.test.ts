import { describe, expect, it } from "vitest";
import { tenantsFromClaims } from "./tenants";

describe("tenantsFromClaims", () => {
  it("turns Zitadel's roles claim into tenant -> roles", () => {
    const claims = {
      "urn:zitadel:iam:org:project:roles": {
        admin: { "org-a": "tenant-a.localhost" },
        viewer: { "org-a": "tenant-a.localhost", "org-b": "tenant-b.localhost" },
      },
    };
    expect(tenantsFromClaims(claims)).toEqual({ "org-a": ["admin", "viewer"], "org-b": ["viewer"] });
  });

  it("returns no tenants when the claim is missing", () => {
    expect(tenantsFromClaims({})).toEqual({});
    expect(tenantsFromClaims(undefined)).toEqual({});
  });
});
