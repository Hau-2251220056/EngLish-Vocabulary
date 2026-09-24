import { defineConfig, devices } from "@playwright/test";
import process from "node:process";

const backendPort = 5005;
const frontendPort = 4179;

export default defineConfig({
  testDir: "./e2e/integration",
  testMatch: "vocabulary-set-user-real-stack.spec.js",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: "list",
  outputDir: "test-results/vocabulary-set-user",
  globalSetup: "./e2e/integration/global-setup.js",
  use: { baseURL: `http://127.0.0.1:${frontendPort}`, screenshot: "only-on-failure", trace: "retain-on-failure" },
  projects: [{ name: "chromium-vocabulary-set-user", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    { command: "node ../backend/test/scripts/start-integration-server.js", env: { INTEGRATION_PORT: String(backendPort) }, url: `http://127.0.0.1:${backendPort}/`, reuseExistingServer: false, timeout: 60_000 },
    { command: `npm run dev -- --host 127.0.0.1 --port ${frontendPort} --strictPort`, env: { API_PROXY_TARGET: `http://127.0.0.1:${backendPort}` }, url: `http://127.0.0.1:${frontendPort}/login`, reuseExistingServer: false, timeout: 60_000 },
  ],
});
