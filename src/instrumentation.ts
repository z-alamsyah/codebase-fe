/**
 * Runs once when the server starts (Next.js instrumentation hook). Used only
 * to validate environment variables, so a misconfigured server stops at
 * startup instead of failing on the first request. No tracing or metrics
 * here: observability lives in the backend.
 */
export async function register() {
  // Node-only code lives in its own file so it is not bundled for the Edge runtime.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateEnvOrExit } = await import("./instrumentation-node");
    await validateEnvOrExit();
  }
}
