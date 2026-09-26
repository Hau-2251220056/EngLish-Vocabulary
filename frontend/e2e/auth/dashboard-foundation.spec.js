import { expect, test } from "@playwright/test";
import {
  installAuthApiMock,
  publicAdmin,
  publicUser,
  responses,
} from "./fixtures/auth-api.js";

test("USER composes independent Progress and bounded My Sets sources", async ({ page }) => {
  await page.addInitScript(() => {
    Date.prototype.getHours = () => 5;
  });
  await installAuthApiMock(page, {
    "/api/auth/me": responses.currentUser(publicUser),
  });
  const progress = deferredRoutes();
  const retrySets = deferredRoutes();
  let setCalls = 0;
  let retryingSets = false;
  await page.route("**/api/learning/progress**", (route) => progress.handle(route));
  await page.route("**/api/my/vocabulary-sets", async (route) => {
    setCalls += 1;
    if (!retryingSets) {
      await route.fulfill({ status: 500, json: { success: false, error: { code: "INTERNAL_SERVER_ERROR" } } });
      return;
    }
    await retrySets.handle(route);
  });

  await page.goto("/dashboard");
  await expect(page.getByText(`Chào buổi sáng, ${publicUser.display_name}.`)).toBeVisible();
  await expect(page.getByRole("status", { name: "" }).filter({ hasText: "Đang tải tóm tắt học tập" })).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("Không thể tải bộ từ riêng");

  await progress.fulfill(progressResponse({ total_started: 8, learning: 3, learned: 4, needs_review: 1 }));
  const summary = page.getByRole("group", { name: "Tóm tắt tiến độ" });
  await expect(summary).toContainText("Tổng đã bắt đầu8");
  await expect(summary).toContainText("Đang học3");
  await expect(summary).toContainText("Đã thuộc4");
  await expect(summary).not.toContainText("Cần ôn");

  const retry = page.getByRole("button", { name: "Thử lại" });
  const callsBeforeRetry = setCalls;
  retryingSets = true;
  await retry.dblclick();
  await expect(retry).toHaveCount(0);
  await expect.poll(() => setCalls).toBe(callsBeforeRetry + 1);
  await retrySets.fulfill(setsResponse());

  const preview = page.getByRole("list", { name: "Bộ từ riêng xem trước" });
  await expect(page.getByText("Bạn có 4 bộ từ riêng.")).toBeVisible();
  await expect(preview.getByRole("listitem")).toHaveCount(3);
  await expect(preview).toContainText("Set one");
  await expect(preview).toContainText("Set three");
  await expect(preview).not.toContainText("Set four");
  await expect(preview.getByRole("link", { name: "Học bộ từ" })).toHaveCount(2);
  await expect(preview.getByRole("listitem").first().getByRole("link", { name: "Học bộ từ" })).toHaveCount(0);
  await expect(preview.getByRole("link", { name: "Xem bộ từ" })).toHaveCount(3);
  await expect(page.getByRole("heading", { name: "Bộ từ riêng của bạn" })).toBeFocused();
  const quickLinks = page.getByRole("navigation", { name: "Lối tắt Dashboard" });
  await expect(quickLinks.getByRole("link")).toHaveCount(3);
  await expect(quickLinks.getByRole("link", { name: /Khám phá chủ đề/ })).toHaveAttribute("href", "/topics");
});

test("ADMIN receives a neutral landing with zero USER-only API calls", async ({ page }) => {
  await installAuthApiMock(page, {
    "/api/auth/me": responses.currentUser(publicAdmin),
  });
  let userApiCalls = 0;
  await page.route("**/api/learning/progress**", async (route) => {
    userApiCalls += 1;
    await route.abort("failed");
  });
  await page.route("**/api/my/vocabulary-sets", async (route) => {
    userApiCalls += 1;
    await route.abort("failed");
  });

  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: `Xin chào, ${publicAdmin.display_name}.` })).toBeVisible();
  await expect(page.getByRole("main").getByText("Dashboard", { exact: true })).toBeVisible();
  await expect(page.getByText("điểm bắt đầu an toàn cho tài khoản quản trị")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Tóm tắt học tập" })).toHaveCount(0);
  await page.waitForTimeout(100);
  expect(userApiCalls).toBe(0);
});

test("an unmounted Dashboard request cannot replace a newer visit", async ({ page }) => {
  await installAuthApiMock(page, {
    "/api/auth/me": responses.currentUser(publicUser),
  });
  const staleProgress = deferredRoutes();
  let serveFreshProgress = false;
  await page.route("**/api/learning/progress**", async (route) => {
    if (!serveFreshProgress) {
      await staleProgress.handle(route);
      return;
    }
    await route.fulfill(progressResponse({ total_started: 12, learning: 5, learned: 7, needs_review: 0 }));
  });
  await page.route("**/api/my/vocabulary-sets", (route) =>
    route.fulfill({ status: 200, json: { success: true, data: [] } }),
  );
  await page.route("**/api/topics", (route) =>
    route.fulfill({ status: 200, json: { success: true, data: [] } }),
  );

  await page.goto("/dashboard");
  await expect(page.getByText("Đang tải tóm tắt học tập…")).toBeVisible();
  await page.goto("/topics");
  serveFreshProgress = true;
  await page.goto("/dashboard");
  await expect(page.getByRole("group", { name: "Tóm tắt tiến độ" })).toContainText("Tổng đã bắt đầu12");
  await staleProgress.fulfill(progressResponse({ total_started: 99, learning: 99, learned: 0, needs_review: 0 }));
  await expect(page.getByRole("group", { name: "Tóm tắt tiến độ" })).toContainText("Tổng đã bắt đầu12");
  await expect(page.getByRole("group", { name: "Tóm tắt tiến độ" })).not.toContainText("99");
});

test("first-use USER sees independent persisted-progress and private-Set empty states", async ({ page }) => {
  await installAuthApiMock(page, {
    "/api/auth/me": responses.currentUser(publicUser),
  });
  await page.route("**/api/learning/progress**", (route) =>
    route.fulfill(progressResponse({ total_started: 0, learning: 0, learned: 0, needs_review: 0 })),
  );
  await page.route("**/api/my/vocabulary-sets", (route) =>
    route.fulfill({ status: 200, json: { success: true, data: [] } }),
  );

  await page.goto("/dashboard");

  const summary = page.getByRole("group", { name: "Tóm tắt tiến độ" });
  await expect(summary).toContainText("Tổng đã bắt đầu0");
  await expect(summary).toContainText("Đang học0");
  await expect(summary).toContainText("Đã thuộc0");
  await expect(page.getByRole("heading", { name: "Bạn chưa bắt đầu học từ vựng nào" })).toBeVisible();
  await expect(page.getByText("Bạn có 0 bộ từ riêng.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Bạn chưa có bộ từ riêng" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Học bộ từ" })).toHaveCount(0);
});

test("Progress failure preserves successful Sets and supports one keyboard retry with predictable focus", async ({ page }) => {
  await installAuthApiMock(page, {
    "/api/auth/me": responses.currentUser(publicUser),
  });
  const retriedProgress = deferredRoutes();
  let progressCalls = 0;
  let retryingProgress = false;
  await page.route("**/api/learning/progress**", async (route) => {
    progressCalls += 1;
    if (!retryingProgress) {
      await route.fulfill({ status: 500, json: { success: false, error: { code: "INTERNAL_SERVER_ERROR" } } });
      return;
    }
    await retriedProgress.handle(route);
  });
  await page.route("**/api/my/vocabulary-sets", (route) => route.fulfill(setsResponse()));

  await page.goto("/dashboard");

  await expect(page.getByRole("list", { name: "Bộ từ riêng xem trước" })).toBeVisible();
  const progressSection = page.locator(".dashboard-progress-section");
  const retry = progressSection.getByRole("button", { name: "Thử lại" });
  await expect(progressSection.getByRole("alert")).toContainText("Không thể tải tóm tắt học tập");
  await retry.focus();
  const callsBeforeRetry = progressCalls;
  retryingProgress = true;
  await page.keyboard.press("Enter");
  await expect(progressSection.getByRole("status")).toContainText("Đang tải tóm tắt học tập");
  await expect(retry).toHaveCount(0);
  await expect.poll(() => progressCalls).toBe(callsBeforeRetry + 1);

  await retriedProgress.fulfill(progressResponse({ total_started: 3, learning: 2, learned: 1, needs_review: 0 }));
  await expect(progressSection.getByRole("group", { name: "Tóm tắt tiến độ" })).toContainText("Tổng đã bắt đầu3");
  await expect(page.getByRole("heading", { name: "Tiến độ học tập" })).toBeFocused();
});

for (const viewport of [
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1366, height: 768 },
]) {
  test(`${viewport.name} Dashboard reflows long real content without horizontal overflow`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await installAuthApiMock(page, {
      "/api/auth/me": responses.currentUser({
        ...publicUser,
        display_name: "Learner With An Unusually Long Authenticated Display Name",
      }),
    });
    await page.route("**/api/learning/progress**", (route) =>
      route.fulfill(progressResponse({ total_started: 12, learning: 5, learned: 7, needs_review: 0 })),
    );
    await page.route("**/api/my/vocabulary-sets", (route) =>
      route.fulfill({
        status: 200,
        json: {
          success: true,
          data: [
            setSummary("long-set", "A private Vocabulary Set with a deliberately long name that must wrap safely", 6),
          ],
        },
      }),
    );

    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Learner With An Unusually Long");
    await expect(page.getByRole("group", { name: "Tóm tắt tiến độ" })).toBeVisible();
    await expect(page.getByRole("list", { name: "Bộ từ riêng xem trước" })).toBeVisible();
    const overflow = await page.evaluate(() => ({
      body: document.body.scrollWidth - document.body.clientWidth,
      document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }));
    expect(overflow.body).toBeLessThanOrEqual(1);
    expect(overflow.document).toBeLessThanOrEqual(1);
  });
}

test("Dashboard removes non-essential animation when reduced motion is requested", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await installAuthApiMock(page, {
    "/api/auth/me": responses.currentUser(publicUser),
  });
  const progress = deferredRoutes();
  const sets = deferredRoutes();
  await page.route("**/api/learning/progress**", (route) => progress.handle(route));
  await page.route("**/api/my/vocabulary-sets", (route) => sets.handle(route));

  await page.goto("/dashboard");
  const loadingCard = page.locator(".dashboard-loading span").first();
  await expect(loadingCard).toBeVisible();
  await expect(loadingCard).toHaveCSS("animation-name", "none");

  await Promise.all([
    progress.fulfill(progressResponse({ total_started: 1, learning: 1, learned: 0, needs_review: 0 })),
    sets.fulfill(setsResponse()),
  ]);
  const quickLink = page.getByRole("navigation", { name: "Lối tắt Dashboard" }).getByRole("link").first();
  await expect(quickLink).toHaveCSS("transition-duration", "0s");
});

function progressResponse(summary) {
  return {
    status: 200,
    json: {
      success: true,
      data: {
        summary,
        items: [],
        pagination: { page: 1, page_size: 1, total_items: summary.total_started, total_pages: summary.total_started ? summary.total_started : 0 },
        filter: { status: null },
      },
    },
  };
}

function setsResponse() {
  return {
    status: 200,
    json: {
      success: true,
      data: [
        setSummary("set-1", "Set one", 0),
        setSummary("set-2", "Set two", 2),
        setSummary("set-3", "Set three", 5),
        setSummary("set-4", "Set four", 1),
      ],
    },
  };
}

function setSummary(id, name, itemCount) {
  return { id, name, description: null, item_count: itemCount };
}

function deferredRoutes() {
  const routes = [];
  let response;
  return {
    async handle(nextRoute) {
      routes.push(nextRoute);
      if (response) await nextRoute.fulfill(response);
    },
    async fulfill(nextResponse) {
      response = nextResponse;
      await Promise.allSettled(routes.map((route) => route.fulfill(response)));
    },
  };
}
