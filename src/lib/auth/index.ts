import "server-only";
import { NextAuth, type NextAuthConfig } from "@zitadel/next-auth";
import Zitadel from "@auth/core/providers/zitadel";
import { getToken, type JWT } from "@auth/core/jwt";
import { NextRequest } from "next/server";
import * as oidc from "openid-client";
import { env } from "@/lib/config/env";
import { logger } from "@/lib/logger";
import { zitadelScopes } from "./scopes";
import { tenantsFromClaims } from "./tenants";

/** Cookies get the __Secure- prefix when the app runs on https. */
function secureCookie(): boolean {
  return env.AUTH_URL.startsWith("https://");
}
const REFRESH_BEFORE_EXPIRY_MS = 60_000;

let oidcConfig: Promise<oidc.Configuration> | undefined;
function getOidcConfig(): Promise<oidc.Configuration> {
  oidcConfig ??= oidc.discovery(
    new URL(env.ZITADEL_DOMAIN),
    env.ZITADEL_CLIENT_ID,
    env.ZITADEL_CLIENT_SECRET,
    undefined,
    // Local Zitadel runs on plain http; never needed with https.
    env.ZITADEL_DOMAIN.startsWith("http://") ? { execute: [oidc.allowInsecureRequests] } : undefined,
  );
  return oidcConfig;
}

/**
 * Zitadel rotates refresh tokens: a used refresh token stops working at once.
 * Requests that arrive together (or shortly after each other) with the same old
 * refresh token must share ONE refresh result, otherwise all but the first fail
 * and the user is logged out. The cache covers one Node.js process; with
 * several instances use sticky sessions or a shared store.
 */
const refreshResults = new Map<string, { at: number; result: Promise<JWT> }>();
const SHARE_REFRESH_MS = 30_000;

function refreshAccessToken(token: JWT): Promise<JWT> {
  const key = token.refreshToken;
  if (!key) return Promise.resolve({ ...token, error: "RefreshAccessTokenError" });

  const now = Date.now();
  for (const [k, v] of refreshResults) if (now - v.at > SHARE_REFRESH_MS) refreshResults.delete(k);
  const shared = refreshResults.get(key);
  if (shared) return shared.result;

  const result = (async (): Promise<JWT> => {
    try {
      const res = await oidc.refreshTokenGrant(await getOidcConfig(), key);
      return {
        ...token,
        accessToken: res.access_token,
        idToken: res.id_token ?? token.idToken,
        refreshToken: res.refresh_token ?? token.refreshToken,
        expiresAt: Date.now() + (res.expires_in ?? 900) * 1000,
        tenants: res.id_token ? tenantsFromClaims(res.claims()) : token.tenants,
        error: undefined,
      };
    } catch (error) {
      logger.warn({ err: error }, "token refresh failed");
      return { ...token, error: "RefreshAccessTokenError" };
    }
  })();
  refreshResults.set(key, { at: now, result });
  return result;
}

export const authConfig: NextAuthConfig = {
  providers: [
    Zitadel({
      issuer: env.ZITADEL_DOMAIN,
      clientId: env.ZITADEL_CLIENT_ID,
      clientSecret: env.ZITADEL_CLIENT_SECRET,
      authorization: { params: { scope: zitadelScopes(env.ZITADEL_PROJECT_ID) } },
    }),
  ],
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  secret: env.AUTH_SECRET,
  pages: { signIn: "/login" },
  // Auth.js logs go through the app logger (with redaction).
  logger: {
    error: (error) => logger.error({ err: error }, "auth error"),
    warn: (code) => {
      // @zitadel/next-auth sets basePath itself, so Auth.js reports AUTH_URL as
      // redundant on every request. AUTH_URL is still needed (see onAppOrigin).
      if (code !== "env-url-basepath-redundant") logger.warn({ code }, "auth warning");
    },
    debug: (message, metadata) => logger.debug({ metadata }, message),
  },
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account) {
        // First request after login: keep the tokens on the server side of the cookie.
        return {
          ...token,
          idToken: account.id_token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          expiresAt: account.expires_at ? account.expires_at * 1000 : Date.now() + 900_000,
          tenants: tenantsFromClaims(profile as Record<string, unknown>),
        };
      }
      if (Date.now() < (token.expiresAt ?? 0) - REFRESH_BEFORE_EXPIRY_MS) return token;
      return refreshAccessToken(token);
    },
    async session({ session, token }) {
      // Only non-secret data goes to the browser.
      session.tenants = token.tenants;
      session.error = token.error;
      return session;
    },
  },
};

const auth = NextAuth(authConfig);

/**
 * Auth.js builds its callback URL from the incoming request URL. In the
 * standalone server or behind a reverse proxy that URL is the internal one
 * (e.g. http://0.0.0.0:3000), which Zitadel rejects as an unknown redirect
 * URI. Every request handed to Auth.js is therefore rebased on AUTH_URL.
 */
async function onAppOrigin(req: NextRequest): Promise<NextRequest> {
  const url = new URL(req.url);
  const app = new URL(env.AUTH_URL);
  url.protocol = app.protocol;
  url.host = app.host;
  const body = req.method === "GET" || req.method === "HEAD" ? undefined : await req.arrayBuffer();
  return new NextRequest(url, { method: req.method, headers: req.headers, body });
}

export const handlers = {
  GET: async (req: NextRequest) => auth.handlers.GET(await onAppOrigin(req)),
  POST: async (req: NextRequest) => auth.handlers.POST(await onAppOrigin(req)),
};

export const getSession = auth.getSession;

/**
 * Returns the access token of the request's session, or null. Does not
 * refresh: src/proxy.ts refreshes before pages and route handlers run.
 */
export async function getAccessToken(req: Request | { headers: Headers }): Promise<string | null> {
  const token = await getToken({ req, secret: env.AUTH_SECRET, secureCookie: secureCookie() });
  if (!token?.accessToken || token.error) return null;
  return token.accessToken;
}

/** URL that also ends the Zitadel session, plus a state value to verify on return. */
export async function buildLogoutUrl(req: Request): Promise<{ url: string; state: string }> {
  const token = await getToken({ req, secret: env.AUTH_SECRET, secureCookie: secureCookie() });
  const state = crypto.randomUUID();
  const url = oidc.buildEndSessionUrl(await getOidcConfig(), {
    ...(token?.idToken ? { id_token_hint: token.idToken } : {}),
    post_logout_redirect_uri: `${env.AUTH_URL}/api/auth/logout/callback`,
    state,
  });
  return { url: url.toString(), state };
}
