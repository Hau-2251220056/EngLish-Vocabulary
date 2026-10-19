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
  await expect(page.getByRole("heading", { name: `Chào buổi sáng, ${publicUser.display_name}` })).toBeVisible();
  await expect(page.getByRole("status", { name: "" }).filter({ hasText: "Đang tải tóm tắt học tập" })).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("Không thể tải bộ từ riêng");

  await progress.fulfill(progressResponse({ total_started: 8, learning: 3, learned: 4, needs_review: 1 }));
  await expect(page.getByRole("region", { name: "XP và cấp độ" })).toContainText("Level 2");
  await expect(page.getByRole("region", { name: "XP và cấp độ" })).toContainText("75 XP");
  await expect(page.getByRole("progressbar", { name: "Tiến độ XP Level 2" })).toHaveAttribute("aria-valuenow", "75");
  await expect(page.getByRole("progressbar", { name: "Tiến độ XP Level 2" })).toHaveAttribute("aria-valuemin", "50");
  await expect(page.getByRole("progressbar", { name: "Tiến độ XP Level 2" })).toHaveAttribute("aria-valuemax", "150");
  await expect(page.getByRole("progressbar", { name: "Tiến độ XP Level 2" }).locator("span")).toHaveAttribute("style", "width: 25%;");
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
  await expect(page.getByText("Bạn đang có 4 bộ từ riêng.")).toBeVisible();
  await expect(preview.getByRole("listitem")).toHaveCount(3);
  await expect(preview).toContainText("Set one");
  await expect(preview).toContainText("Set three");
  await expect(preview).not.toContainText("Set four");
  await expect(preview.getByRole("link", { name: "Bắt đầu học" })).toHaveCount(2);
  await expect(preview.getByRole("listitem").first().getByRole("link", { name: "Bắt đầu học" })).toHaveCount(0);
  await expect(preview.getByRole("link", { name: "Xem chi tiết" })).toHaveCount(3);
  await expect(page.getByRole("heading", { name: "Bộ từ của bạn" })).toBeFocused();
  await expect(page.getByRole("navigation", { name: "Lối tắt Dashboard" })).toHaveCount(0);
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
  await page.route("**/api/users/me/streak", async (route) => {
    userApiCalls += 1;
    await route.abort("failed");
  });

  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: `Xin chào, ${publicAdmin.display_name}.` })).toBeVisible();
  await expect(page.getByRole("main").getByText("Dashboard", { exact: true })).toHaveCount(0);
  await expect(page.getByText("điểm bắt đầu an toàn cho tài khoản quản trị")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Tóm tắt học tập" })).toHaveCount(0);
  await page.waitForTimeout(100);
  expect(userApiCalls).toBe(0);
});

test("USER Streak card renders completed, pending, and broken states from backend projections", async ({ page }) => {
  await installAuthApiMock(page, {
    "/api/auth/me": responses.currentUser(publicUser),
  });
  let projection = streakResponse({ current_streak: 4, completed_today: true, last_qualified_date: "2026-10-19" });
  await page.route("**/api/users/me/streak", (route) => route.fulfill(projection));

  await page.goto("/dashboard");
  const streak = page.getByRole("region", { name: "Chuỗi học tập" });
  await expect(streak.getByLabel("Chuỗi hiện tại 4 ngày")).toBeVisible();
  await expect(streak).toContainText("Bạn đã duy trì chuỗi hôm nay.");

  projection = streakResponse({ current_streak: 4, completed_today: false, last_qualified_date: "2026-10-18" });
  await streak.getByRole("button", { name: "Làm mới chuỗi học tập" }).click();
  await expect(streak.getByLabel("Chuỗi hiện tại 4 ngày")).toBeVisible();
  await expect(streak).toContainText("hoàn thành một hoạt động đủ điều kiện hôm nay");

  projection = streakResponse({ current_streak: 0, completed_today: false, last_qualified_date: "2026-10-16" });
  await streak.getByRole("button", { name: "Làm mới chuỗi học tập" }).click();
  await expect(streak.getByLabel("Chuỗi hiện tại 0 ngày")).toBeVisible();
  await expect(streak).toContainText("Bắt đầu lại chuỗi");
  await expect(streak).not.toContainText("2026-10-16");
});

test("initial Streak failure never renders successful zero data", async ({ page }) => {
  await installAuthApiMock(page, {
    "/api/auth/me": responses.currentUser(publicUser),
  });
  await page.route("**/api/users/me/streak", (route) => route.fulfill({
    status: 500,
    json: { success: false, error: { code: "INTERNAL_SERVER_ERROR" } },
  }));

  await page.goto("/dashboard");
  const streak = page.getByRole("region", { name: "Chuỗi học tập" });
  await expect(streak.getByRole("alert")).toContainText("Không thể tải chuỗi học tập");
  await expect(streak.getByLabel(/Chuỗi hiện tại/)).toHaveCount(0);
  await expect(streak.getByRole("button", { name: "Thử lại chuỗi học tập" })).toBeVisible();
});

test("Streak failure stays independent, preserves stale data, and supports keyboard retry", async ({ page }) => {
  await installAuthApiMock(page, {
    "/api/auth/me": responses.currentUser(publicUser),
  });
  const retry = deferredRoutes();
  let calls = 0;
  let response = "success";
  await page.route("**/api/users/me/streak", async (route) => {
    calls += 1;
    if (response === "success") {
      await route.fulfill(streakResponse({ current_streak: 3, completed_today: false, last_qualified_date: "2026-10-18" }));
    } else if (response === "error") {
      await route.fulfill({ status: 500, json: { success: false, error: { code: "INTERNAL_SERVER_ERROR" } } });
    } else {
      await retry.handle(route);
    }
  });

  await page.goto("/dashboard");
  const streak = page.getByRole("region", { name: "Chuỗi học tập" });
  await expect(streak.getByLabel("Chuỗi hiện tại 3 ngày")).toBeVisible();
  await expect(page.getByRole("group", { name: "Tóm tắt tiến độ" })).toBeVisible();

  response = "error";
  await streak.getByRole("button", { name: "Làm mới chuỗi học tập" }).click();
  await expect(streak.getByRole("alert")).toContainText("Dữ liệu gần nhất có thể đã cũ.");
  await expect(streak.getByLabel("Chuỗi hiện tại 3 ngày")).toBeVisible();
  await expect(page.getByRole("group", { name: "Tóm tắt tiến độ" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Bạn chưa có bộ từ riêng" })).toBeVisible();

  response = "pending";
  const retryButton = streak.getByRole("button", { name: "Thử lại chuỗi học tập" });
  await retryButton.focus();
  const callsBeforeRetry = calls;
  await page.keyboard.press("Enter");
  await expect(streak.getByRole("status")).toContainText("Đang tải chuỗi học tập");
  await expect.poll(() => calls).toBe(callsBeforeRetry + 1);
  await retry.fulfill(streakResponse({ current_streak: 4, completed_today: true, last_qualified_date: "2026-10-19" }));
  await expect(streak.getByLabel("Chuỗi hiện tại 4 ngày")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Chuỗi học tập" })).toBeFocused();
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
    route.fulfill(progressResponse(
      { total_started: 0, learning: 0, learned: 0, needs_review: 0 },
      { total_xp: 0, level: 1, level_min_xp: 0, next_level_xp: 50, is_max_level: false },
    )),
  );
  await page.route("**/api/my/vocabulary-sets", (route) =>
    route.fulfill({ status: 200, json: { success: true, data: [] } }),
  );

  await page.goto("/dashboard");

  const summary = page.getByRole("group", { name: "Tóm tắt tiến độ" });
  await expect(summary).toContainText("Tổng đã bắt đầu0");
  await expect(summary).toContainText("Đang học0");
  await expect(summary).toContainText("Đã thuộc0");
  await expect(page.getByRole("region", { name: "XP và cấp độ" })).toContainText("Level 1");
  await expect(page.getByRole("region", { name: "XP và cấp độ" })).toContainText("0 XP");
  await expect(page.getByRole("progressbar", { name: "Tiến độ XP Level 1" }).locator("span")).toHaveAttribute("style", "width: 0%;");
  await expect(page.getByRole("heading", { name: "Bạn chưa bắt đầu học từ vựng nào" })).toBeVisible();
  await expect(page.getByText("Không gian học của riêng bạn đang chờ bộ từ đầu tiên.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Bạn chưa có bộ từ riêng" })).toBeVisible();
  await expect(page.getByRole("main").getByRole("link", { name: "Xem tất cả" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Bắt đầu học" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Tạo bộ từ" })).toHaveAttribute("href", "/my/vocabulary-sets");
  await expect(page.getByRole("main").getByRole("link", { name: "Khám phá bộ từ" })).toHaveAttribute("href", "/topics");
});

test("Level 15 renders MAX without a next-level target", async ({ page }) => {
  await installAuthApiMock(page, {
    "/api/auth/me": responses.currentUser(publicUser),
  });
  await page.route("**/api/learning/progress**", (route) =>
    route.fulfill(progressResponse(
      { total_started: 12, learning: 5, learned: 7, needs_review: 0 },
      { total_xp: 6000, level: 15, level_min_xp: 5250, next_level_xp: null, is_max_level: true },
    )),
  );
  await page.route("**/api/my/vocabulary-sets", (route) => route.fulfill(setsResponse()));

  await page.goto("/dashboard");
  const xpSummary = page.getByRole("region", { name: "XP và cấp độ" });
  await expect(xpSummary).toContainText("Level 15 — MAX");
  await expect(xpSummary).toContainText("6.000 XP");
  await expect(xpSummary).toContainText("Đã đạt cấp độ tối đa");
  await expect(xpSummary.getByRole("progressbar")).toHaveCount(0);
  await expect(xpSummary).not.toContainText("cấp tiếp theo");
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
  { name: "narrow-mobile", width: 320, height: 720 },
  { name: "mobile", width: 375, height: 812 },
  { name: "mobile-landscape", width: 667, height: 375 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "compact-desktop", width: 1024, height: 768 },
  { name: "desktop", width: 1440, height: 900 },
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
    await expect(page.getByRole("region", { name: "XP và cấp độ" })).toBeVisible();
    await expect(page.getByRole("progressbar", { name: "Tiến độ XP Level 2" })).toBeVisible();
    await expect(page.getByRole("group", { name: "Tóm tắt tiến độ" })).toBeVisible();
    await expect(page.getByRole("list", { name: "Bộ từ riêng xem trước" })).toBeVisible();
    const overflow = await page.evaluate(() => ({
      body: document.body.scrollWidth - document.body.clientWidth,
      document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }));
    expect(overflow.body).toBeLessThanOrEqual(1);
    expect(overflow.document).toBeLessThanOrEqual(1);
    if (["mobile", "desktop"].includes(viewport.name)) {
      await page.screenshot({
        fullPage: true,
        path: `test-results/task-230-evidence/dashboard-${viewport.name}.png`,
      });
    }
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
  const setCard = page.locator(".dashboard-set-card").first();
  await expect(setCard).toHaveCSS("transition-duration", "0s");
});

function progressResponse(summary, xpLevel = { total_xp: 75, level: 2, level_min_xp: 50, next_level_xp: 150, is_max_level: false }) {
  return {
    status: 200,
    json: {
      success: true,
      data: {
        evaluated_at: "2026-09-24T12:00:00.000Z",
        xp_level: xpLevel,
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

function streakResponse(overrides = {}) {
  return {
    status: 200,
    json: {
      success: true,
      data: {
        current_streak: 0,
        completed_today: false,
        last_qualified_date: null,
        timezone: "Asia/Ho_Chi_Minh",
        evaluated_at: "2026-10-19T09:00:00.000Z",
        ...overrides,
      },
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
