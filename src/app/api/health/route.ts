/** Liveness probe for container orchestrators. */
export function GET() {
  return Response.json({ status: "ok" });
}
