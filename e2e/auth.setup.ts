import { test as setup, expect } from "@playwright/test";
import { ADMIN } from "./helpers";

setup("log in as admin and save session", async ({ page }) => {
  expect(ADMIN.password, "ADMIN_PASSWORD must be set in .env").toBeTruthy();
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(ADMIN.email);
  await page.getByLabel("Password").fill(ADMIN.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin\/?$/);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await page.context().storageState({ path: "e2e/.auth/admin.json" });
});
