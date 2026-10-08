import { getAccessToken, getSession } from "@/lib/auth";
import { backendHeaders } from "@/lib/backend";
import { env } from "@/lib/config/env";
import { logger } from "@/lib/logger";

/**
 * BFF: the browser calls /api/backend/<backend path>. This handler adds the
 * user's access token (never exposed to the browser), the active tenant and a
 * request id, then streams the backend response back.
 */

// Only these backend paths may be reached through the BFF.
const ALLOWED_PREFIXES = ["api/v1/"];

function errorResponse(status: number, code: string, message: string) {
  return Response.json({ error: { code, message }, meta: {} }, { status });
}

async function forward(req: Request, ctx: RouteContext<"/api/backend/[...path]">) {
  const started = performance.now();
  const path = (await ctx.params).path.join("/");
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const tenantId = req.headers.get("x-tenant-id") ?? undefined;

  const res = await handle(req, path, requestId, tenantId);

  logger.info(
    {
      method: req.method,
      path: `/${path}`,
      status: res.status,
      duration_ms: Math.round(performance.now() - started),
      request_id: requestId,
      tenant_id: tenantId,
    },
    `BFF ${req.method} /${path} => ${res.status}`,
  );
  return res;
}

async function handle(req: Request, path: string, requestId: string, tenantId?: string): Promise<Response> {
  if (!ALLOWED_PREFIXES.some((p) => path.startsWith(p))) {
    return errorResponse(404, "NOT_FOUND", "unknown path");
  }

  // Requests that change data must come from our own pages (CSRF protection).
  // Compare with AUTH_URL: req.url is the internal URL in the standalone server.
  if (req.method !== "GET" && req.method !== "HEAD") {
    const origin = req.headers.get("origin");
    if (origin && origin !== new URL(env.AUTH_URL).origin) {
      return errorResponse(403, "FORBIDDEN", "bad origin");
    }
  }

  const accessToken = await getAccessToken(req);
  if (!accessToken) return errorResponse(401, "UNAUTHORIZED", "login required");

  // The tenant must be one the user belongs to; the backend checks roles again.
  if (tenantId) {
    const session = await getSession(req);
    if (!session?.tenants?.[tenantId]) return errorResponse(403, "FORBIDDEN", "not a member of this tenant");
  }

  const headers = backendHeaders(accessToken, tenantId, requestId);
  headers.set("Content-Type", req.headers.get("content-type") ?? "application/json");
  const hasBody = req.method !== "GET" && req.method !== "HEAD";

  try {
    const res = await fetch(new URL(`/${path}${new URL(req.url).search}`, env.BACKEND_URL), {
      method: req.method,
      headers,
      body: hasBody ? await req.text() : undefined,
      cache: "no-store",
    });
    return new Response(res.body, {
      status: res.status,
      headers: {
        "Content-Type": res.headers.get("content-type") ?? "application/json",
        "X-Request-Id": res.headers.get("x-request-id") ?? requestId,
      },
    });
  } catch (err) {
    logger.error({ err, request_id: requestId }, "backend unreachable");
    return errorResponse(502, "INTERNAL", "backend unreachable");
  }
}

export { forward as GET, forward as POST, forward as PUT, forward as PATCH, forward as DELETE };
