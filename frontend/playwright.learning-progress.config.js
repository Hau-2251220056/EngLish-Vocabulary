import { defineConfig, devices } from "@playwright/test";
import process from "node:process";

const backendPort = 5008;
const frontendPort = 4182;

export default defineConfig({
  testDir: "./e2e/integration",
  testMatch: "learning-progress-real-stack.spec.js",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 25_000 },
  reporter: "list",
  outputDir: "test-results/learning-progress",
  globalSetup: "./e2e/integration/global-setup.js",
  use: {
    baseURL: `http://127.0.0.1:${frontendPort}`,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium-learning-progress-real-stack",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "node ../backend/test/scripts/start-integration-server.js",
      env: { INTEGRATION_PORT: String(backendPort) },
      url: `http://127.0.0.1:${backendPort}/`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `npm run dev -- --host 127.0.0.1 --port ${frontendPort} --strictPort`,
      env: { API_PROXY_TARGET: `http://127.0.0.1:${backendPort}` },
      url: `http://127.0.0.1:${frontendPort}/login`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
