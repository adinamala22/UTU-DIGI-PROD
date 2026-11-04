import { test, expect, MAIN_SLUG, buyer } from "./helpers";

// Runs in the "mobile" project (Pixel 7 viewport, touch).
test("home page has no horizontal overflow on mobile", async ({ page }) => {
  await page.goto("/");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("sticky buy bar appears after scrolling on product page", async ({ page }) => {
  await page.goto(`/products/${MAIN_SLUG}`);
  const sticky = page.locator("div.fixed.inset-x-0.bottom-0");
  await expect(sticky).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, 1500));
  await expect(sticky).toBeVisible();
  // the CTA pulses forever (never "stable"), so skip Playwright's stability wait
  await sticky.getByRole("link", { name: "Buy now" }).tap({ force: true });
  await expect(page).toHaveURL(new RegExp(`/checkout/${MAIN_SLUG}`));
});

test("checkout form is usable on mobile and reaches the gateway", async ({ page }) => {
  await page.goto(`/checkout/${MAIN_SLUG}`);
  const b = buyer();
  await page.getByLabel("Full name").fill(b.name);
  await page.getByLabel(/^Email/).fill(b.email);
  await page.getByRole("button", { name: /^Pay ₹/ }).tap();
  await expect(page.getByText("MOCK YouPI checkout")).toBeVisible();
});
