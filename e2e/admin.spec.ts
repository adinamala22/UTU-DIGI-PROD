import { test, expect, db, ADMIN, uid, trackErrors, acceptDialogs, adminToast, apiCheckout, simulate } from "./helpers";

test.describe("Admin login", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("wrong password shows an error", async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(ADMIN.email);
    await page.getByLabel("Password").fill("definitely-wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.locator("p.text-red-400")).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("login then logout", async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(ADMIN.email);
    await page.getByLabel("Password").fill(ADMIN.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await page.getByRole("button", { name: "Log out" }).click();
    await expect(page).toHaveURL(/\/admin\/login/);
    await page.goto("/admin/products");
    await expect(page).toHaveURL(/\/admin\/login/);
  });
});

test.describe("Admin pages all load", () => {
  const pages: [string, string][] = [
    ["/admin", "Dashboard"],
    ["/admin/products", "Products"],
    ["/admin/orders", "Orders"],
    ["/admin/builder", "Page builder"],
    ["/admin/videos", "Videos"],
    ["/admin/testimonials", "Testimonials"],
    ["/admin/faqs", "FAQ"],
    ["/admin/coupons", "Coupons"],
    ["/admin/theme", "Theme"],
    ["/admin/settings", "Settings & payments"],
    ["/admin/audit", "Audit log"],
  ];
  for (const [path, heading] of pages) {
    test(`${path} renders without errors`, async ({ page }) => {
      const errors = trackErrors(page);
      const res = await page.goto(path);
      expect(res?.status()).toBe(200);
      await expect(page.getByRole("heading", { name: heading, exact: true }).first()).toBeVisible();
      expect(errors, errors.join("\n")).toEqual([]);
    });
  }

  test("sidebar navigates between sections", async ({ page }) => {
    await page.goto("/admin");
    await page.getByRole("link", { name: "Orders" }).first().click();
    await expect(page).toHaveURL(/\/admin\/orders/);
    await page.getByRole("link", { name: "Coupons" }).first().click();
    await expect(page).toHaveURL(/\/admin\/coupons/);
  });
});

test.describe.serial("Product management", () => {
  const title = `E2E Product ${uid()}`;
  let productId = "";

  test("create a LIVE link product", async ({ page }) => {
    await page.goto("/admin/products/new");
    await page.getByLabel(/^Title/).fill(title);
    await page.getByLabel(/^Title/).blur();
    await expect(page.getByLabel(/^URL slug/)).not.toHaveValue("");
    await page.getByLabel(/^Subtitle \/ hook/).fill("Automated test product");
    await page.getByRole("button", { name: /External link/ }).click();
    await page.getByLabel(/^Access URL/).fill("https://example.com/e2e-access");
    await page.getByLabel(/^Price ₹/).fill("149");
    await page.getByLabel(/^Compare-at ₹/).fill("499");
    await page.getByLabel(/^Status/).selectOption("LIVE");
    await page.getByRole("button", { name: "Save product" }).click();
    await adminToast(page, "Product saved");
    await expect(page).toHaveURL(/\/admin\/products\/(?!new)[^/]+$/);
    const p = await db.product.findFirstOrThrow({ where: { title } });
    productId = p.id;
    expect(p.price).toBe(14900);
    expect(p.compareAtPrice).toBe(49900);
    expect(p.deliveryType).toBe("LINK");
  });

  test("new product appears on the storefront and its page works", async ({ page }) => {
    const p = await db.product.findUniqueOrThrow({ where: { id: productId } });
    await page.goto("/");
    await expect(page.locator("#products").getByRole("heading", { name: title })).toBeVisible();
    await page.goto(`/products/${p.slug}`);
    await expect(page.locator("h1").first()).toContainText(title);
    await expect(page.getByText("₹149").first()).toBeVisible();
  });

  test("edit price updates the storefront", async ({ page }) => {
    await page.goto(`/admin/products/${productId}`);
    await page.getByLabel(/^Price ₹/).fill("199");
    await page.getByRole("button", { name: "Save product" }).click();
    await adminToast(page, "Product saved");
    const p = await db.product.findUniqueOrThrow({ where: { id: productId } });
    expect(p.price).toBe(19900);
    await page.goto(`/products/${p.slug}`);
    await expect(page.getByText("₹199").first()).toBeVisible();
  });

  test("duplicate then delete products from the list", async ({ page }) => {
    acceptDialogs(page);
    await page.goto("/admin/products");
    const row = page.locator("div.flex-wrap", { has: page.getByRole("link", { name: title, exact: true }) });
    await row.getByTitle("Duplicate").click();
    await expect.poll(() => db.product.count({ where: { title: { startsWith: title } } })).toBe(2);

    for (const p of await db.product.findMany({ where: { title: { startsWith: title } } })) {
      await page.goto("/admin/products");
      const r = page.locator("div.flex-wrap", { has: page.locator(`a[href="/admin/products/${p.id}"]`) });
      await r.getByTitle("Delete").click();
      await expect.poll(() => db.product.count({ where: { id: p.id } })).toBe(0);
    }
  });

  test.afterAll(async () => {
    await db.product.deleteMany({ where: { title: { startsWith: title } } });
  });
});

test.describe.serial("Content managers", () => {
  const q = `E2E question ${uid()}?`;
  const code = `E2EC${uid().toUpperCase()}`;

  test("create an FAQ and see it on the home page", async ({ page }) => {
    await page.goto("/admin/faqs");
    await page.getByRole("button", { name: "Add new" }).click();
    await page.getByLabel(/^Question/).fill(q);
    await page.getByLabel(/^Answer/).fill("Automated answer for the test suite.");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await adminToast(page, "Saved");
    await page.goto("/");
    await expect(page.getByRole("button", { name: q })).toBeVisible();
  });

  test("delete the FAQ", async ({ page }) => {
    acceptDialogs(page);
    await page.goto("/admin/faqs");
    const row = page.locator("div.flex.items-center", { hasText: q }).last();
    await row.getByTitle("Delete").click();
    await expect.poll(() => db.faq.count({ where: { question: q } })).toBe(0);
  });

  test("create a coupon in admin and use it at checkout", async ({ page }) => {
    await page.goto("/admin/coupons");
    await page.getByRole("button", { name: "Add new" }).click();
    await page.getByLabel(/^Code/).fill(code);
    await page.getByLabel(/^Value \(% or ₹\)/).fill("15");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await adminToast(page, "Saved");
    await expect(page.getByText(`${code}: 15% off`)).toBeVisible();

    await page.goto("/checkout/ai-agency-automation-vault");
    await page.getByPlaceholder("Coupon code").fill(code);
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.getByText(`${code} applied!`)).toBeVisible();
  });

  test.afterAll(async () => {
    await db.faq.deleteMany({ where: { question: q } });
    await db.coupon.deleteMany({ where: { code } });
  });
});

test.describe.serial("Settings drive the storefront", () => {
  let original: unknown;
  const text = `E2E ANNOUNCEMENT ${uid()}`;

  test.beforeAll(async () => {
    // all store settings live in one JSON row with key "site"
    original = (await db.setting.findUnique({ where: { key: "site" } }))?.value ?? null;
  });

  test("changing the announcement text shows on the store", async ({ page }) => {
    await page.goto("/admin/settings");
    const field = page.getByLabel(/Announcement text|^Text$/).first();
    await field.fill(text);
    await page.getByRole("button", { name: "Save settings" }).click();
    await adminToast(page, /Saved|Settings saved/);
    await page.goto("/");
    await expect(page.getByText(text)).toBeVisible();
  });

  test.afterAll(async () => {
    if (original === null) await db.setting.deleteMany({ where: { key: "site" } });
    else await db.setting.update({ where: { key: "site" }, data: { value: original as object } });
  });
});

test.describe("Page builder", () => {
  test("shows sections and a live preview iframe", async ({ page }) => {
    await page.goto("/admin/builder");
    await expect(page.locator('iframe[title="Store preview"]')).toBeVisible();
    await expect(page.getByRole("button", { name: /All changes saved|Save & publish/ })).toBeVisible();
    const frame = page.frameLocator('iframe[title="Store preview"]');
    await expect(frame.locator("#products")).toBeAttached();
  });

  test("hiding a section and publishing marks it as dirty then saved", async ({ page }) => {
    const before = await db.pageSection.findMany({ where: { page: "home" }, orderBy: { sortOrder: "asc" } });
    try {
      await page.goto("/admin/builder");
      await page.getByTitle("Hide").first().click();
      const save = page.getByRole("button", { name: "Save & publish" });
      await expect(save).toBeEnabled();
      await save.click();
      await adminToast(page, "Published!");
      const hidden = await db.pageSection.count({ where: { page: "home", enabled: false } });
      expect(hidden).toBeGreaterThan(before.filter((s) => !s.enabled).length);
    } finally {
      for (const s of before) await db.pageSection.update({ where: { id: s.id }, data: { enabled: s.enabled } }).catch(() => {});
    }
  });
});

test.describe("Order operations", () => {
  test("approve an order under review delivers it", async ({ page, request }) => {
    const { orderId, paymentId } = await apiCheckout(request);
    await simulate(request, paymentId, "MANUAL_REVIEW");
    expect((await db.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe("REVIEW");

    acceptDialogs(page);
    await page.goto(`/admin/orders/${orderId}`);
    await page.getByRole("button", { name: /Approve/ }).click();
    await adminToast(page, "Done");
    await expect.poll(async () => (await db.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe("FULFILLED");
  });

  test("revoke access kills entitlements", async ({ page, request }) => {
    const { orderId, paymentId } = await apiCheckout(request);
    await simulate(request, paymentId, "OBSERVED_SUCCESS");
    acceptDialogs(page);
    await page.goto(`/admin/orders/${orderId}`);
    await page.getByRole("button", { name: "Revoke access" }).click();
    await adminToast(page, "Done");
    await expect.poll(async () => (await db.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe("REVOKED");
    expect(await db.entitlement.count({ where: { orderId, revoked: false } })).toBe(0);
  });

  test("mark reconciled", async ({ page, request }) => {
    const { orderId, paymentId } = await apiCheckout(request);
    await simulate(request, paymentId, "OBSERVED_SUCCESS");
    acceptDialogs(page);
    await page.goto(`/admin/orders/${orderId}`);
    await page.getByRole("button", { name: "Mark reconciled" }).click();
    await adminToast(page, "Done");
    await expect.poll(async () => (await db.order.findUniqueOrThrow({ where: { id: orderId } })).settlementState).toBe("RECONCILED");
  });

  test("orders list finds an order and CSV export downloads", async ({ page, request }) => {
    const { orderId } = await apiCheckout(request);
    await page.goto("/admin/orders");
    await expect(page.locator(`a[href="/admin/orders/${orderId}"]`).first()).toBeVisible();
    const csv = await page.request.get("/api/admin/orders.csv");
    expect(csv.status()).toBe(200);
    expect(csv.headers()["content-type"]).toContain("text/csv");
    expect(await csv.text()).toContain(orderId);
  });

  test("admin actions are written to the audit log", async ({ page }) => {
    await page.goto("/admin/audit");
    const n = await db.auditLog.count();
    expect(n).toBeGreaterThan(0);
    const latest = await db.auditLog.findFirstOrThrow({ orderBy: { createdAt: "desc" } });
    await expect(page.getByText(latest.action).first()).toBeVisible();
  });
});
