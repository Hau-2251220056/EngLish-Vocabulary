import { defineConfig, devices } from "@playwright/test";
import process from "node:process";

const frontendPort = 4174;

export default defineConfig({
  testDir: "./e2e/integration",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: "list",
  outputDir: "test-results/integration",
  globalSetup: "./e2e/integration/global-setup.js",
  use: {
    baseURL: `http://127.0.0.1:${frontendPort}`,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium-real-stack",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "node ../backend/test/scripts/start-integration-server.js",
      url: "http://127.0.0.1:5000/",
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `npm run dev -- --host 127.0.0.1 --port ${frontendPort} --strictPort`,
      url: `http://127.0.0.1:${frontendPort}/login`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
