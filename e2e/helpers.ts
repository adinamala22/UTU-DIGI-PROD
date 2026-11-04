import { test as base, expect, type APIRequestContext, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { orderAccessKey } from "../src/lib/tokens";

export const db = new PrismaClient();
export const MOCK = () => process.env.E2E_MOCK_URL!;
export const ADMIN = {
  email: process.env.ADMIN_EMAIL || "admin@urltuneup.com",
  password: process.env.ADMIN_PASSWORD || "",
};
export const MAIN_SLUG = "ai-agency-automation-vault";
export const LICENSE_SLUG = "chatgpt-prompt-mega-pack";
export const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Each test gets its own fake client IP so the per-IP rate limiters don't bleed between tests. */
const randomIp = () => `10.${(Math.random() * 255) | 0}.${(Math.random() * 255) | 0}.${(Math.random() * 254 + 1) | 0}`;

export const test = base.extend<{ ip: string }>({
  ip: async ({}, provide) => provide(randomIp()),
  page: async ({ page, ip }, provide) => {
    await page.setExtraHTTPHeaders({ "x-forwarded-for": ip });
    await provide(page);
  },
  request: async ({ playwright, baseURL, ip }, provide) => {
    const ctx = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { "x-forwarded-for": ip } });
    await provide(ctx);
    await ctx.dispose();
  },
});
export { expect };

export const buyer = (tag = uid()) => ({
  name: "Ravi Kumar",
  email: `e2e+${tag}@example.com`,
  phone: "9876543210",
  city: "Pune",
});

/** Create an order straight through the API (fast path for tests that don't care about the form). */
export async function apiCheckout(request: APIRequestContext, extra: Record<string, unknown> = {}) {
  const res = await request.post("/api/checkout", {
    data: { slug: MAIN_SLUG, ...buyer(), gateway: "youpi", ...extra },
  });
  const body = await res.json();
  return {
    res,
    body,
    orderId: body.orderId as string,
    paymentId: String(body.redirectUrl ?? "").split("/").pop() as string,
  };
}

/** Ask the mock gateway to fire a signed webhook for a payment. */
export async function simulate(request: APIRequestContext, paymentId: string, event: string) {
  const r = await request.post(`${MOCK()}/simulate/${paymentId}/${event}?json=1`, { data: {} });
  return r.json();
}

export const orderPageUrl = (orderId: string) => `/order/${orderId}?k=${orderAccessKey(orderId)}`;
export const statusUrl = (orderId: string) => `/api/orders/${orderId}/status?k=${orderAccessKey(orderId)}`;

/** Collect uncaught page errors + console errors so tests can assert a clean page. */
export function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const t = m.text();
    // third-party embeds (YouTube/Vimeo) and blocked trackers are noise, not our bugs
    if (/youtube|vimeo|googlevideo|doubleclick|ERR_BLOCKED|favicon/i.test(t)) return;
    errors.push(`console: ${t}`);
  });
  return errors;
}

/** Accept native confirm() dialogs used by admin destructive actions. */
export function acceptDialogs(page: Page) {
  page.on("dialog", (d) => d.accept());
}

export async function adminToast(page: Page, text: string | RegExp) {
  await expect(page.getByText(text).first()).toBeVisible();
}
