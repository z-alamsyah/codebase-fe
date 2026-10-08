import { NextResponse } from "next/server";
import { buildLogoutUrl } from "@/lib/auth";
import { env } from "@/lib/config/env";

/**
 * Returns the Zitadel end-session URL; the browser then navigates there
 * (see LogoutButton). A form POST that redirects to Zitadel and back is
 * blocked by Chrome's CSP form-action check on the final hop, so logout uses
 * fetch + navigation instead.
 */
export async function POST(req: Request) {
  // Only our own pages may log the user out (CSRF protection).
  if (req.headers.get("origin") !== new URL(env.AUTH_URL).origin) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "bad origin" }, meta: {} }, { status: 403 });
  }

  const { url, state } = await buildLogoutUrl(req);
  const res = NextResponse.json({ url });
  res.cookies.set("logout_state", state, {
    httpOnly: true,
    secure: env.AUTH_URL.startsWith("https://"),
    sameSite: "lax",
    path: "/api/auth/logout/callback",
  });
  return res;
}
