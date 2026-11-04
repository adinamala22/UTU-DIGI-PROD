import { test, expect, db, MAIN_SLUG, LICENSE_SLUG, buyer, uid, trackErrors, apiCheckout, simulate, orderPageUrl } from "./helpers";

test.use({ storageState: { cookies: [], origins: [] } });

async function fillBuyer(page: import("@playwright/test").Page, b = buyer()) {
  await page.getByLabel("Full name").fill(b.name);
  await page.getByLabel(/^Email/).fill(b.email);
  await page.getByLabel("WhatsApp number").fill(b.phone);
  await page.getByLabel(/^City/).fill(b.city);
  return b;
}

test.describe("Checkout page", () => {
  test("shows order summary with server-computed total", async ({ page }) => {
    await page.goto(`/checkout/${MAIN_SLUG}`);
    await expect(page.getByRole("heading", { name: "Order summary" })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Pay ₹/ })).toBeVisible();
    await expect(page.getByText("Payments are not configured yet")).toHaveCount(0);
  });

  test("rejects an invalid coupon", async ({ page }) => {
    await page.goto(`/checkout/${MAIN_SLUG}`);
    await page.getByPlaceholder("Coupon code").fill("NOTAREALCODE");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.locator("p.text-urgency, p.text-sm.text-urgency").first()).toBeVisible();
    await expect(page.getByText("Discount")).toHaveCount(0);
  });

  test("applies a valid coupon and lowers the total", async ({ page }) => {
    const code = `E2E${uid().toUpperCase()}`;
    const coupon = await db.coupon.create({ data: { code, type: "PERCENT", value: 20, active: true } });
    try {
      await page.goto(`/checkout/${MAIN_SLUG}`);
      const pay = page.getByRole("button", { name: /^Pay ₹/ });
      const before = await pay.innerText();
      await page.getByPlaceholder("Coupon code").fill(code);
      await page.getByRole("button", { name: "Apply" }).click();
      await expect(page.getByText(`${code} applied!`)).toBeVisible();
      await expect(page.getByText("Discount")).toBeVisible();
      await expect(pay).not.toHaveText(before);
    } finally {
      await db.coupon.delete({ where: { id: coupon.id } });
    }
  });

  test("coupon from ?coupon= query string is pre-applied", async ({ page }) => {
    const code = `E2EQ${uid().toUpperCase()}`;
    const coupon = await db.coupon.create({ data: { code, type: "FLAT", value: 100, active: true } });
    try {
      await page.goto(`/checkout/${MAIN_SLUG}?coupon=${code}`);
      await expect(page.getByPlaceholder("Coupon code")).toHaveValue(code);
      await expect(page.getByText("Discount")).toBeVisible();
    } finally {
      await db.coupon.delete({ where: { id: coupon.id } });
    }
  });

  test("order bump adds the add-on to the total", async ({ page }) => {
    const main = await db.product.findUniqueOrThrow({ where: { slug: MAIN_SLUG } });
    const addon = await db.product.findUniqueOrThrow({ where: { slug: LICENSE_SLUG } });
    const prev = { orderBumpProductId: main.orderBumpProductId, orderBumpPrice: main.orderBumpPrice };
    await db.product.update({ where: { id: main.id }, data: { orderBumpProductId: addon.id, orderBumpPrice: 9900 } });
    try {
      await page.goto(`/checkout/${MAIN_SLUG}`);
      await expect(page.getByText("One-time offer")).toBeVisible();
      await page.getByRole("checkbox").check();
      await expect(page.getByText("(add-on)")).toBeVisible();
      await expect(page.getByText(addon.title).nth(1)).toBeVisible();
    } finally {
      await db.product.update({ where: { id: main.id }, data: prev });
    }
  });

  test("browser validation blocks submit without name/email", async ({ page }) => {
    await page.goto(`/checkout/${MAIN_SLUG}`);
    await page.getByRole("button", { name: /^Pay ₹/ }).click();
    await expect(page).toHaveURL(new RegExp(`/checkout/${MAIN_SLUG}`));
    const valid = await page.getByLabel("Full name").evaluate((el: HTMLInputElement) => el.validity.valid);
    expect(valid).toBe(false);
  });
});

test.describe("Full purchase flow (mock YouPI gateway)", () => {
  test("LINK product: pay → order page reveals access link → order fulfilled in DB", async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto(`/products/${MAIN_SLUG}`);
    await page.locator(`a[href^="/checkout/${MAIN_SLUG}"]`).first().click();
    const b = await fillBuyer(page);
    await page.getByRole("button", { name: /^Pay ₹/ }).click();

    // Redirected to the gateway's hosted checkout
    await expect(page.getByText("MOCK YouPI checkout")).toBeVisible();
    await page.getByRole("button", { name: /Simulate UPI payment/ }).click();

    // Back on our order page with access delivered
    await expect(page).toHaveURL(/\/order\/[^/?]+\?k=/);
    await expect(page.getByRole("heading", { name: /You.re in!/ })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(b.email)).toBeVisible();
    const access = page.getByRole("link", { name: /Access now/ });
    await expect(access).toBeVisible();
    await expect(access).toHaveAttribute("href", /^https?:\/\//);

    const order = await db.order.findFirstOrThrow({ where: { email: b.email }, include: { entitlements: true } });
    expect(order.status).toBe("FULFILLED");
    expect(order.utr).toBeTruthy();
    expect(order.entitlements).toHaveLength(1);
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("LICENSE product: pay → license key shown and copyable", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto(`/checkout/${LICENSE_SLUG}`);
    const b = await fillBuyer(page);
    await page.getByRole("button", { name: /^Pay ₹/ }).click();
    await page.getByRole("button", { name: /Simulate UPI payment/ }).click();
    await expect(page.getByRole("heading", { name: /You.re in!/ })).toBeVisible({ timeout: 20_000 });

    const ent = await db.entitlement.findFirstOrThrow({ where: { order: { email: b.email } } });
    expect(ent.licenseKey).toBeTruthy();
    await expect(page.getByText(ent.licenseKey!)).toBeVisible();
  });

  test("coupon is recorded on the order and usage count increments", async ({ page }) => {
    const code = `E2EUSE${uid().toUpperCase()}`;
    const coupon = await db.coupon.create({ data: { code, type: "PERCENT", value: 10, active: true } });
    try {
      await page.goto(`/checkout/${MAIN_SLUG}?coupon=${code}`);
      await expect(page.getByText("Discount")).toBeVisible();
      const b = await fillBuyer(page);
      await page.getByRole("button", { name: /^Pay ₹/ }).click();
      await page.getByRole("button", { name: /Simulate UPI payment/ }).click();
      await expect(page.getByRole("heading", { name: /You.re in!/ })).toBeVisible({ timeout: 20_000 });
      const order = await db.order.findFirstOrThrow({ where: { email: b.email } });
      expect(order.couponCode).toBe(code);
      expect(order.discount).toBeGreaterThan(0);
      expect(order.total).toBe(order.subtotal - order.discount);
      expect((await db.coupon.findUniqueOrThrow({ where: { id: coupon.id } })).usedCount).toBe(1);
    } finally {
      await db.coupon.delete({ where: { id: coupon.id } }).catch(() => {});
    }
  });

  test("expired payment shows failure screen with retry", async ({ page, request }) => {
    const { orderId, paymentId } = await apiCheckout(request);
    await simulate(request, paymentId, "EXPIRED");
    await page.goto(orderPageUrl(orderId));
    await expect(page.getByRole("heading", { name: /Payment expired/i })).toBeVisible();
    await expect(page.getByRole("link", { name: "Try again" })).toBeVisible();
  });

  test("pending order page waits, then flips to delivered when the webhook lands", async ({ page, request }) => {
    const { orderId, paymentId } = await apiCheckout(request);
    await page.goto(orderPageUrl(orderId));
    await expect(page.getByRole("heading", { name: /Waiting for payment/ })).toBeVisible();
    await simulate(request, paymentId, "OBSERVED_SUCCESS");
    await expect(page.getByRole("heading", { name: /You.re in!/ })).toBeVisible({ timeout: 15_000 });
  });

  test("MANUAL_REVIEW puts the order under review", async ({ page, request }) => {
    const { orderId, paymentId } = await apiCheckout(request);
    await simulate(request, paymentId, "MANUAL_REVIEW");
    await page.goto(orderPageUrl(orderId));
    await expect(page.getByRole("heading", { name: "Payment under review" })).toBeVisible();
  });

  test("order page without the access key is not viewable", async ({ page, request }) => {
    const { orderId } = await apiCheckout(request);
    const res = await page.goto(`/order/${orderId}`);
    expect(res?.status()).toBe(404);
    const bad = await page.goto(`/order/${orderId}?k=wrong`);
    expect(bad?.status()).toBe(404);
  });
});
