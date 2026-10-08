import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { API, server } from "@/test/msw";
import { renderWithQuery } from "@/test/render";
import { CreateUserForm } from "./create-user-form";

async function fillValidForm() {
  const u = userEvent.setup();
  await u.type(screen.getByLabelText("Name"), "Andi");
  await u.type(screen.getByLabelText("Email"), "andi@example.com");
  await u.type(screen.getByLabelText("Password"), "Password123!");
  return u;
}

describe("CreateUserForm", () => {
  it("shows client-side validation errors without calling the backend", async () => {
    const onCreated = vi.fn();
    renderWithQuery(<CreateUserForm tenant="t1" onCreated={onCreated} />);

    await userEvent.setup().click(screen.getByRole("button", { name: "Create user" }));

    expect(await screen.findByText("At least 2 characters")).toBeInTheDocument();
    expect(screen.getByText("Must be a valid email address")).toBeInTheDocument();
    expect(onCreated).not.toHaveBeenCalled();
  });

  it("creates the user and reports its id", async () => {
    let body: unknown;
    server.use(
      http.post(`${API}/users`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(
          {
            data: {
              id: "new-id",
              name: "Andi",
              email: "andi@example.com",
              phone: "",
              created_at: "2026-10-08T00:00:00Z",
              updated_at: "2026-10-08T00:00:00Z",
            },
            meta: {},
          },
          { status: 201 },
        );
      }),
    );
    const onCreated = vi.fn();
    renderWithQuery(<CreateUserForm tenant="t1" onCreated={onCreated} />);

    const u = await fillValidForm();
    await u.click(screen.getByRole("button", { name: "Create user" }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith("new-id"));
    expect(body).toEqual({ name: "Andi", email: "andi@example.com", password: "Password123!" });
  });

  it("shows backend field errors next to the fields", async () => {
    server.use(
      http.post(`${API}/users`, () =>
        HttpResponse.json(
          {
            error: {
              code: "INVALID_INPUT",
              message: "request validation failed",
              details: [{ field: "email", message: "domain is not allowed" }],
            },
            meta: {},
          },
          { status: 400 },
        ),
      ),
    );
    renderWithQuery(<CreateUserForm tenant="t1" onCreated={vi.fn()} />);

    const u = await fillValidForm();
    await u.click(screen.getByRole("button", { name: "Create user" }));

    expect(await screen.findByText("domain is not allowed")).toBeInTheDocument();
  });

  it("shows a conflict message from the backend", async () => {
    server.use(
      http.post(`${API}/users`, () =>
        HttpResponse.json(
          { error: { code: "CONFLICT", message: "conflict: email andi@example.com is already registered" }, meta: {} },
          { status: 409 },
        ),
      ),
    );
    renderWithQuery(<CreateUserForm tenant="t1" onCreated={vi.fn()} />);

    const u = await fillValidForm();
    await u.click(screen.getByRole("button", { name: "Create user" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("already registered");
  });
});
