import { defineConfig, devices } from "@playwright/test";

// Full end-to-end suite. Runs against a LOCAL production build + mock YouPI gateway,
// so it never creates real orders. For a read-only check of the live site use
// playwright.prod.config.ts (npm run test:e2e:prod).
try {
  process.loadEnvFile(".env");
} catch {
  /* CI provides env directly */
}

const PORT = Number(process.env.E2E_PORT || 3100);
const MOCK_PORT = Number(process.env.E2E_MOCK_PORT || 6200);
const DB_PORT = Number(process.env.E2E_DB_PORT || 54329);
const DB_READY_PORT = Number(process.env.E2E_DB_READY_PORT || 54330);
export const BASE_URL = `http://localhost:${PORT}`;

// Tests run against a throwaway Postgres (scripts/e2e-db.mjs), never your dev or prod DB.
const E2E_DB_URL = `postgresql://postgres:postgres@localhost:${DB_PORT}/utu_e2e`;
process.env.DATABASE_URL = E2E_DB_URL;
process.env.DIRECT_URL = E2E_DB_URL;

process.env.E2E_BASE_URL = BASE_URL;
process.env.E2E_MOCK_URL = `http://localhost:${MOCK_PORT}`;

const serverEnv = {
  DATABASE_URL: E2E_DB_URL,
  DIRECT_URL: E2E_DB_URL,
  APP_URL: BASE_URL,
  YOUPI_API_URL: `http://localhost:${MOCK_PORT}`,
  NEXT_DIST_DIR: ".next-e2e",
  RESEND_API_KEY: "", // never send real email from tests
  RAZORPAY_KEY_ID: "",
  RAZORPAY_KEY_SECRET: "",
};

export default defineConfig({
  testDir: "./e2e",
  testIgnore: ["**/prod-smoke.spec.ts"],
  globalTeardown: "./e2e/global-teardown.ts",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1, // tests share one database + global settings
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], storageState: "e2e/.auth/admin.json" },
      dependencies: ["setup"],
      testIgnore: ["**/mobile.spec.ts", "**/prod-smoke.spec.ts"],
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] },
      testMatch: /mobile\.spec\.ts/,
    },
  ],
  webServer: [
    {
      command: "node scripts/e2e-db.mjs",
      url: `http://localhost:${DB_READY_PORT}`,
      env: { E2E_DB_PORT: String(DB_PORT), E2E_DB_READY_PORT: String(DB_READY_PORT) },
      reuseExistingServer: false,
      timeout: 180_000,
      stdout: "pipe",
    },
    {
      command: "node scripts/mock-youpi.mjs",
      port: MOCK_PORT,
      env: { ...serverEnv, MOCK_PORT: String(MOCK_PORT) },
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: `npx next build && npx next start -p ${PORT}`,
      url: `${BASE_URL}/api/admin/orders.csv`, // 401 = server is up
      env: serverEnv,
      reuseExistingServer: !process.env.CI,
      timeout: 300_000,
      stdout: "ignore",
    },
  ],
});
