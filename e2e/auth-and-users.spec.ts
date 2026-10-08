import { expect, test, type Page } from "@playwright/test";

const USERNAME = process.env.E2E_USERNAME ?? "alice@tenant-a.test";
const PASSWORD = process.env.E2E_PASSWORD ?? "Password1!";

async function fillAndContinue(page: Page, selector: string, value: string) {
  const input = page.locator(selector);
  const next = page.getByRole("button", { name: "Continue" });
  await expect(async () => {
    await input.fill(value);
    await expect(next).toBeEnabled({ timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
  await next.click();
}

async function login(page: Page) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Login with Zitadel" }).click();
  // Zitadel Login UI v2. Fill again until the page has hydrated and enables "Continue".
  await fillAndContinue(page, 'input[name="loginName"]', USERNAME);
  await fillAndContinue(page, 'input[name="password"]', PASSWORD);
  await page.waitForURL((url) => url.port === new URL(page.url()).port && !url.pathname.startsWith("/ui/v2"));
  await expect(page.getByText(/^Hello /)).toBeVisible();
}

test("protected pages redirect anonymous users to login", async ({ page }) => {
  await page.goto("/any-tenant/users/new");
  await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fany-tenant%2Fusers%2Fnew/);
});

test("login, create a user, view it, and log out", async ({ page }) => {
  const cspViolations: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" && /Content Security Policy/i.test(msg.text())) cspViolations.push(msg.text());
  });

  await login(page);

  // Tokens never reach the browser.
  const session = await page.evaluate(async () => (await fetch("/api/auth/session")).text());
  expect(session).not.toMatch(/eyJ|accessToken|refreshToken/);
  expect(await page.evaluate(() => document.cookie)).not.toContain("session-token");

  // Open the first tenant.
  await page
    .locator("a", { hasText: /^Tenant / })
    .first()
    .click();
  await expect(page.getByRole("heading", { name: /^Tenant / })).toBeVisible();
  const tenant = new URL(page.url()).pathname.split("/")[1];

  // Client-side validation.
  await page.getByRole("link", { name: "Create a user" }).click();
  await page.getByRole("button", { name: "Create user" }).click();
  await expect(page.getByText("At least 2 characters")).toBeVisible();

  // Create a user through the BFF -> backend.
  const email = `e2e-${Date.now()}@example.com`;
  await page.getByLabel("Name").fill("E2E User");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("Password123!");
  await page.getByRole("button", { name: "Create user" }).click();
  await expect(page).toHaveURL(new RegExp(`/${tenant}/users/[0-9a-f-]{36}$`));
  await expect(page.getByTestId("user-name")).toHaveText("E2E User");

  // Reload: the detail page is prefetched on the server.
  await page.reload();
  await expect(page.getByTestId("user-name")).toHaveText("E2E User");

  // Backend conflict is shown on the form.
  await page.goto(`/${tenant}/users/new`);
  await page.getByLabel("Name").fill("E2E User");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("Password123!");
  await page.getByRole("button", { name: "Create user" }).click();
  // (Next.js also renders an empty role="alert" route announcer, so filter by text.)
  await expect(page.getByRole("alert").filter({ hasText: "already registered" })).toBeVisible();

  // A tenant the user does not belong to.
  await page.goto("/999999/users/new");
  await expect(page).toHaveURL(/\/forbidden$/);

  // Log out (local session and Zitadel session).
  await page.goto("/");
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(
    page.getByRole("button", { name: "Log in" }).or(page.getByRole("link", { name: "Log in" })),
  ).toBeVisible();
  expect((await page.request.get("/api/backend/api/v1/users/x")).status()).toBe(401);

  expect(cspViolations).toEqual([]);
});
