// https://zitadel.com/docs/apis/openidoauth/scopes
export function zitadelScopes(projectId: string): string {
  return [
    "openid",
    "profile",
    "email",
    "offline_access", // refresh token
    "urn:zitadel:iam:org:projects:roles", // roles per organization (tenant)
    "urn:zitadel:iam:user:resourceowner", // the organization the user belongs to
    `urn:zitadel:iam:org:project:id:${projectId}:aud`, // the backend checks this audience
  ].join(" ");
}
