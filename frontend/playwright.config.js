import { defineConfig, devices } from "@playwright/test";
import process from "node:process";

const testPort = 4173;

export default defineConfig({
  testDir: "./e2e/auth",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  outputDir: "test-results",
  expect: {
    timeout: 15_000,
  },
  use: {
    baseURL: `http://127.0.0.1:${testPort}`,
    screenshot: "only-on-failure",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${testPort} --strictPort`,
    url: `http://127.0.0.1:${testPort}/login`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
