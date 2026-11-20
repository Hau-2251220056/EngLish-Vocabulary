import { expect, test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";
import {
  createArtifact,
  findDuplicateRequests,
  normalizeRequestUrl,
} from "../../performance/measurement.js";

test("production browser and guarded API collectors emit a scrubbed deterministic smoke artifact", async ({ browser, request }, testInfo) => {
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await context.newPage();
  const requests = [];

  await page.route("**/api/auth/me", (route) => route.fulfill({
    status: 401,
    json: { success: false, error: { code: "AUTHENTICATION_REQUIRED" } },
  }));
  page.on("request", (entry) => requests.push({
    method: entry.method(),
    url: normalizeRequestUrl(entry.url()),
  }));

  const routeStartedAt = performance.now();
  await page.goto("/login");
  await expect(page.getByRole("textbox", { name: "Email" })).toBeVisible();
  const readinessMs = performance.now() - routeStartedAt;
  const resources = await page.evaluate(() => performance.getEntriesByType("resource").map((entry) => ({
    name: new URL(entry.name).pathname,
    duration_ms: Number(entry.duration.toFixed(3)),
    transfer_size: entry.transferSize,
  })));

  const apiStartedAt = performance.now();
  const apiResponse = await request.get("http://127.0.0.1:5012/api/topics");
  const apiDurationMs = performance.now() - apiStartedAt;
  expect(apiResponse.ok()).toBeTruthy();
  const snapshotResponse = await request.get("http://127.0.0.1:5012/__performance/snapshot");
  expect(snapshotResponse.ok()).toBeTruthy();
  const backendSnapshot = await snapshotResponse.json();
  expect(backendSnapshot.preservation.unchanged).toBe(true);
  expect(backendSnapshot.queries.length).toBeGreaterThan(0);

  const artifact = createArtifact({
    environment: {
      kind: "harness-smoke-not-baseline",
      frontend_mode: "production-preview",
      browser: testInfo.project.name,
      viewport: "1366x768",
    },
    samples: [{
      readiness_ms: Number(readinessMs.toFixed(3)),
      api_duration_ms: Number(apiDurationMs.toFixed(3)),
      request_count: requests.length,
      duplicate_requests: findDuplicateRequests(requests),
      requests,
      resources,
      backend: backendSnapshot,
    }],
  });
  const body = JSON.stringify(artifact, null, 2);
  expect(body).not.toMatch(/authorization|session_id|postgres(?:ql)?:\/\//i);
  const outputDirectory = resolve(import.meta.dirname, "../../test-results/performance");
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(resolve(outputDirectory, "browser-smoke.json"), `${body}\n`, "utf8");
  await testInfo.attach("scrubbed-smoke-artifact", { body, contentType: "application/json" });
  await context.close();
});
