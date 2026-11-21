// @ts-nocheck
import { expect, test } from "@playwright/test";
import { deferredResponse, installAuthApiMock, publicAdmin, publicUser, responses } from "./fixtures/auth-api.js";

const SET_ALPHA = "10000000-0000-4000-8000-000000000001";
const SET_BETA = "10000000-0000-4000-8000-000000000002";
const CONTINUE_SESSION = "20000000-0000-4000-8000-000000000001";
const CONTINUE_VOCAB = "30000000-0000-4000-8000-000000000001";

function centerSummary(overrides = {}) {
  return {
    evaluated_at: "2026-11-08T12:00:00.000Z",
    due_count: 2,
    has_due_items: true,
    has_review_data: true,
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
  await expect(page.getByRole("region", { name: "Ôn theo bộ từ" })).toContainText("Mỗi phiên chỉ gồm tối đa 10 từ đã học và đang đến hạn.");
  await expect(setList.getByRole("link", { name: "Ôn tập từ đến hạn Bộ từ Beta" })).toHaveAttribute("href", `/review/sets/${SET_BETA}`);
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
  await expect(page.getByRole("link", { name: "Ôn tập từ đến hạn Thói quen hằng ngày — Bộ từ công khai" })).toHaveAttribute("href", `/review/sets/${SET_ALPHA}`);
  await expect(page.getByRole("link", { name: "Ôn tập từ đến hạn Thói quen hằng ngày — Bộ từ cá nhân" })).toHaveAttribute("href", `/review/sets/${SET_BETA}`);
});

test("zero-due Review Center offers only a backend-verified unfinished ordinary SRS continuation", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await installAuthApiMock(page, { "/api/auth/me": responses.currentUser(publicUser) });
  await page.addInitScript(({ setId, sessionId, vocabularyId }) => {
    sessionStorage.setItem(`elvocab.backend-learning-session.ordinary:v3:user-1:${setId}:SRS_FLASHCARD`, JSON.stringify({
      version: 3, user_id: "user-1", set_id: setId, mode: "SRS", pass_id: null,
      session_id: sessionId, creation_operation_id: null,
      expires_at: "2026-11-26T00:00:00.000Z", cursor_vocabulary_id: vocabularyId,
      view_state: "ACTIVE",
    }));
  }, { setId: SET_ALPHA, sessionId: CONTINUE_SESSION, vocabularyId: CONTINUE_VOCAB });
  await page.route("**/api/learning/review/center", (route) => route.fulfill({
    status: 200, json: { success: true, data: centerSummary({ due_count: 0, has_due_items: false, sets: [] }) },
  }));
  await page.route(`**/api/learning-sessions/${CONTINUE_SESSION}`, (route) => route.fulfill({
    status: 200, json: { success: true, data: {
      id: CONTINUE_SESSION, set_id: SET_ALPHA, scope: "SET", session_intent: "STANDARD", mode: "SRS",
      state: "ACTIVE", created_at: "2026-11-19T00:00:00.000Z",
      expires_at: "2026-11-26T00:00:00.000Z", completed_at: null,
      snapshot_size: 1, completed_items: 0,
      items: [{ vocabulary_id: CONTINUE_VOCAB, position: 0, evidence: null }],
      can_continue: true, set_name: "Bộ từ đang học",
    } },
  }));
  await page.goto("/review");
  const action = page.getByRole("link", { name: "Tiếp tục phiên SRS" });
  await expect(action).toBeVisible();
  await expect(page.getByText("Bộ từ đang học")).toBeVisible();
  await expect(action).toHaveAttribute("href", `/learn/vocabulary-sets/${SET_ALPHA}`);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
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
  const emptyHeading = page.getByRole("heading", { name: "Hiện không có từ đến hạn" });
  await expect(emptyHeading).toBeVisible();
  await expect(emptyHeading).toBeFocused();
  await expect(page.getByRole("link", { name: "Tiếp tục học" })).toHaveAttribute("href", "/topics");
  await expect(page.getByRole("link", { name: "Ôn tất cả" })).toHaveCount(0);
});

test("new USER sees a no-review-data state instead of a completed-review claim", async ({ page }) => {
  await installAuthApiMock(page, { "/api/auth/me": responses.currentUser(publicUser) });
  await page.route("**/api/learning/review/center", (route) => route.fulfill({
    status: 200,
    json: { success: true, data: centerSummary({ due_count: 0, has_due_items: false, has_review_data: false, sets: [] }) },
  }));
  await page.goto("/review");
  await expect(page.getByRole("heading", { name: "Bạn chưa có dữ liệu ôn tập" })).toBeVisible();
  await expect(page.getByText(/bắt đầu học một bộ từ/i)).toBeVisible();
  await expect(page.getByText("Hiện không có từ đến hạn")).toHaveCount(0);
});

test("empty-state variants use distinct truthful visuals and actions", async ({ page }) => {
  await installAuthApiMock(page, { "/api/auth/me": responses.currentUser(publicUser) });
  let summary = centerSummary({ due_count: 0, has_due_items: false, has_review_data: false, sets: [] });
  await page.route("**/api/learning/review/center", (route) => route.fulfill({
    status: 200,
    json: { success: true, data: summary },
  }));

  await page.goto("/review");
  const newState = page.locator('[data-review-empty-state="new"]');
  await expect(newState).toHaveClass(/bg-sky-50/);
  await expect(newState.locator(".lucide-book-open")).toBeVisible();
  await expect(newState.locator('a[href="/topics"]')).toHaveText("Bắt đầu học");

  summary = centerSummary({ due_count: 0, has_due_items: false, sets: [] });
  await page.reload();
  const knownState = page.locator('[data-review-empty-state="known"]');
  await expect(knownState).toHaveClass(/bg-emerald-50/);
  await expect(knownState.locator(".lucide-clock-3")).toBeVisible();
  await expect(knownState.locator('a[href="/topics"]')).toHaveText("Tiếp tục học");

  delete summary.has_review_data;
  await page.reload();
  const legacyState = page.locator('[data-review-empty-state="legacy"]');
  await expect(legacyState).toHaveClass(/bg-cyan-50/);
  await expect(legacyState.locator(".lucide-compass")).toBeVisible();
  await expect(legacyState.locator('a[href="/topics"]')).toHaveText("Khám phá bộ từ");
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
