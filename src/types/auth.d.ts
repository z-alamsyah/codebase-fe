import "@auth/core/types";
import "@auth/core/jwt";

declare module "@auth/core/types" {
  // Sent to the browser (GET /api/auth/session): never put tokens here.
  interface Session {
    tenants?: Record<string, string[]>; // Zitadel organization ID -> role keys
    error?: string;
  }
}

declare module "@auth/core/jwt" {
  // Stored encrypted in the session cookie, readable only on the server.
  interface JWT {
    idToken?: string;
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number; // ms since epoch
    tenants?: Record<string, string[]>;
    error?: string;
  }
}
