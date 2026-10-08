const ROLES_CLAIM = "urn:zitadel:iam:org:project:roles";

/** Tenant (Zitadel organization ID) -> role keys, read from a token's roles claim. */
export function tenantsFromClaims(claims: Record<string, unknown> | undefined): Record<string, string[]> {
  const roles = (claims?.[ROLES_CLAIM] ?? {}) as Record<string, Record<string, string>>;
  const tenants: Record<string, string[]> = {};
  for (const [role, orgs] of Object.entries(roles)) {
    for (const orgId of Object.keys(orgs)) (tenants[orgId] ??= []).push(role);
  }
  return tenants;
}
