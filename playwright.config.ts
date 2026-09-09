import { defineConfig, type PlaywrightTestConfig } from "@playwright/test";

process.loadEnvFile?.(".env.local");

const config: PlaywrightTestConfig = {
  testDir: "./e2e/tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  timeout: 30_000,
  expect: { timeout: 10_000 },
  webServer: {
    command: "npm run dev:admin",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 90_000,
  },
};

export default defineConfig(config);
