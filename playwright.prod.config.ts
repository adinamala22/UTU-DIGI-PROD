import { defineConfig, devices } from "@playwright/test";

// Read-only smoke test of the deployed site.
export default defineConfig({
  testDir: "./e2e",
  testMatch: /prod-smoke\.spec\.ts/,
  timeout: 30_000,
  retries: 1,
  reporter: [["list"]],
  use: { baseURL: process.env.PROD_URL || "https://shop.urltuneup.com", trace: "retain-on-failure" },
  projects: [
    { name: "prod-desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "prod-mobile", use: { ...devices["Pixel 7"] } },
  ],
});
