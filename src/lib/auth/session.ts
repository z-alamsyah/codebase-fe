import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAccessToken, getSession } from "./index";

/**
 * Data access layer for the session in Server Components. Every protected
 * page goes through these helpers (src/proxy.ts only redirects early).
 * With Cache Components, call them inside a <Suspense> boundary (or a route
 * segment with loading.tsx), because they read request cookies.
 */

export type CurrentUser = {
  name: string;
  email: string;
  tenants: Record<string, string[]>;
};

async function incomingRequest(): Promise<Request> {
  return new Request("http://internal", { headers: await headers() }); // only the cookie header is read
}

/** The logged-in user, or null (for public pages). */
export async function getOptionalUser(): Promise<CurrentUser | null> {
  const session = await getSession(await incomingRequest());
  if (!session?.user || session.error) return null;
  return {
    name: session.user.name ?? "",
    email: session.user.email ?? "",
    tenants: session.tenants ?? {},
  };
}

/** The logged-in user, or a redirect to /login. */
export async function getCurrentUser(): Promise<CurrentUser> {
  const user = await getOptionalUser();
  if (!user) redirect("/login");
  return user;
}

/** The logged-in user if they belong to tenant, otherwise /login or /forbidden. */
export async function requireTenant(tenant: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user.tenants[tenant]) redirect("/forbidden");
  return user;
}

/** Access token for calling the backend from the server. */
export async function getServerAccessToken(): Promise<string> {
  const token = await getAccessToken(await incomingRequest());
  if (!token) redirect("/login");
  return token;
}
