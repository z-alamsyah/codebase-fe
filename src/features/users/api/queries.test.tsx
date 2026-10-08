import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/errors";
import { API, server } from "@/test/msw";
import { userQueryOptions, useUser } from "./queries";

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const user = {
  id: "u-1",
  name: "Andi",
  email: "andi@example.com",
  phone: "",
  created_at: "2026-10-08T00:00:00Z",
  updated_at: "2026-10-08T00:00:00Z",
};

describe("useUser", () => {
  it("calls the BFF with the tenant header and returns the user", async () => {
    let tenantHeader: string | null = null;
    server.use(
      http.get(`${API}/users/:id`, ({ request, params }) => {
        tenantHeader = request.headers.get("X-Tenant-ID");
        return HttpResponse.json({ data: { ...user, id: params.id }, meta: { request_id: "r" } });
      }),
    );

    const { result } = renderHook(() => useUser("tenant-a", "u-1"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data?.name).toBe("Andi");
    expect(tenantHeader).toBe("tenant-a");
  });

  it("surfaces backend errors that map to ApiError", async () => {
    server.use(
      http.get(`${API}/users/:id`, () =>
        HttpResponse.json({ error: { code: "NOT_FOUND", message: "not found" }, meta: {} }, { status: 404 }),
      ),
    );

    const { result } = renderHook(() => useUser("tenant-a", "missing"), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(ApiError.from(result.current.error).code).toBe("NOT_FOUND");
  });

  it("uses different cache keys per tenant", () => {
    expect(userQueryOptions("a", "u-1").queryKey).not.toEqual(userQueryOptions("b", "u-1").queryKey);
  });
});
