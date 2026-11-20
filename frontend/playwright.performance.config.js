import { defineConfig, devices } from "@playwright/test";
import process from "node:process";
import { PERFORMANCE_PORTS, PERFORMANCE_RUN_POLICY } from "./performance/performance-config.js";

export default defineConfig({
  testDir: "./e2e/performance",
  testMatch: process.env.DISCOVERY_COMPOSITION_CHECK === "true"
    ? "discovery-composition.spec.js"
    : process.env.PERFORMANCE_FULL_BASELINE === "true"
      ? "baseline.spec.js"
      : "harness-smoke.spec.js",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: process.env.PERFORMANCE_FULL_BASELINE === "true" || process.env.DISCOVERY_COMPOSITION_CHECK === "true"
    ? 900_000
    : 60_000,
  expect: { timeout: 15_000 },
  use: {
    actionTimeout: 20_000,
    baseURL: `http://127.0.0.1:${PERFORMANCE_PORTS.frontend}`,
    viewport: PERFORMANCE_RUN_POLICY.primaryViewport,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  reporter: "list",
  outputDir: "test-results/performance",
  globalSetup: "./e2e/performance/global-setup.js",
  globalTeardown: "./e2e/performance/global-teardown.js",
  projects: [{ name: "chromium-performance-smoke", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "node --env-file=../backend/.env.test ../backend/test/scripts/start-performance-server.js",
      env: { PERFORMANCE_BACKEND_PORT: String(PERFORMANCE_PORTS.backend) },
      url: `http://127.0.0.1:${PERFORMANCE_PORTS.backend}/`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: "node performance/serve-production.js",
      env: {
        PERFORMANCE_FRONTEND_PORT: String(PERFORMANCE_PORTS.frontend),
        PERFORMANCE_API_TARGET: `http://127.0.0.1:${PERFORMANCE_PORTS.backend}`,
      },
      url: `http://127.0.0.1:${PERFORMANCE_PORTS.frontend}/login`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
