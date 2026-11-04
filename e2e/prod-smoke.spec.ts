import { test, expect } from "@playwright/test";

// READ-ONLY checks against the live site. Never submits checkout or changes data.
// Run: npm run test:e2e:prod   (PROD_URL overrides https://shop.urltuneup.com)

const SLUG = process.env.PROD_SLUG || "ai-agency-automation-vault";

test("home page loads with products", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const res = await page.goto("/");
  expect(res?.status()).toBe(200);
  await expect(page.locator("h1").first()).toBeVisible();
  await expect(page.locator("#products")).toBeVisible();
  expect(errors).toEqual([]);
});

test("product page and checkout page load", async ({ page }) => {
  expect((await page.goto(`/products/${SLUG}`))?.status()).toBe(200);
  await expect(page.locator("h1").first()).toBeVisible();
  expect((await page.goto(`/checkout/${SLUG}`))?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Order summary" })).toBeVisible();
});

test("payment gateway is configured (checkout can take money)", async ({ page }) => {
  await page.goto(`/checkout/${SLUG}`);
  await expect(page.getByText("Payments are not configured yet"), "No payment gateway configured in production").toHaveCount(0);
});

test("terms page loads", async ({ page }) => {
  expect((await page.goto("/terms"))?.status()).toBe(200);
});

test("admin is protected", async ({ request }) => {
  const r = await request.get("/admin", { maxRedirects: 0 });
  expect([302, 307, 308]).toContain(r.status());
  expect((await request.get("/api/admin/orders.csv")).status()).toBe(401);
  expect((await request.get("/admin/login")).status()).toBe(200);
});

test("webhooks reject unsigned requests", async ({ request }) => {
  expect((await request.get("/api/webhooks/youpi")).status()).toBe(405);
  const r = await request.post("/api/webhooks/youpi", { data: "{}", headers: { "content-type": "application/json", "X-Gateway-Signature": "sha256=00" } });
  expect(r.status()).toBeGreaterThanOrEqual(400);
});

test("HTTPS + security headers", async ({ request }) => {
  const h = (await request.get("/")).headers();
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["strict-transport-security"]).toBeTruthy();
});
