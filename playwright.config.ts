import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests.
 *
 * Run against a real build of the application with the bundled database, so the
 * flows exercised here are the ones a member actually walks through — real
 * sessions, real transactions, real money arithmetic.
 *
 * A setup project signs in once per role and saves the session; every other
 * spec reuses it. That keeps the suite fast and, more importantly, keeps it
 * inside the sign-in rate limit rather than requiring that limit to be relaxed
 * for testing.
 *
 * One worker throughout: the bundled database permits a single writer.
 */

const SESSIONS = path.join(process.cwd(), "tests/.sessions");

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  timeout: 90_000,
  expect: { timeout: 15_000 },

  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },

  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },

    {
      name: "desktop",
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },

    // Mobile runs the public, signed-out surface: the layouts that differ most
    // between widths are the shop grid, the gallery and the listing page.
    {
      name: "mobile",
      dependencies: ["setup"],
      use: { ...devices["Pixel 7"] },
      testIgnore: /owner\.spec\.ts/,
    },
  ],

  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: "ignore",
    stderr: "pipe",
  },

  outputDir: path.join(process.cwd(), "test-results"),
  metadata: { sessions: SESSIONS },
});
