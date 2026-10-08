/** Stops the process when environment variables are invalid (Node.js runtime only). */
export async function validateEnvOrExit(): Promise<void> {
  try {
    await import("./lib/config/env");
  } catch {
    // The details were already printed by the env validation.
    process.exit(1);
  }
}
