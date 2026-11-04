import crypto from "node:crypto";
import { test, expect, db, MAIN_SLUG, MOCK, apiCheckout, simulate, statusUrl, buyer } from "./helpers";
import { downloadToken } from "../src/lib/tokens";

test.use({ storageState: { cookies: [], origins: [] } });

const SECRET = () => process.env.YOUPI_WEBHOOK_SECRET!;
const sign = (raw: string) => "sha256=" + crypto.createHmac("sha256", SECRET()).update(raw).digest("hex");

test.describe("Checkout API", () => {
  test("creates a PENDING order and returns a gateway redirect", async ({ request }) => {
    const { res, body, orderId } = await apiCheckout(request);
    expect(res.status()).toBe(200);
    expect(body.redirectUrl).toContain(MOCK());
    expect((await db.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe("PENDING");
  });

  test("ignores client-supplied prices", async ({ request }) => {
    const p = await db.product.findUniqueOrThrow({ where: { slug: MAIN_SLUG } });
    const { orderId, paymentId } = await apiCheckout(request, { total: 1, price: 1, amount: 1 });
    const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.total).toBeGreaterThan(100);
    expect(order.subtotal).toBeLessThanOrEqual(Math.max(p.price, p.compareAtPrice ?? 0));
    const gw = await (await request.get(`${MOCK()}/api/v1/payments/${paymentId}`)).json();
    expect(gw.amountPaise).toBe(order.total);
  });

  test("validates input", async ({ request }) => {
    const bad = await request.post("/api/checkout", { data: { slug: MAIN_SLUG, name: "", email: "not-an-email", gateway: "youpi" } });
    expect(bad.status()).toBe(400);
    const unknown = await request.post("/api/checkout", { data: { ...buyer(), slug: "nope-nope", gateway: "youpi" } });
    expect([400, 404]).toContain(unknown.status());
    const gw = await request.post("/api/checkout", { data: { ...buyer(), slug: MAIN_SLUG, gateway: "paypal" } });
    expect(gw.status()).toBe(400);
  });

  test("quote API applies coupons server-side", async ({ request }) => {
    const plain = await (await request.post("/api/quote", { data: { slug: MAIN_SLUG } })).json();
    const bogus = await (await request.post("/api/quote", { data: { slug: MAIN_SLUG, coupon: "FAKE999" } })).json();
    expect(bogus.total).toBe(plain.total);
    expect(bogus.couponMessage).toBeTruthy();
  });

  test("rate-limits checkout per IP (8/min)", async ({ request }) => {
    const codes: number[] = [];
    for (let i = 0; i < 10; i++) codes.push((await request.post("/api/checkout", { data: { slug: MAIN_SLUG, ...buyer(), gateway: "youpi" } })).status());
    expect(codes.slice(0, 8).every((c) => c === 200)).toBeTruthy();
    expect(codes.at(-1)).toBe(429);
  });
});

test.describe("YouPI webhook security", () => {
  test("rejects a bad signature", async ({ request }) => {
    const raw = JSON.stringify({ event: "OBSERVED_SUCCESS", orderId: "x", paymentId: "y", amountPaise: 100 });
    const r = await request.post("/api/webhooks/youpi", {
      data: raw,
      headers: { "content-type": "application/json", "X-Gateway-Signature": "sha256=" + "0".repeat(64), "X-Gateway-Delivery-Id": `forged-${Date.now()}` },
    });
    expect(r.status()).toBe(400);
  });

  test("rejects a stale V2 timestamp (replay protection)", async ({ request }) => {
    const raw = JSON.stringify({ event: "OBSERVED_SUCCESS", orderId: "x", paymentId: "y" });
    const ts = String(Date.now() - 10 * 60_000);
    const r = await request.post("/api/webhooks/youpi", {
      data: raw,
      headers: {
        "content-type": "application/json",
        "X-Gateway-Signature": sign(raw),
        "X-Gateway-Signature-V2": crypto.createHmac("sha256", SECRET()).update(`${ts}.${raw}`).digest("hex"),
        "X-Gateway-Timestamp": ts,
        "X-Gateway-Delivery-Id": `stale-${Date.now()}`,
      },
    });
    expect(r.status()).toBe(400);
  });

  test("validly-signed 'paid' webhook is ignored if the gateway says unpaid", async ({ request }) => {
    const { orderId, paymentId } = await apiCheckout(request);
    const raw = JSON.stringify({ event: "OBSERVED_SUCCESS", orderId, paymentId, amountPaise: 1, method: "UPI", utr: "999" });
    await request.post("/api/webhooks/youpi", {
      data: raw,
      headers: { "content-type": "application/json", "X-Gateway-Signature": sign(raw), "X-Gateway-Delivery-Id": `spoof-${Date.now()}`, "X-Gateway-Event": "OBSERVED_SUCCESS" },
    });
    expect((await db.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe("PENDING");
  });

  test("duplicate delivery ids are processed once", async ({ request }) => {
    const { orderId, paymentId } = await apiCheckout(request);
    const raw = JSON.stringify({ event: "EXPIRED", orderId, paymentId });
    const id = `dup-${Date.now()}`;
    const headers = { "content-type": "application/json", "X-Gateway-Signature": sign(raw), "X-Gateway-Delivery-Id": id, "X-Gateway-Event": "EXPIRED" };
    const first = await request.post("/api/webhooks/youpi", { data: raw, headers });
    const second = await request.post("/api/webhooks/youpi", { data: raw, headers });
    expect(first.status()).toBe(200);
    expect((await second.json()).duplicate).toBe(true);
  });

  test("RECONCILED marks settlement after fulfilment", async ({ request }) => {
    const { orderId, paymentId } = await apiCheckout(request);
    await simulate(request, paymentId, "OBSERVED_SUCCESS");
    let o = await db.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(o.status).toBe("FULFILLED");
    expect(o.settlementState).toBe("NOT_RECONCILED");
    await simulate(request, paymentId, "RECONCILED");
    o = await db.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(o.settlementState).toBe("RECONCILED");
  });

  test("GET on webhook endpoint is not allowed", async ({ request }) => {
    expect((await request.get("/api/webhooks/youpi")).status()).toBe(405);
  });
});

test.describe("Order status + downloads", () => {
  test("status API needs the right access key", async ({ request }) => {
    const { orderId } = await apiCheckout(request);
    expect((await request.get(statusUrl(orderId))).status()).toBe(200);
    expect((await request.get(`/api/orders/${orderId}/status?k=bad`)).status()).toBe(404);
    expect((await request.get(`/api/orders/${orderId}/status`)).status()).toBe(404);
  });

  test("status API never leaks deliverables before payment", async ({ request }) => {
    const { orderId } = await apiCheckout(request);
    const s = await (await request.get(statusUrl(orderId))).json();
    expect(s.status).toBe("PENDING");
    expect(s.deliverables ?? []).toHaveLength(0);
  });

  test("forged and revoked download tokens are refused", async ({ request }) => {
    expect((await request.get("/api/download/garbage.token", { maxRedirects: 0 })).status()).toBeGreaterThanOrEqual(400);

    const { orderId, paymentId } = await apiCheckout(request);
    await simulate(request, paymentId, "OBSERVED_SUCCESS");
    const ent = await db.entitlement.findFirstOrThrow({ where: { orderId } });
    await db.entitlement.update({ where: { id: ent.id }, data: { revoked: true } });
    const r = await request.get(`/api/download/${downloadToken(ent.id)}`, { maxRedirects: 0 });
    expect(r.status()).toBeGreaterThanOrEqual(400);
  });
});

test.describe("Admin protection + headers", () => {
  const adminPages = ["/admin", "/admin/products", "/admin/orders", "/admin/builder", "/admin/settings", "/admin/theme", "/admin/coupons", "/admin/audit"];
  for (const path of adminPages) {
    test(`${path} redirects anonymous users to login`, async ({ request }) => {
      const r = await request.get(path, { maxRedirects: 0 });
      expect([302, 307, 308]).toContain(r.status());
      expect(r.headers()["location"]).toContain("/admin/login");
    });
  }

  test("orders CSV export requires auth", async ({ request }) => {
    expect((await request.get("/api/admin/orders.csv")).status()).toBe(401);
  });

  test("forged admin cookie is rejected", async ({ request }) => {
    const r = await request.get("/admin", { maxRedirects: 0, headers: { cookie: "utu_admin=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.bad" } });
    expect([302, 307, 308]).toContain(r.status());
  });

  test("security headers are set", async ({ request }) => {
    const store = (await request.get("/")).headers();
    expect(store["x-content-type-options"]).toBe("nosniff");
    expect(store["referrer-policy"]).toBeTruthy();
    const admin = (await request.get("/admin/login")).headers();
    expect(admin["x-frame-options"]).toBe("DENY");
  });
});
