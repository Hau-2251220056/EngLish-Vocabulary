import { defineConfig, devices } from "@playwright/test";
import process from "node:process";

const testPort = 4173;
const googleTestPort = 4175;
const googleSpec = "**/google-authentication.spec.js";

function mockWebServer(port, googleClientId) {
  return {
    command: `npm run dev -- --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}/login`,
    // A space survives process environment handling and trims to an unset GIS ID.
    env: { VITE_GOOGLE_CLIENT_ID: googleClientId },
    reuseExistingServer: false,
    timeout: 60_000,
  };
}

export default defineConfig({
  testDir: "./e2e/auth",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  outputDir: "test-results",
  use: {
    baseURL: `http://127.0.0.1:${testPort}`,
    screenshot: "only-on-failure",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      testIgnore: googleSpec,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "chromium-google-mock",
      testMatch: googleSpec,
      use: { ...devices["Desktop Chrome"], baseURL: `http://127.0.0.1:${googleTestPort}` },
    },
  ],
  webServer: [
    mockWebServer(testPort, " "),
    mockWebServer(googleTestPort, "mock-google-client-id"),
  ],
});
