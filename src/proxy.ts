import { NextRequest, NextResponse } from "next/server";
import { handlers } from "@/lib/auth";
import { env } from "@/lib/config/env";

const PUBLIC_PATHS = new Set(["/", "/login", "/forbidden", "/api/health"]);

/**
 * Runs before pages and the BFF:
 *  1. Asks Auth.js for the session the same way the browser would. This
 *     refreshes the access token when it is close to expiry; the updated
 *     cookie goes to the browser AND to the rest of this request. It is the
 *     only place that refreshes, because Server Components cannot set cookies
 *     and Zitadel invalidates a refresh token as soon as it is used.
 *  2. Redirects anonymous users away from protected pages (an early,
 *     optimistic check: pages and route handlers still check the session).
 *  3. Sets the Content-Security-Policy header.
 */
export async function proxy(req: NextRequest) {
  const sessionRes = await handlers.GET(
    new NextRequest(new URL("/api/auth/session", req.url), { headers: req.headers }),
  );
  const setCookies = sessionRes.headers.getSetCookie();
  const session = (await sessionRes.json().catch(() => null)) as { user?: unknown; error?: string } | null;
  const loggedIn = Boolean(session?.user) && !session?.error;

  const { pathname, search } = req.nextUrl;
  if (!loggedIn && !PUBLIC_PATHS.has(pathname)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "login required" }, meta: {} },
        { status: 401 },
      );
    }
    const login = new URL("/login", req.url);
    login.searchParams.set("callbackUrl", pathname + search);
    return withSecurityHeaders(NextResponse.redirect(login));
  }

  const headers = new Headers(req.headers);
  headers.set("cookie", mergeCookies(req.headers.get("cookie"), setCookies));
  const res = NextResponse.next({ request: { headers } });
  for (const c of setCookies) res.headers.append("set-cookie", c);
  return withSecurityHeaders(res);
}

export const config = {
  // Everything except Auth.js's own endpoints and static files.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};

function withSecurityHeaders(res: NextResponse): NextResponse {
  const dev = process.env.NODE_ENV === "development";
  const zitadel = new URL(env.ZITADEL_DOMAIN).origin;
  res.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      `connect-src 'self'${dev ? " ws: wss:" : ""}`,
      // The login form redirects to Zitadel.
      `form-action 'self' ${zitadel}`,
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "object-src 'none'",
    ].join("; "),
  );
  return res;
}

/** Applies Set-Cookie values to a Cookie header (expired cookies are removed). */
function mergeCookies(cookieHeader: string | null, setCookies: string[]): string {
  const jar = new Map<string, string>();
  for (const part of (cookieHeader ?? "").split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name) jar.set(name, value.join("="));
  }
  for (const sc of setCookies) {
    const [pair, ...attrs] = sc.split(";");
    const [name, ...value] = pair.trim().split("=");
    const expired = attrs.some((a) => /^\s*max-age=0\s*$/i.test(a) || /^\s*expires=thu, 01 jan 1970/i.test(a));
    if (expired) jar.delete(name);
    else jar.set(name, value.join("="));
  }
  return [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
}
