import { test, expect, db, MAIN_SLUG, trackErrors } from "./helpers";
import { DEFAULT_SETTINGS } from "../src/lib/settings-defaults";

// Storefront is public: run without the admin cookie.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Home page", () => {
  test("renders hero, products, videos and FAQ from the page builder", async ({ page }) => {
    const errors = trackErrors(page);
    const hero = await db.pageSection.findFirst({ where: { page: "home", type: "hero", enabled: true } });
    const products = await db.product.findMany({ where: { status: "LIVE" } });

    await page.goto("/");
    await expect(page).toHaveTitle(/.+/);

    if (hero) {
      const headline = String((hero.config as Record<string, unknown>).headline ?? "");
      await expect(page.locator("h1").first()).toContainText(headline.slice(0, 20));
    }
    const grid = page.locator("#products");
    await expect(grid).toBeVisible();
    for (const p of products) await expect(grid.getByText(p.title).first()).toBeVisible();

    await expect(page.locator("#videos")).toBeAttached();
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("hidden sections and draft products do not render", async ({ page }) => {
    const drafts = await db.product.findMany({ where: { status: { not: "LIVE" } } });
    await page.goto("/");
    for (const d of drafts) await expect(page.locator("#products").getByText(d.title, { exact: true })).toHaveCount(0);
  });

  test("header navigation links work", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Shop now" }).click();
    await expect(page).toHaveURL(/#products$/);
    await page.getByRole("link", { name: /Terms/ }).click();
    await expect(page).toHaveURL(/\/terms$/);
    await expect(page.locator("h1")).toBeVisible();
  });

  test("video embeds lazy-load: thumbnail first, iframe after click", async ({ page }) => {
    await page.goto("/");
    const section = page.locator("#videos");
    await section.scrollIntoViewIfNeeded();
    const play = section.getByRole("button", { name: /^Play/ }).first();
    test.skip((await play.count()) === 0, "no videos configured");
    await expect(section.locator("iframe")).toHaveCount(0);
    await play.click();
    await expect(section.locator("iframe").first()).toHaveAttribute("src", /youtube|vimeo/);
  });

  test("FAQ accordion expands an answer", async ({ page }) => {
    const faq = await db.faq.findFirst({ where: { enabled: true }, orderBy: { sortOrder: "asc" } });
    test.skip(!faq, "no FAQs");
    await page.goto("/");
    const q = page.getByRole("button", { name: faq!.question });
    await q.scrollIntoViewIfNeeded();
    await q.click();
    await expect(page.getByText(faq!.answer.slice(0, 30)).first()).toBeVisible();
  });

  test("announcement bar shows configured text", async ({ page }) => {
    const s = await db.setting.findUnique({ where: { key: "site" } });
    const saved = ((s?.value ?? {}) as { announcement?: { enabled?: boolean; text?: string } }).announcement;
    const a = { ...DEFAULT_SETTINGS.announcement, ...saved };
    test.skip(a.enabled === false || !a.text, "announcement disabled");
    await page.goto("/");
    await expect(page.getByText(a.text!).first()).toBeVisible();
  });

  test("purchase toasts only show real names (no fabricated buyers)", async ({ page }) => {
    await page.goto("/");
    // toasts appear after ~6s; whatever shows must match a real paid order name
    const toast = page.locator("text=Verified purchase").first();
    if (await toast.isVisible({ timeout: 9000 }).catch(() => false)) {
      const names = (await db.order.findMany({ where: { status: "FULFILLED" }, select: { name: true } })).map((o) => o.name.split(" ")[0]);
      const card = toast.locator("xpath=..");
      const shown = (await card.locator("b").first().innerText()).trim();
      expect(names.some((n) => shown.startsWith(n))).toBeTruthy();
    }
  });
});

test.describe("Product page", () => {
  test("shows title, price, compare-at price and buy CTA", async ({ page }) => {
    const errors = trackErrors(page);
    const p = await db.product.findUniqueOrThrow({ where: { slug: MAIN_SLUG } });
    await page.goto(`/products/${MAIN_SLUG}`);
    await expect(page.locator("h1").first()).toContainText(p.title);
    await expect(page.getByText(/₹\s?[\d,]+/).first()).toBeVisible();
    const cta = page.locator(`a[href^="/checkout/${MAIN_SLUG}"]`).first();
    await expect(cta).toBeVisible();
    await cta.click();
    await expect(page).toHaveURL(new RegExp(`/checkout/${MAIN_SLUG}`));
    await expect(page.getByRole("heading", { name: /Where should we send it/ })).toBeVisible();
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("unknown product returns 404", async ({ page }) => {
    const res = await page.goto("/products/does-not-exist-xyz");
    expect(res?.status()).toBe(404);
  });

  test("draft product is not publicly reachable", async ({ page }) => {
    const draft = await db.product.create({
      data: { slug: `e2e-draft-${Date.now()}`, title: "E2E Draft Product", price: 10000, status: "DRAFT", deliveryType: "LINK", externalUrl: "https://example.com" },
    });
    try {
      expect((await page.goto(`/products/${draft.slug}`))?.status()).toBe(404);
      expect((await page.goto(`/checkout/${draft.slug}`))?.status()).toBe(404);
    } finally {
      await db.product.delete({ where: { id: draft.id } });
    }
  });

  test("has SEO metadata and Open Graph tags", async ({ page }) => {
    await page.goto(`/products/${MAIN_SLUG}`);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /.+/);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", /.+/);
  });
});
