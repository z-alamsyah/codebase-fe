import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";
import { client } from "@/lib/api/generated/client.gen";
import { server } from "./msw";

// Node's fetch needs absolute URLs; in the browser the client uses /api/backend.
client.setConfig({ baseUrl: "http://localhost/api/backend" });

beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterEach(() => {
  server.resetHandlers();
  cleanup();
});
afterAll(() => server.close());
