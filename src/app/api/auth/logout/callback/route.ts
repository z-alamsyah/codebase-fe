import { NextResponse, type NextRequest } from "next/server";

/** Zitadel redirects here after ending its session: verify state, then clear the local session. */
export async function GET(req: NextRequest) {
  const state = req.nextUrl.searchParams.get("state");
  const expected = req.cookies.get("logout_state")?.value;
  const res = NextResponse.redirect(new URL(state && state === expected ? "/" : "/?logout=error", req.url));
  res.cookies.delete("logout_state");
  for (const c of req.cookies.getAll()) {
    if (c.name.includes("authjs.")) res.cookies.delete(c.name);
  }
  return res;
}
