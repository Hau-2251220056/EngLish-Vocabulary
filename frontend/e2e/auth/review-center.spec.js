// @ts-nocheck
import { expect, test } from "@playwright/test";
import { deferredResponse, installAuthApiMock, publicAdmin, publicUser, responses } from "./fixtures/auth-api.js";

const SET_ALPHA = "10000000-0000-4000-8000-000000000001";
const SET_BETA = "10000000-0000-4000-8000-000000000002";

function centerSummary(overrides = {}) {
  return {
    evaluated_at: "2026-11-08T12:00:00.000Z",
    due_count: 2,
    has_due_items: true,
    nearest_future_review_at: null,
    sets: [
      { set_id: SET_ALPHA, name: "Bộ từ Alpha", due_count: 2, set_scope: "PUBLIC" },
      { set_id: SET_BETA, name: "Bộ từ Beta", due_count: 1, set_scope: "PERSONAL" },
    ],
    ...overrides,
  };
}

test("Review Center renders authoritative due-only data without creating a session", async ({ page }) => {
  await installAuthApiMock(page, { "/api/auth/me": responses.currentUser(publicUser) });
  let sessionCreates = 0;
  await page.route("**/api/learning/review/sessions", (route) => {
    sessionCreates += 1;
    return route.abort("failed");
  });
  await page.route("**/api/learning/review/center", (route) => route.fulfill({
    status: 200,
    json: { success: true, data: centerSummary() },
  }));

  await page.goto("/review");
  await expect(page.getByRole("heading", { name: "Ôn tập từ vựng" })).toHaveCount(1);
  const appNavigation = page.getByRole("navigation", { name: "Điều hướng ứng dụng" });
  await expect(appNavigation.getByRole("link", { name: "Ôn tập", exact: true })).toHaveAttribute("href", "/review");
  await expect(appNavigation.getByRole("link", { name: "Tiến độ học tập" })).toHaveAttribute("href", "/my/learning-progress");
  const dueSection = page.getByRole("region", { name: "Cần ôn hôm nay" });
  await expect(dueSection.getByLabel("2 từ đến hạn")).toBeVisible();
  await expect(dueSection.getByRole("link")).toHaveCount(0);
  const setList = page.getByRole("list", { name: "Các bộ từ cần ôn" });
  await expect(setList.getByRole("listitem")).toHaveCount(2);
  await expect(setList).toContainText("Bộ từ Alpha");
  await expect(setList).toContainText("Bộ từ công khai");
  await expect(setList).toContainText("Bộ từ cá nhân");
  await expect(setList).toContainText("2 từ đến hạn");
  await expect(setList.getByRole("link", { name: "Ôn tập ngay Bộ từ Beta" })).toHaveAttribute("href", `/review/sets/${SET_BETA}`);
  expect(sessionCreates).toBe(0);
});

test("same-name Sets keep distinct identities, scope labels and destinations", async ({ page }) => {
  await installAuthApiMock(page, { "/api/auth/me": responses.currentUser(publicUser) });
  await page.route("**/api/learning/review/center", (route) => route.fulfill({
    status: 200,
    json: {
      success: true,
      data: centerSummary({
        sets: [
          { set_id: SET_ALPHA, name: "Thói quen hằng ngày", due_count: 2, set_scope: "PUBLIC" },
          { set_id: SET_BETA, name: "Thói quen hằng ngày", due_count: 1, set_scope: "PERSONAL" },
        ],
      }),
    },
  }));

  await page.goto("/review");
  await expect(page.getByRole("link", { name: "Ôn tập ngay Thói quen hằng ngày — Bộ từ công khai" })).toHaveAttribute("href", `/review/sets/${SET_ALPHA}`);
  await expect(page.getByRole("link", { name: "Ôn tập ngay Thói quen hằng ngày — Bộ từ cá nhân" })).toHaveAttribute("href", `/review/sets/${SET_BETA}`);
});

test("keyboard retry keeps stable loading focus and focuses restored zero-due content", async ({ page }) => {
  await installAuthApiMock(page, { "/api/auth/me": responses.currentUser(publicUser) });
  const recovery = deferredResponse();
  let requestPhase = "initial-error";
  await page.route("**/api/learning/review/center", async (route) => {
    if (requestPhase === "initial-error") {
      return route.fulfill({ status: 503, json: { success: false, error: { code: "REVIEW_CENTER_UNAVAILABLE" } } });
    }
    await recovery.response;
    return route.fulfill({
      status: 200,
      json: { success: true, data: centerSummary({ due_count: 0, has_due_items: false, sets: [] }) },
    });
  });

  await page.goto("/review");
  await expect(page.getByRole("alert")).toContainText("Không thể tải dữ liệu ôn tập");
  await page.getByRole("button", { name: "Thử lại" }).focus();
  requestPhase = "keyboard-retry";
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status").filter({ hasText: "Đang tải dữ liệu ôn tập…" })).toBeFocused();
  recovery.resolve();
  const emptyHeading = page.getByRole("heading", { name: "Bạn đã ôn xong các từ đến hạn!" });
  await expect(emptyHeading).toBeVisible();
  await expect(emptyHeading).toBeFocused();
  await expect(page.getByRole("link", { name: "Tiếp tục học" })).toHaveAttribute("href", "/topics");
  await expect(page.getByRole("link", { name: "Ôn tất cả" })).toHaveCount(0);
});

test("keyboard retry returns focus to the new retry button after another failure", async ({ page }) => {
  await installAuthApiMock(page, { "/api/auth/me": responses.currentUser(publicUser) });
  await page.route("**/api/learning/review/center", (route) => route.fulfill({
    status: 503,
    json: { success: false, error: { code: "REVIEW_CENTER_UNAVAILABLE" } },
  }));

  await page.goto("/review");
  const retry = page.getByRole("button", { name: "Thử lại" });
  await retry.focus();
  await page.keyboard.press("Enter");
  await expect(retry).toBeFocused();
});

test("pointer retry renders restored content without moving focus to its heading", async ({ page }) => {
  await installAuthApiMock(page, { "/api/auth/me": responses.currentUser(publicUser) });
  let recoveryAuthorized = false;
  await page.route("**/api/learning/review/center", (route) => route.fulfill(recoveryAuthorized
    ? { status: 200, json: { success: true, data: centerSummary() } }
    : { status: 503, json: { success: false, error: { code: "REVIEW_CENTER_UNAVAILABLE" } } }));

  await page.goto("/review");
  await expect(page.getByRole("alert")).toContainText("Không thể tải dữ liệu ôn tập");
  recoveryAuthorized = true;
  await page.getByRole("button", { name: "Thử lại" }).click();
  const restoredHeading = page.getByRole("heading", { name: "Ôn theo bộ từ" });
  await expect(restoredHeading).toBeVisible();
  await expect(restoredHeading).not.toBeFocused();
});

test("ADMIN cannot open the USER Review Center", async ({ page }) => {
  await installAuthApiMock(page, { "/api/auth/me": responses.currentUser(publicAdmin) });
  await page.goto("/review");
  await expect(page).toHaveURL(/\/dashboard$/);
});

for (const viewport of [
  { width: 320, height: 800 },
  { width: 768, height: 900 },
  { width: 1440, height: 1000 },
]) {
  test(`Review Center remains usable at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await installAuthApiMock(page, { "/api/auth/me": responses.currentUser(publicUser) });
    await page.route("**/api/learning/review/center", (route) => route.fulfill({
      status: 200,
      json: { success: true, data: centerSummary() },
    }));
    await page.goto("/review");
    await expect(page.getByRole("heading", { name: "Ôn theo bộ từ" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Ôn tất cả" })).toHaveCount(0);
    await expect(page.getByRole("list", { name: "Các bộ từ cần ôn" })).toBeVisible();
  });
}
