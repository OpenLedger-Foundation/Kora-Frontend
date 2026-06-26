import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E configuration for Kora Protocol frontend.
 *
 * Runs against the local Next.js dev server (or a pre-built production server
 * in CI).  All tests use mock data — no live Stellar RPC calls are made.
 *
 * CI usage:
 *   npx playwright test --reporter=html
 */
export default defineConfig({
  testDir: "./e2e",
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter: HTML for CI artifact, list for local dev */
  reporter: process.env.CI
    ? [["html", { outputFolder: "playwright-report", open: "never" }]]
    : [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],

  use: {
    /* Base URL so tests can use relative paths like page.goto('/') */
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    /* Collect trace on first retry for debugging */
    trace: "on-first-retry",
    /* Screenshot on failure */
    screenshot: "only-on-failure",
    /* Video on first retry */
    video: "on-first-retry",
    /* Viewport */
    viewport: { width: 1280, height: 800 },
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  /* Start the Next.js dev server before running tests */
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
