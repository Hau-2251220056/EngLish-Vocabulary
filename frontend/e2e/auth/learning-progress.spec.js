import { expect, test } from "@playwright/test";
import {
  installAuthApiMock,
  publicAdmin,
  publicUser,
  responses,
} from "./fixtures/auth-api.js";

test.beforeEach(async ({ page }) => {
  await installAuthApiMock(page, {
    "/api/auth/me": responses.currentUser(publicUser),
  });
  await installStreakMock(page, currentStreak());
});

test("renders authoritative Progress V2 metrics, activity and overview without word details", async ({ page }) => {
  const pending = deferred();
  await installProgressMock(page, () => pending.promise);

  await page.goto("/my/learning-progress");
  await expect(page.getByRole("status")).toContainText("Đang tải tiến độ học tập");
  pending.resolve(success(populatedProgress()));

  const summary = page.getByRole("region", { name: "Tóm tắt tiến độ" });
  await expect(summary.locator(".learning-progress-summary-card")).toHaveCount(4);
  await expect(summary.getByText("Từ đã học").locator("../..")).toContainText("25");
  await expect(summary.getByText("Từ đã học").locator("../..")).toContainText("chưa nhất thiết đã thuộc");
  await expect(summary.getByText("Đã thuộc").locator("../..")).toContainText("14");
  await expect(summary.getByText("Đang học").locator("../..")).toContainText("9");
  await expect(summary.getByText("Cần ôn").locator("../..")).toContainText("2");

  const activity = page.getByRole("list", { name: "Hoạt động học trong 7 ngày" });
  await expect(activity.getByRole("listitem")).toHaveCount(7);
  await expect(activity.getByRole("listitem").first()).toHaveAccessibleName(/18 tháng 9, 2026: Chưa có dữ liệu/);
  await expect(activity.getByRole("listitem").last()).toHaveAccessibleName(/24 tháng 9, 2026: Có hoạt động, hôm nay/);
  await expect(page.getByText("Một ngày được ghi nhận khi bạn hoàn thành lượt học, ôn SRS hoặc Quiz đủ điều kiện.")).toBeVisible();

  await expect(page.getByText("Level hiện tại")).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Tiến độ XP Level 2" })).toHaveAttribute("aria-valuenow", "50");
  await expect(page.getByText("Tổng XP").locator("..")).toContainText("50 XP");
  await expect(page.getByLabel("Chuỗi hiện tại 4 ngày")).toBeVisible();

  await expect(page.getByRole("combobox", { name: "Trạng thái" })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Phân trang tiến độ" })).toHaveCount(0);
  await expect(page.getByRole("list", { name: "Danh sách tiến độ từ vựng" })).toHaveCount(0);
});

test("shows unknown activity honestly and keeps Streak failure independent", async ({ page }) => {
  await installProgressMock(page, () => success(populatedProgress({ allUnavailable: true })));
  await installStreakMock(page, null, 500);
  await page.goto("/my/learning-progress");

  await expect(page.getByText("Chưa đủ dữ liệu để xác định hoạt động trong 7 ngày này.")).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("Chưa thể tải chuỗi học");
  await expect(page.getByText("Từ đã học")).toBeVisible();
  await expect(page.getByText("Có hoạt động", { exact: true })).toHaveCount(0);
});

test("retries a failed Progress request from the keyboard", async ({ page }) => {
  let fail = true;
  await installProgressMock(page, () => fail
    ? { status: 500, json: { success: false, error: { code: "INTERNAL_SERVER_ERROR" } } }
    : success(populatedProgress()));
  await page.goto("/my/learning-progress");

  const retry = page.getByRole("button", { name: "Thử lại" });
  await expect(page.getByRole("alert")).toContainText("Không thể tải tiến độ học tập");
  await retry.focus();
  fail = false;
  await page.keyboard.press("Enter");
  await expect(page.getByRole("region", { name: "Tóm tắt tiến độ" })).toBeVisible();
});

for (const viewport of [
  { name: "mobile-320", width: 320, height: 720, summaryColumns: 2 },
  { name: "mobile-390", width: 390, height: 844, summaryColumns: 2 },
  { name: "desktop-1366", width: 1366, height: 768, summaryColumns: 4 },
]) {
  test(`keeps Progress V2 readable on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await installProgressMock(page, () => success(populatedProgress()));
    await page.goto("/my/learning-progress");

    const cards = page.locator(".learning-progress-summary-card");
    await expect(cards).toHaveCount(4);
    await expect.poll(() => page.locator(".learning-progress-summary").evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length)).toBe(viewport.summaryColumns);
    const heights = await cards.evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().height));
    expect(Math.abs(heights[0] - heights[1])).toBeLessThanOrEqual(1);
    expect(Math.abs(heights[2] - heights[3])).toBeLessThanOrEqual(1);
    await expect(page.locator(".learning-progress-activity-grid").locator("li")).toHaveCount(7);
    await expectNoHorizontalOverflow(page);
  });
}

test("styles the desktop USER inner-main and mobile USER document scroll owners", async ({ page }) => {
  await installProgressMock(page, () => success(populatedProgress()));
  await page.setViewportSize({ width: 1366, height: 600 });
  await page.goto("/my/learning-progress");
  const desktop = await page.evaluate(() => ({
    documentColor: getComputedStyle(document.documentElement).scrollbarColor,
    mainColor: getComputedStyle(document.querySelector(".authenticated-main")).scrollbarColor,
    mainOverflow: getComputedStyle(document.querySelector(".authenticated-main")).overflowY,
  }));
  expect(desktop.mainOverflow).toBe("auto");
  expect(desktop.mainColor).toContain("rgb(47, 134, 189)");

  await page.setViewportSize({ width: 390, height: 700 });
  const mobile = await page.evaluate(() => ({
    documentColor: getComputedStyle(document.documentElement).scrollbarColor,
    mainOverflow: getComputedStyle(document.querySelector(".authenticated-main")).overflowY,
  }));
  expect(mobile.mainOverflow).toBe("visible");
  expect(mobile.documentColor).toContain("rgb(47, 134, 189)");
});

test("does not target ADMIN or USER focus-mode shells with shared scrollbar selectors", async ({ page }) => {
  await page.unroute("**/api/auth/me");
  await installAuthApiMock(page, {
    "/api/auth/me": responses.currentUser(publicAdmin),
  });
  await page.goto("/dashboard");
  await expect(page.locator(".authenticated-user-app")).toHaveCount(0);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollbarColor)).not.toContain("rgb(47, 134, 189)");

  await page.unroute("**/api/auth/me");
  await installAuthApiMock(page, {
    "/api/auth/me": responses.currentUser(publicUser),
  });
  await page.goto("/review/global");
  await expect(page.locator(".learning-focus-shell")).toHaveCount(1);
  await expect(page.locator(".authenticated-user-app")).toHaveCount(0);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollbarColor)).not.toContain("rgb(47, 134, 189)");
});

async function installProgressMock(page, handler) {
  await page.route("**/api/learning/progress**", async (route) => route.fulfill(await handler()));
}

async function installStreakMock(page, data, status = 200) {
  await page.route("**/api/users/me/streak", (route) => route.fulfill({
    status,
    json: status === 200 ? { success: true, data } : { success: false, error: { code: "INTERNAL_SERVER_ERROR" } },
  }));
}

function success(data) { return { status: 200, json: { success: true, data } }; }

function populatedProgress({ allUnavailable = false } = {}) {
  const statuses = allUnavailable
    ? Array(7).fill("UNAVAILABLE")
    : ["UNAVAILABLE", "UNAVAILABLE", "ACTIVE", "INACTIVE", "INACTIVE", "ACTIVE", "ACTIVE"];
  return {
    evaluated_at: "2026-09-24T12:00:00.000Z",
    xp_level: { total_xp: 50, level: 2, level_min_xp: 50, next_level_xp: 150, is_max_level: false },
    summary: { total_started: 25, learning: 9, learned: 14, needs_review: 2 },
    streak_activity_7d: {
      timezone: "Asia/Ho_Chi_Minh",
      days: ["2026-09-18", "2026-09-19", "2026-09-20", "2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24"].map((date, index) => ({ date, status: statuses[index] })),
    },
    items: [],
    pagination: { page: 1, page_size: 1, total_items: 25, total_pages: 25 },
    filter: { status: null },
  };
}

function currentStreak() {
  return { current_streak: 4, completed_today: true, last_qualified_date: "2026-09-24", timezone: "Asia/Ho_Chi_Minh", evaluated_at: "2026-09-24T12:00:00.000Z" };
}

function deferred() {
  let resolve;
  const promise = new Promise((resolvePromise) => { resolve = resolvePromise; });
  return { promise, resolve };
}

async function expectNoHorizontalOverflow(page) {
  await expect.poll(() => page.evaluate(() => ({
    body: document.body.scrollWidth - document.body.clientWidth,
    document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }))).toEqual({ body: 0, document: 0 });
}
