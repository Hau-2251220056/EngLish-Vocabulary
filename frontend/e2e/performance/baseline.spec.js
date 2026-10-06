import { expect, test } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { createArtifact, findDuplicateRequests, normalizeRequestUrl } from "../../performance/measurement.js";
import { FIXTURE_PATH, PERFORMANCE_PASSWORD } from "./fixture.js";

const backendOrigin = "http://127.0.0.1:5012";
const outputPath = resolve(import.meta.dirname, "../../test-results/performance/baseline.json");
const flows = [];
let fixture;

test.describe.configure({ mode: "serial" });
test.beforeAll(async () => { fixture = JSON.parse(await readFile(FIXTURE_PATH, "utf8")); });
test.afterAll(async () => {
  const artifact = createArtifact({
    environment: {
      kind: "performance-v1-before",
      frontend_mode: "production-build",
      frontend_port: 4186,
      backend_port: 5012,
      database_path: "dedicated-remote-test",
      browser: "chromium",
      viewport: "1366x768",
      warmups_per_condition: 1,
      measured_runs_per_condition: 5,
    },
    samples: flows,
  });
  await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
});

test("TASK-114 measures cold and warm Guest Login", async ({ browser, request }) => {
  flows.push(await benchmark("BF-01-cold-login", request, async () => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const result = await measurePage(page, async () => {
      await page.goto("/login");
      await expect(page.locator("#login-email")).toBeVisible();
    });
    await context.close();
    return result;
  }));

  flows.push(await benchmark("BF-01-warm-login-reload", request, async () => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("/login");
    await expect(page.locator("#login-email")).toBeVisible();
    await resetBackendObservation(request);
    const result = await measurePage(page, async () => {
      await page.reload();
      await expect(page.locator("#login-email")).toBeVisible();
    });
    await context.close();
    return result;
  }));
});

test("TASK-115 measures Login submission and session restore", async ({ browser, request }) => {
  flows.push(await benchmark("BF-02-login-to-dashboard", request, async () => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("/login");
    await page.locator("#login-email").fill(fixture.user.email);
    await page.locator("#login-password").fill(PERFORMANCE_PASSWORD);
    await resetBackendObservation(request);
    const result = await measurePage(page, async () => {
      await page.locator('form button[type="submit"]').click();
      await expect(page.locator(".dashboard-page")).toBeVisible();
      await expect(page.getByRole("group", { name: "Tóm tắt tiến độ" })).toBeVisible();
      await expect(page.getByText(fixture.owned_set_name, { exact: true })).toBeVisible();
    });
    await context.close();
    return result;
  }));

  flows.push(await benchmark("BF-02-authenticated-restore", request, async () => {
    const context = await browser.newContext();
    await authenticate(context);
    await resetBackendObservation(request);
    const page = await context.newPage();
    const result = await measurePage(page, async () => {
      await page.goto("/dashboard");
      await expect(page.locator(".dashboard-page")).toBeVisible();
      await expect(page.getByRole("group", { name: "Tóm tắt tiến độ" })).toBeVisible();
      await expect(page.getByText(fixture.owned_set_name, { exact: true })).toBeVisible();
    });
    await context.close();
    return result;
  }));
});

test("TASK-116 measures Dashboard independent sources", async ({ browser, request }) => {
  flows.push(await authenticatedRouteBenchmark("BF-03-dashboard", browser, request, "/dashboard", async (page) => {
    await expect(page.getByRole("group", { name: "Tóm tắt tiến độ" })).toBeVisible();
    await expect(page.getByText(fixture.owned_set_name, { exact: true })).toBeVisible();
  }));
});

test("TASK-117 measures Owned Sets", async ({ browser, request }) => {
  flows.push(await authenticatedRouteBenchmark("BF-04A-owned-sets", browser, request, "/my/vocabulary-sets", async (page) => {
    await expect(page.getByText(fixture.owned_set_name, { exact: true })).toBeVisible();
  }));
});

test("TASK-118 measures owned Set Detail", async ({ browser, request }) => {
  flows.push(await authenticatedRouteBenchmark("BF-04B-owned-set-detail", browser, request, `/my/vocabulary-sets/${fixture.owned_set_id}`, async (page) => {
    await expect(page.getByRole("heading", { name: fixture.owned_set_name })).toBeVisible();
    await expect(page.getByRole("table").locator("tbody tr")).toHaveCount(6);
  }));
});

test("TASK-119 measures non-mutating SRS load, flip, restart and re-entry", async ({ browser, request }) => {
  flows.push(await benchmark("BF-05-flashcard-srs", request, async () => {
    const context = await browser.newContext();
    await authenticate(context);
    await resetBackendObservation(request);
    const page = await context.newPage();
    const result = await measurePage(page, async (measurement) => {
      const entryStarted = performance.now();
      await page.goto(`/learn/vocabulary-sets/${fixture.owned_set_id}`);
      await expect(page.locator(".learning-card-flipper")).toBeVisible();
      const firstCardMs = round(performance.now() - entryStarted);
      const flipStarted = performance.now();
      await page.getByRole("heading", { name: `${fixture.prefix} word-1`, exact: true }).press("Space");
      await expect(page.getByRole("button", { name: /^Tốt,/ })).toBeVisible();
      const flipMs = round(performance.now() - flipStarted);
      const normalStarted = performance.now();
      await page.getByRole("button", { name: "Ôn tập thường" }).click();
      await expect(page.getByText(/Thẻ 1 \/ 6/)).toBeVisible();
      const normalSwitchMs = round(performance.now() - normalStarted);
      const restartStarted = performance.now();
      await page.getByRole("button", { name: "Bắt đầu lại" }).click();
      await expect(page.getByText(/Thẻ 1 \/ 6/)).toBeVisible();
      const restartMs = round(performance.now() - restartStarted);
      const reentryStarted = performance.now();
      await page.goto(`/learn/vocabulary-sets/${fixture.owned_set_id}`);
      await expect(page.locator(".learning-card-flipper")).toBeVisible();
      const reentryMs = round(performance.now() - reentryStarted);
      resultInteractions(measurement, {
        first_card_ms: firstCardMs,
        flip_ms: flipMs,
        normal_switch_ms: normalSwitchMs,
        restart_ms: restartMs,
        reentry_ms: reentryMs,
      });
    });
    await context.close();
    return result;
  }));
});

test("TASK-120 measures Topics and public discovery", async ({ browser, request }) => {
  flows.push(await benchmark("BF-06-topics-public-discovery", request, async () => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const result = await measurePage(page, async () => {
      await page.goto("/topics");
      await expect(page.getByText(`${fixture.prefix} Travel`, { exact: true })).toBeVisible();
      await page.locator(`a[href="/topics/${fixture.topic_id}"]`).click();
      await page.locator(`a[href="/topics/${fixture.topic_id}/vocabulary-sets"]`).click();
      await expect(page.getByText(fixture.public_set_name, { exact: true })).toBeVisible();
      await page.locator(`a[href="/vocabulary-sets/${fixture.public_set_id}"]`).click();
      await expect(page.getByRole("heading", { name: fixture.public_set_name })).toBeVisible();
    });
    await context.close();
    return result;
  }));
});

async function authenticatedRouteBenchmark(name, browser, request, path, ready) {
  return benchmark(name, request, async () => {
    const context = await browser.newContext();
    await authenticate(context);
    await resetBackendObservation(request);
    const page = await context.newPage();
    const result = await measurePage(page, async () => {
      await page.goto(path);
      await ready(page);
    });
    await context.close();
    return result;
  });
}

async function benchmark(name, request, run) {
  const samples = [];
  for (let index = 0; index < 6; index += 1) {
    await request.post(`${backendOrigin}/__performance/reset`);
    const sample = await run();
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
    const snapshot = await (await request.get(`${backendOrigin}/__performance/snapshot`)).json();
    sample.backend = {
      requests: snapshot.requests.filter(({ path }) => !path.startsWith("/__performance")),
      queries: snapshot.queries,
      preservation: snapshot.preservation,
    };
    if (index > 0) samples.push(sample);
  }
  return { name, warmup_runs: 1, measured_runs: samples.length, samples };
}

async function resetBackendObservation(request) {
  await request.post(`${backendOrigin}/__performance/reset`);
}

async function authenticate(context) {
  const page = await context.newPage();
  await page.goto("/login");
  await page.locator("#login-email").fill(fixture.user.email);
  await page.locator("#login-password").fill(PERFORMANCE_PASSWORD);
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("group", { name: "Tóm tắt tiến độ" })).toBeVisible();
  await expect(page.getByText(fixture.owned_set_name, { exact: true })).toBeVisible();
  await page.close();
}

async function measurePage(page, action) {
  const requests = [];
  const starts = new Map();
  const statuses = [];
  await page.addInitScript(() => {
    window.__performanceObservations = { layout_shifts: [], statuses: [] };
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__performanceObservations.layout_shifts.push(entry.value);
      }).observe({ type: "layout-shift", buffered: true });
    } catch { /* Browser may not expose layout-shift entries. */ }
    addEventListener("DOMContentLoaded", () => {
      const capture = () => document.querySelectorAll('[role="status"]').forEach((element) => {
        const text = element.textContent.trim();
        if (text && !window.__performanceObservations.statuses.includes(text)) window.__performanceObservations.statuses.push(text);
      });
      new MutationObserver(capture).observe(document.body, { childList: true, subtree: true, characterData: true });
      capture();
    });
  });
  page.on("request", (entry) => {
    starts.set(entry, performance.now());
    requests.push({ method: entry.method(), url: normalizeRequestUrl(entry.url()), order: requests.length + 1, status: null, duration_ms: null });
  });
  page.on("response", (response) => {
    const entry = response.request();
    const record = requests.findLast((candidate) => candidate.method === entry.method() && candidate.url === normalizeRequestUrl(entry.url()) && candidate.status === null);
    if (record) { record.status = response.status(); record.duration_ms = round(performance.now() - (starts.get(entry) ?? performance.now())); }
  });
  const started = performance.now();
  const result = {};
  await action(result);
  await page.waitForTimeout(50);
  const observations = await page.evaluate(() => window.__performanceObservations ?? {
    layout_shifts: [],
    statuses: [],
  });
  statuses.push(...observations.statuses);
  const resources = await page.evaluate(() => performance.getEntriesByType("resource").map((entry) => ({
    path: new URL(entry.name).pathname,
    duration_ms: Number(entry.duration.toFixed(3)),
    transfer_size: entry.transferSize,
  })));
  return {
    readiness_ms: round(performance.now() - started),
    request_count: requests.length,
    requests,
    duplicates: findDuplicateRequests(requests),
    resources,
    loading_statuses: statuses,
    layout_shift_total: round(observations.layout_shifts.reduce((sum, value) => sum + value, 0)),
    interactions: result.interactions ?? null,
  };
}

function resultInteractions(result, interactions) { result.interactions = interactions; }
function round(value) { return Number(value.toFixed(3)); }
