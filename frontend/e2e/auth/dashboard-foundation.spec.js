import { expect, test } from "@playwright/test";
import {
  installAuthApiMock,
  publicAdmin,
  publicUser,
  responses,
} from "./fixtures/auth-api.js";

test("review CTA opens the center for positive and zero due summaries", async ({ page }) => {
  await installAuthApiMock(page, { "/api/auth/me": responses.currentUser(publicUser) });
  let dueCount = 4;
  await page.route("**/api/learning/review", (route) => route.fulfill({
    status: 200,
    json: { success: true, data: { due_count: dueCount, has_due_items: dueCount > 0, evaluated_at: "2026-11-03T00:00:00.000Z", nearest_future_review_at: dueCount > 0 ? null : "2026-11-04T00:00:00.000Z" } },
  }));
  await page.goto("/dashboard");
  const review = page.getByRole("region", { name: "Từ cần ôn" });
  await expect(review).toContainText("4 từ đang đến hạn");
  await expect(review.getByRole("link", { name: "Xem ôn tập" })).toHaveAttribute("href", "/review");

  dueCount = 0;
  await page.reload();
  await expect(review).toContainText("Đã ôn tập đầy đủ");
  await expect(review.getByRole("link", { name: "Xem ôn tập" })).toHaveAttribute("href", "/review");
});

test("review summary failure remains scoped and renders no successful CTA state", async ({ page }) => {
  await installAuthApiMock(page, { "/api/auth/me": responses.currentUser(publicUser) });
  await page.route("**/api/learning/review", (route) => route.fulfill({ status: 500, json: { success: false, error: { code: "INTERNAL_SERVER_ERROR" } } }));
  await page.goto("/dashboard");
  const review = page.getByRole("region", { name: "Từ cần ôn" });
  await expect(review.getByRole("alert")).toContainText("Không thể tải số từ cần ôn");
  await expect(review.getByRole("link", { name: "Xem ôn tập" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Lộ trình CEFR" })).toBeVisible();
});

test("USER composes four authoritative statistics with independent source recovery", async ({ page }) => {
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
  await expect(page.getByRole("heading", { name: `Chào buổi sáng ${publicUser.display_name}` })).toBeVisible();
  const levelCard = page.getByRole("heading", { name: "Cấp độ" }).locator("..");
  const xpCard = page.getByRole("heading", { name: "Tổng XP" }).locator("..");
  const setCard = page.getByRole("heading", { name: "Bộ từ cá nhân" }).locator("..");
  await expect(levelCard.getByRole("status")).toContainText("Đang tải cấp độ");
  await expect(setCard.getByRole("alert")).toContainText("Chưa thể tải dữ liệu");

  await progress.fulfill(progressResponse({ total_started: 8, learning: 3, learned: 4, needs_review: 1 }));
  await expect(levelCard).toContainText("Level hiện tại");
  await expect(levelCard).toContainText("25 / 100 XP");
  await expect(xpCard).toContainText("75 XP");
  await expect(page.getByRole("progressbar", { name: "Tiến độ XP Level 2" })).toHaveAttribute("aria-valuenow", "75");
  await expect(page.getByRole("progressbar", { name: "Tiến độ XP Level 2" })).toHaveAttribute("aria-valuemin", "50");
  await expect(page.getByRole("progressbar", { name: "Tiến độ XP Level 2" })).toHaveAttribute("aria-valuemax", "150");
  const retry = setCard.getByRole("button", { name: "Thử lại" });
  const callsBeforeRetry = setCalls;
  retryingSets = true;
  await retry.dblclick();
  await expect(retry).toHaveCount(0);
  await expect.poll(() => setCalls).toBe(callsBeforeRetry + 1);
  await retrySets.fulfill(setsResponse());

  await expect(setCard).toContainText("4 bộ cá nhân");
  await expect(page.getByRole("heading", { name: "Bộ từ cá nhân" })).toBeFocused();
  await expect(page.getByRole("list", { name: "Bộ từ riêng xem trước" })).toHaveCount(0);
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
  await page.route("**/api/learning-path", async (route) => {
    userApiCalls += 1;
    await route.abort("failed");
  });
  await page.route("**/api/learning/review**", async (route) => {
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

test("USER renders one backend-ordered CEFR recommendation and truthful locked levels", async ({ page }) => {
  await installAuthApiMock(page, { "/api/auth/me": responses.currentUser(publicUser) });
  const setId = "10000000-0000-4000-8000-000000000001";
  await page.route("**/api/learning-path", (route) => route.fulfill({
    status: 200,
    json: {
      success: true,
      data: {
        evaluated_at: "2026-11-03T00:00:00.000Z",
        highest_unlocked_level: "A1",
        path_completed_at: null,
        levels: ["A1", "A2", "B1", "B2", "C1"].map((level, index) => ({
          level, unlocked: index === 0, required_count: index === 0 ? 1 : 0,
          completed_count: 0, configuration: index === 0 ? "READY" : "NO_REQUIRED_SETS",
          current_complete: false,
          incomplete_sets: index === 0 ? [{ id: setId, name: "A1 starter", created_at: "2026-11-03T00:00:00.000Z" }] : [],
        })),
        recommendation: { action: "START", set_id: setId, pass_id: null },
        next_suggestion: { action: "START", set_id: setId, pass_id: null },
        next_suggestion_reason: null,
        all_current_sets_complete: false,
      },
    },
  }));

  await page.goto("/dashboard");
  const nextLesson = page.getByRole("region", { name: "Gợi ý tiếp theo" });
  const path = page.getByRole("region", { name: "Lộ trình CEFR" });
  await expect(nextLesson.getByText("A1 starter", { exact: true })).toBeVisible();
  await expect(nextLesson.getByText("A1", { exact: true })).toBeVisible();
  await expect(nextLesson).toContainText("0 / 1 bộ đã hoàn thành");
  await expect(nextLesson).toContainText("Sắp mở khóa A2. Hoàn thành bộ từ còn lại để tiếp tục lộ trình.");
  await expect(nextLesson.getByRole("link", { name: "Bắt đầu học" })).toHaveAttribute("href", `/learn/vocabulary-sets/${setId}`);
  await expect(path).not.toContainText("A1 starter");
  await expect(path.getByRole("link", { name: "Bắt đầu học" })).toHaveCount(0);
  const unlockedA1 = path.getByRole("listitem").filter({ hasText: /^A1\s*đã mở$/ });
  await expect(unlockedA1).toContainText("đã mở");
  const lockedA2 = path.getByRole("listitem").filter({ hasText: "A2" });
  await expect(lockedA2).toContainText("đang khóa");
  await expect(path.getByText("đang khóa")).toHaveCount(4);
  await expect(page.getByRole("region", { name: "Tiếp tục học" })).toHaveCount(0);
});

test("USER keeps RESUME separate and renders the different authoritative next suggestion", async ({ page }) => {
  await installAuthApiMock(page, { "/api/auth/me": responses.currentUser(publicUser) });
  const setId = "10000000-0000-4000-8000-000000000001";
  const passId = "20000000-0000-4000-8000-000000000002";
  const nextSetId = "10000000-0000-4000-8000-000000000003";
  const topicId = "60000000-0000-4000-8000-000000000010";
  const coverUrl = "https://covers.example.test/a1-active.webp";
  await page.route("**/api/learning-path", (route) => route.fulfill({
    status: 200,
    json: {
      success: true,
      data: {
        evaluated_at: "2026-11-03T00:00:00.000Z",
        highest_unlocked_level: "A1",
        path_completed_at: null,
        levels: ["A1", "A2", "B1", "B2", "C1"].map((level, index) => ({
          level, unlocked: index === 0, required_count: index === 0 ? 1 : 0,
          completed_count: 0, configuration: index === 0 ? "READY" : "NO_REQUIRED_SETS",
          current_complete: false,
          incomplete_sets: index === 0 ? [
            { id: setId, name: "A1 active", created_at: "2026-11-02T00:00:00.000Z" },
            { id: nextSetId, name: "A1 next", created_at: "2026-11-03T00:00:00.000Z" },
          ] : [],
        })),
        recommendation: { action: "RESUME", set_id: setId, pass_id: passId },
        next_suggestion: { action: "START", set_id: nextSetId, pass_id: null },
        next_suggestion_reason: null,
        all_current_sets_complete: false,
      },
    },
  }));
  await page.route(`**/api/learning-path/passes/${passId}`, (route) => route.fulfill({
    status: 200,
    json: { success: true, data: activePassProjection({ passId, setId, snapshotSize: 10 }) },
  }));
  await page.route("**/api/topics", (route) => route.fulfill({
    status: 200,
    json: { success: true, data: [{ id: topicId, name: "A1", description: null }] },
  }));
  await page.route(`**/api/topics/${topicId}/vocabulary-sets`, (route) => route.fulfill({
    status: 200,
    json: { success: true, data: [publicSet(setId, "A1 active", "A1", 10, coverUrl)] },
  }));
  await page.route(coverUrl, (route) => route.fulfill({
    status: 200,
    contentType: "image/svg+xml",
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="320"></svg>',
  }));

  await page.goto("/dashboard");
  const nextLesson = page.getByRole("region", { name: "Gợi ý tiếp theo" });
  await expect(nextLesson.getByText("A1 next", { exact: true })).toBeVisible();
  await expect(nextLesson).not.toContainText("A1 active");
  await expect(nextLesson.getByRole("link", { name: "Bắt đầu học" })).toHaveAttribute("href", `/learn/vocabulary-sets/${nextSetId}`);
  const currentLearning = page.getByRole("region", { name: "Tiếp tục học" });
  await expect(currentLearning.getByText("A1 active", { exact: true })).toBeVisible();
  await expect(currentLearning).toContainText("Tiếp tục lượt học hiện tại");
  await expect(currentLearning).not.toContainText("0 / 10 từ đã học");
  await expect(currentLearning.getByRole("progressbar")).toHaveCount(0);
  const persistedCover = currentLearning.locator('[data-cover-state="persisted"]');
  const persistedCoverImage = persistedCover.locator("img");
  await expect(persistedCoverImage).toHaveAttribute("src", coverUrl);
  await expect(persistedCoverImage).toHaveCSS("object-fit", "cover");
  const continueLink = currentLearning.getByRole("link", { name: "Tiếp tục" });
  await expect(continueLink).toHaveAttribute("href", `/learn/vocabulary-sets/${setId}`);
  await expect(continueLink).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await continueLink.focus();
  await expect(continueLink).toBeFocused();
  const [nextLessonBox, currentLearningBox, coverBox, pathBox] = await Promise.all([
    nextLesson.boundingBox(),
    currentLearning.boundingBox(),
    persistedCover.boundingBox(),
    page.getByRole("region", { name: "Lộ trình CEFR" }).boundingBox(),
  ]);
  expect(Math.abs(coverBox.x - currentLearningBox.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(coverBox.y - currentLearningBox.y)).toBeLessThanOrEqual(1);
  expect(Math.abs((coverBox.y + coverBox.height) - (currentLearningBox.y + currentLearningBox.height))).toBeLessThanOrEqual(1);
  expect(currentLearningBox.y).toBeGreaterThanOrEqual(nextLessonBox.y + nextLessonBox.height + 12);
  expect(pathBox.y).toBeGreaterThanOrEqual(currentLearningBox.y + currentLearningBox.height + 12);
  expect(Math.abs(currentLearningBox.x - nextLessonBox.x)).toBeLessThanOrEqual(1);
  await continueLink.click();
  await expect(page).toHaveURL(`/learn/vocabulary-sets/${setId}`);
  await expect.poll(() => page.evaluate(() => window.history.state?.usr?.passId)).toBe(passId);
});

test("current learning failure recovers into the safe restart path", async ({ page }) => {
  await installAuthApiMock(page, { "/api/auth/me": responses.currentUser(publicUser) });
  const setId = "10000000-0000-4000-8000-000000000011";
  const passId = "20000000-0000-4000-8000-000000000012";
  const topicId = "60000000-0000-4000-8000-000000000011";
  const coverUrl = "https://covers.example.test/broken.webp";
  let passFails = true;
  await page.route("**/api/learning-path", (route) => route.fulfill(resumePathResponse({ passId, setId, setName: "A1 restart" })));
  await page.route(`**/api/learning-path/passes/${passId}`, (route) => route.fulfill(passFails ? {
    status: 500, json: { success: false, error: { code: "INTERNAL_SERVER_ERROR" } },
  } : {
    status: 200,
    json: { success: true, data: activePassProjection({
      activityState: "IN_PROGRESS", canContinue: false, passId, setId,
      snapshotSize: 8, studiedItems: 2,
    }) },
  }));
  await page.route("**/api/topics", (route) => route.fulfill({
    status: 200,
    json: { success: true, data: [{ id: topicId, name: "A1", description: null }] },
  }));
  await page.route(`**/api/topics/${topicId}/vocabulary-sets`, (route) => route.fulfill({
    status: 200,
    json: { success: true, data: [publicSet(setId, "A1 restart", "A1", 8, coverUrl)] },
  }));
  await page.route(coverUrl, (route) => route.abort("failed"));

  await page.goto("/dashboard");
  const currentLearning = page.getByRole("region", { name: "Tiếp tục học" });
  await expect(currentLearning.getByRole("alert")).toContainText("Không thể tải tiến độ lượt học hiện tại");
  passFails = false;
  await currentLearning.getByRole("button", { name: "Thử lại" }).click();
  await expect(currentLearning).toContainText("Cần xác nhận bắt đầu lại");
  await expect(currentLearning).toContainText("Nội dung bộ từ đã thay đổi");
  await expect(currentLearning.locator('[data-cover-state="fallback"]')).toBeVisible();
  await expect(currentLearning.getByRole("link", { name: "Tiếp tục" })).toHaveAttribute("href", `/learn/vocabulary-sets/${setId}`);
  await expect(page.getByRole("heading", { name: "Tiếp tục học" })).toBeFocused();
  const nextLesson = page.getByRole("region", { name: "Gợi ý tiếp theo" });
  await expect(nextLesson).toContainText("Bộ từ còn lại đang có lượt học hoặc ôn tập");
  await expect(nextLesson).toContainText("Sắp mở khóa A2");
  await expect(nextLesson.getByRole("link", { name: "Bắt đầu học" })).toHaveCount(0);
});

test("multiple active unfinished Sets explain the empty suggestion without an unlock claim", async ({ page }) => {
  await installAuthApiMock(page, { "/api/auth/me": responses.currentUser(publicUser) });
  const activeSetId = "10000000-0000-4000-8000-000000000031";
  const otherActiveSetId = "10000000-0000-4000-8000-000000000032";
  const passId = "20000000-0000-4000-8000-000000000033";
  await page.route("**/api/learning-path", (route) => route.fulfill({
    status: 200,
    json: { success: true, data: {
      evaluated_at: "2026-11-03T00:00:00.000Z", highest_unlocked_level: "A1", path_completed_at: null,
      levels: ["A1", "A2", "B1", "B2", "C1"].map((level, index) => ({
        level, unlocked: index === 0, required_count: index === 0 ? 2 : 0,
        completed_count: 0, configuration: index === 0 ? "READY" : "NO_REQUIRED_SETS",
        current_complete: false,
        incomplete_sets: index === 0 ? [
          { id: activeSetId, name: "A1 active pass", created_at: "2026-11-02T00:00:00.000Z" },
          { id: otherActiveSetId, name: "A1 active review", created_at: "2026-11-03T00:00:00.000Z" },
        ] : [],
      })),
      recommendation: { action: "RESUME", set_id: activeSetId, pass_id: passId },
      next_suggestion: null, next_suggestion_reason: "ALL_INCOMPLETE_SETS_ACTIVE",
      all_current_sets_complete: false,
    } },
  }));
  await page.route(`**/api/learning-path/passes/${passId}`, (route) => route.fulfill({
    status: 200,
    json: { success: true, data: activePassProjection({ passId, setId: activeSetId, snapshotSize: 5 }) },
  }));

  await page.goto("/dashboard");
  const nextLesson = page.getByRole("region", { name: "Gợi ý tiếp theo" });
  await expect(nextLesson).toContainText("Những bộ từ chưa hoàn thành ở cấp độ này đang có lượt học hoặc ôn tập");
  await expect(nextLesson).not.toContainText("Sắp mở khóa");
  await expect(nextLesson.getByRole("link", { name: "Bắt đầu học" })).toHaveCount(0);
});

test("terminal C1 completion never presents a C2 milestone", async ({ page }) => {
  await installAuthApiMock(page, { "/api/auth/me": responses.currentUser(publicUser) });
  await page.route("**/api/learning-path", (route) => route.fulfill({
    status: 200,
    json: { success: true, data: {
      evaluated_at: "2026-11-03T00:00:00.000Z", highest_unlocked_level: "C1",
      path_completed_at: "2026-11-03T00:00:00.000Z",
      levels: ["A1", "A2", "B1", "B2", "C1"].map((level) => ({
        level, unlocked: true, required_count: 1, completed_count: 1,
        configuration: "READY", current_complete: true, incomplete_sets: [],
      })),
      recommendation: null, next_suggestion: null,
      next_suggestion_reason: "NO_ELIGIBLE_NEXT_SET", all_current_sets_complete: true,
    } },
  }));

  await page.goto("/dashboard");
  const nextLesson = page.getByRole("region", { name: "Gợi ý tiếp theo" });
  await expect(nextLesson).toContainText("Bạn đã hoàn thành các bộ từ hiện có trong lộ trình.");
  await expect(nextLesson).not.toContainText("C2");
});

test("catalog failure keeps the backend-selected current learning action available", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await installAuthApiMock(page, { "/api/auth/me": responses.currentUser(publicUser) });
  const setId = "10000000-0000-4000-8000-000000000021";
  const passId = "20000000-0000-4000-8000-000000000022";
  await page.route("**/api/learning-path", (route) => route.fulfill(resumePathResponse({ passId, setId, setName: "A1 catalog independent" })));
  await page.route(`**/api/learning-path/passes/${passId}`, (route) => route.fulfill({
    status: 200,
    json: { success: true, data: activePassProjection({ passId, setId, snapshotSize: 10 }) },
  }));
  await page.route("**/api/topics", (route) => route.fulfill({
    status: 500,
    json: { success: false, error: { code: "INTERNAL_SERVER_ERROR" } },
  }));

  await page.goto("/dashboard");
  const currentLearning = page.getByRole("region", { name: "Tiếp tục học" });
  await expect(currentLearning.getByText("A1 catalog independent", { exact: true })).toBeVisible();
  const fallbackCover = currentLearning.locator('[data-cover-state="fallback"]');
  await expect(fallbackCover).toBeVisible();
  await expect(currentLearning.getByRole("link", { name: "Tiếp tục" })).toHaveAttribute("href", `/learn/vocabulary-sets/${setId}`);
  const [cardGeometry, coverBox, headingBox] = await Promise.all([
    currentLearning.evaluate((element) => ({ clientWidth: element.clientWidth, scrollWidth: element.scrollWidth })),
    fallbackCover.boundingBox(),
    currentLearning.getByRole("heading", { name: "Tiếp tục học" }).boundingBox(),
  ]);
  expect(cardGeometry.scrollWidth).toBeLessThanOrEqual(cardGeometry.clientWidth);
  expect(headingBox.x).toBeGreaterThanOrEqual(coverBox.x + coverBox.width);
});

test("featured Sets use real catalog order and label locked CEFR content as view-only", async ({ page }) => {
  await installAuthApiMock(page, { "/api/auth/me": responses.currentUser(publicUser) });
  const topicId = "60000000-0000-4000-8000-000000000001";
  await page.route("**/api/topics", (route) => route.fulfill({
    status: 200,
    json: { success: true, data: [{ id: topicId, name: "Daily English", description: null }] },
  }));
  await page.route(`**/api/topics/${topicId}/vocabulary-sets`, (route) => route.fulfill({
    status: 200,
    json: { success: true, data: [
      publicSet("70000000-0000-4000-8000-000000000001", "First A1", "A1", 12),
      publicSet("70000000-0000-4000-8000-000000000002", "Locked A2", "A2", 9),
      publicSet("70000000-0000-4000-8000-000000000003", "Empty Set", "A1", 0),
      publicSet("70000000-0000-4000-8000-000000000004", "Third B1", "B1", 7),
    ] },
  }));

  await page.goto("/dashboard");
  const featured = page.getByRole("region", { name: "Bộ từ nổi bật" });
  await expect(featured.getByRole("listitem")).toHaveCount(3);
  await expect(featured).toContainText("First A1");
  await expect(featured).toContainText("Locked A2");
  await expect(featured).toContainText("Third B1");
  await expect(featured).not.toContainText("Empty Set");
  await expect(featured.getByText("Đang khóa")).toHaveCount(2);
  await expect(featured.getByRole("link", { name: "Khám phá" })).toHaveAttribute("href", "/topics");
});

test("USER Streak card renders completed, pending, and broken states from backend projections", async ({ page }) => {
  await installAuthApiMock(page, {
    "/api/auth/me": responses.currentUser(publicUser),
  });
  let projection = streakResponse({ current_streak: 4, completed_today: true, last_qualified_date: "2026-10-19" });
  await page.route("**/api/users/me/streak", (route) => route.fulfill(projection));

  await page.goto("/dashboard");
  const streak = page.getByRole("heading", { name: "Chuỗi học" }).locator("..");
  await expect(streak.getByLabel("Chuỗi hiện tại 4 ngày")).toBeVisible();
  await expect(streak).toContainText("Đã duy trì hôm nay");
  await expect(streak.getByRole("button", { name: "Làm mới chuỗi học tập" })).toHaveCount(0);

  projection = streakResponse({ current_streak: 4, completed_today: false, last_qualified_date: "2026-10-18" });
  await page.reload();
  await expect(streak.getByLabel("Chuỗi hiện tại 4 ngày")).toBeVisible();
  await expect(streak).toContainText("Chưa hoàn thành hôm nay");

  projection = streakResponse({ current_streak: 0, completed_today: false, last_qualified_date: "2026-10-16" });
  await page.reload();
  await expect(streak.getByLabel("Chuỗi hiện tại 0 ngày")).toBeVisible();
  await expect(streak).toContainText("Chưa hoàn thành hôm nay");
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
  const streak = page.getByRole("heading", { name: "Chuỗi học" }).locator("..");
  await expect(streak.getByRole("alert")).toContainText("Chưa thể tải dữ liệu");
  await expect(streak.getByLabel(/Chuỗi hiện tại/)).toHaveCount(0);
  await expect(streak.getByRole("button", { name: "Thử lại" })).toBeVisible();
});

test("Streak failure stays independent and supports keyboard retry", async ({ page }) => {
  await installAuthApiMock(page, {
    "/api/auth/me": responses.currentUser(publicUser),
  });
  const retry = deferredRoutes();
  let calls = 0;
  let response = "error";
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
  const streak = page.getByRole("heading", { name: "Chuỗi học" }).locator("..");
  await expect(streak.getByRole("alert")).toContainText("Chưa thể tải dữ liệu.");
  await expect(streak.getByLabel(/Chuỗi hiện tại/)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Tổng XP" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Bộ từ cá nhân" }).locator("..")).toContainText("0 bộ cá nhân");

  response = "pending";
  const retryButton = streak.getByRole("button", { name: "Thử lại" });
  await retryButton.focus();
  const callsBeforeRetry = calls;
  await page.keyboard.press("Enter");
  await expect(streak.getByRole("status")).toContainText("Đang tải chuỗi học");
  await expect.poll(() => calls).toBe(callsBeforeRetry + 1);
  await retry.fulfill(streakResponse({ current_streak: 4, completed_today: true, last_qualified_date: "2026-10-19" }));
  await expect(streak.getByLabel("Chuỗi hiện tại 4 ngày")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Chuỗi học" })).toBeFocused();
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
    await route.fulfill(progressResponse(
      { total_started: 12, learning: 5, learned: 7, needs_review: 0 },
      { total_xp: 75, level: 2, level_min_xp: 50, next_level_xp: 150, is_max_level: false },
    ));
  });
  await page.route("**/api/my/vocabulary-sets", (route) =>
    route.fulfill({ status: 200, json: { success: true, data: [] } }),
  );
  await page.route("**/api/topics", (route) =>
    route.fulfill({ status: 200, json: { success: true, data: [] } }),
  );

  await page.goto("/dashboard");
  await expect(page.getByText("Đang tải cấp độ…")).toBeVisible();
  await page.goto("/topics");
  serveFreshProgress = true;
  await page.goto("/dashboard");
  const totalXp = page.getByRole("heading", { name: "Tổng XP" }).locator("..");
  await expect(totalXp).toContainText("75 XP");
  await staleProgress.fulfill(progressResponse(
    { total_started: 99, learning: 99, learned: 0, needs_review: 0 },
    { total_xp: 999, level: 4, level_min_xp: 450, next_level_xp: 750, is_max_level: false },
  ));
  await expect(totalXp).toContainText("75 XP");
  await expect(totalXp).not.toContainText("999");
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

  await expect(page.getByRole("heading", { name: "Cấp độ" }).locator("..")).toContainText("Level hiện tại");
  await expect(page.getByRole("heading", { name: "Tổng XP" }).locator("..")).toContainText("0 XP");
  await expect(page.getByRole("heading", { name: "Bộ từ cá nhân" }).locator("..")).toContainText("0 bộ cá nhân");
  await expect(page.getByRole("progressbar", { name: "Tiến độ XP Level 1" })).toHaveAttribute("aria-valuenow", "0");
  await expect(page.getByRole("list", { name: "Bộ từ riêng xem trước" })).toHaveCount(0);
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
  const levelCard = page.getByRole("heading", { name: "Cấp độ" }).locator("..");
  await expect(levelCard).toContainText("15");
  await expect(levelCard).toContainText("Đã đạt cấp tối đa");
  await expect(page.getByRole("heading", { name: "Tổng XP" }).locator("..")).toContainText("6.000 XP");
  await expect(levelCard.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "6000");
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

  await expect(page.getByRole("heading", { name: "Bộ từ cá nhân" }).locator("..")).toContainText("4 bộ cá nhân");
  const levelCard = page.getByRole("heading", { name: "Cấp độ" }).locator("..");
  const retry = levelCard.getByRole("button", { name: "Thử lại" });
  await expect(levelCard.getByRole("alert")).toContainText("Chưa thể tải dữ liệu");
  await retry.focus();
  const callsBeforeRetry = progressCalls;
  retryingProgress = true;
  await page.keyboard.press("Enter");
  await expect(levelCard.getByRole("status")).toContainText("Đang tải cấp độ");
  await expect(retry).toHaveCount(0);
  await expect.poll(() => progressCalls).toBe(callsBeforeRetry + 1);

  await retriedProgress.fulfill(progressResponse({ total_started: 3, learning: 2, learned: 1, needs_review: 0 }));
  await expect(levelCard).toContainText("Level hiện tại");
  await expect(page.getByRole("heading", { name: "Cấp độ" })).toBeFocused();
});

for (const viewport of [
  { name: "narrow-mobile", width: 320, height: 700 },
  { name: "mobile", width: 390, height: 844 },
  { name: "mobile-landscape", width: 667, height: 375 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "wide-tablet", width: 820, height: 1180 },
  { name: "compact-desktop", width: 1024, height: 768 },
  { name: "desktop", width: 1366, height: 768 },
  { name: "wide-desktop", width: 1440, height: 900 },
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
    await page.route("**/api/learning-path", (route) => route.fulfill(responsiveLearningPathResponse()));

    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Learner With An Unusually Long");
    await expect(page.getByRole("progressbar", { name: "Tiến độ XP Level 2" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Tổng XP" }).locator("..")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Bộ từ cá nhân" }).locator("..")).toContainText("1 bộ cá nhân");
    const statisticCards = await Promise.all(["Cấp độ", "Chuỗi học", "Tổng XP", "Bộ từ cá nhân"].map(async (name) => {
      const card = page.getByRole("heading", { name }).locator("..");
      await expect(card).toBeVisible();
      return card.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        return { bottom: bounds.bottom, left: bounds.left, right: bounds.right, top: bounds.top, width: bounds.width, overflow: element.scrollWidth - element.clientWidth };
      });
    }));
    const sameRow = (first, second) => Math.abs(first.top - second.top) <= 1;
    if (viewport.width < 1024) {
      expect(sameRow(statisticCards[0], statisticCards[1])).toBe(true);
      expect(sameRow(statisticCards[2], statisticCards[3])).toBe(true);
      expect(statisticCards[0].left).toBeLessThan(statisticCards[1].left);
      expect(statisticCards[2].left).toBeLessThan(statisticCards[3].left);
      expect(statisticCards[2].top).toBeGreaterThan(statisticCards[0].bottom);
      if (viewport.width <= 390) {
        expect(Math.abs((statisticCards[0].bottom - statisticCards[0].top) - (statisticCards[1].bottom - statisticCards[1].top))).toBeLessThanOrEqual(1);
        expect(Math.abs((statisticCards[2].bottom - statisticCards[2].top) - (statisticCards[3].bottom - statisticCards[3].top))).toBeLessThanOrEqual(1);
      }
    } else {
      expect(statisticCards.every((card) => sameRow(statisticCards[0], card))).toBe(true);
      expect(statisticCards.map(({ left }) => left)).toEqual([...statisticCards].map(({ left }) => left).sort((a, b) => a - b));
    }
    for (const card of statisticCards) {
      expect(card.width).toBeGreaterThan(0);
      expect(card.overflow).toBeLessThanOrEqual(1);
    }
    const suggestion = page.getByRole("region", { name: "Gợi ý tiếp theo" });
    const suggestionTitle = suggestion.getByText("A1 Everyday English with an intentionally long responsive title", { exact: true });
    const suggestionCta = suggestion.getByRole("link", { name: "Bắt đầu học" });
    const suggestionMetadata = suggestion.getByText("0 / 1 bộ đã hoàn thành", { exact: true });
    await expect(suggestionTitle).toBeVisible();
    await expect(suggestionCta).toBeVisible();
    await expect(suggestionMetadata).toBeVisible();
    const [suggestionTitleBox, suggestionCtaBox, suggestionMetadataBox] = await Promise.all([
      suggestionTitle.boundingBox(),
      suggestionCta.boundingBox(),
      suggestionMetadata.boundingBox(),
    ]);
    if (viewport.width > 800 && viewport.width < 1200) {
      expect(suggestionTitleBox.width).toBeGreaterThanOrEqual(180);
      expect(suggestionCtaBox.y).toBeGreaterThanOrEqual(suggestionMetadataBox.y + suggestionMetadataBox.height + 12);
    }
    if (viewport.width >= 1366) {
      expect(suggestionCtaBox.x).toBeGreaterThanOrEqual(suggestionTitleBox.x + suggestionTitleBox.width + 12);
      expect(suggestionCtaBox.y).toBeLessThan(suggestionMetadataBox.y + suggestionMetadataBox.height);
    }
    const streakCard = page.getByRole("heading", { name: "Chuỗi học" }).locator("..");
    await expect(streakCard.getByLabel("Chuỗi hiện tại 0 ngày")).toBeVisible();
    await expect(streakCard.getByText("Chưa hoàn thành hôm nay", { exact: true })).toBeVisible();
    await expect(page.getByRole("region", { name: "Từ cần ôn" }).getByRole("link", { name: "Xem ôn tập" })).toBeVisible();
    const overflow = await page.evaluate(() => {
      const main = document.querySelector(".authenticated-main");
      return {
        body: document.body.scrollWidth - document.body.clientWidth,
        document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        mainOverflowY: getComputedStyle(main).overflowY,
        mainScrollableDistance: main.scrollHeight - main.clientHeight,
        documentOwnsScroll: document.scrollingElement === document.documentElement,
      };
    });
    expect(overflow.body).toBeLessThanOrEqual(1);
    expect(overflow.document).toBeLessThanOrEqual(1);
    expect(overflow.mainOverflowY).toBe("visible");
    expect(overflow.mainScrollableDistance).toBeLessThanOrEqual(1);
    expect(overflow.documentOwnsScroll).toBe(true);
    if (viewport.width > 800) {
      const recommendationBox = await page.getByRole("region", { name: "Gợi ý tiếp theo" }).boundingBox();
      const reviewBox = await page.getByRole("region", { name: "Từ cần ôn" }).boundingBox();
      expect(Math.abs(recommendationBox.height - reviewBox.height)).toBeLessThanOrEqual(1);
    }
    const regionOverflow = await page.getByRole("region").evaluateAll((elements) => elements.map((element) => element.scrollWidth - element.clientWidth));
    expect(regionOverflow.every((distance) => distance <= 1)).toBe(true);
    if (["narrow-mobile", "wide-tablet", "wide-desktop"].includes(viewport.name)) {
      await page.screenshot({
        fullPage: true,
        path: `test-results/dashboard-responsive/dashboard-${viewport.name}.png`,
      });
    }
  });
}

function responsiveLearningPathResponse() {
  const setId = "10000000-0000-4000-8000-000000000099";
  return {
    status: 200,
    json: {
      success: true,
      data: {
        evaluated_at: "2026-11-03T00:00:00.000Z",
        highest_unlocked_level: "A1",
        path_completed_at: null,
        levels: ["A1", "A2", "B1", "B2", "C1"].map((level, index) => ({
          level,
          unlocked: index === 0,
          required_count: index === 0 ? 1 : 0,
          completed_count: 0,
          configuration: index === 0 ? "READY" : "NO_REQUIRED_SETS",
          current_complete: false,
          incomplete_sets: index === 0 ? [{ id: setId, name: "A1 Everyday English with an intentionally long responsive title", created_at: "2026-11-03T00:00:00.000Z" }] : [],
        })),
        recommendation: { action: "START", set_id: setId, pass_id: null },
        next_suggestion: { action: "START", set_id: setId, pass_id: null },
        next_suggestion_reason: null,
        all_current_sets_complete: false,
      },
    },
  };
}

function resumePathResponse({ passId, setId, setName }) {
  return {
    status: 200,
    json: {
      success: true,
      data: {
        evaluated_at: "2026-11-03T00:00:00.000Z",
        highest_unlocked_level: "A1",
        path_completed_at: null,
        levels: ["A1", "A2", "B1", "B2", "C1"].map((level, index) => ({
          level, unlocked: index === 0, required_count: index === 0 ? 1 : 0,
          completed_count: 0, configuration: index === 0 ? "READY" : "NO_REQUIRED_SETS",
          current_complete: false,
          incomplete_sets: index === 0 ? [{ id: setId, name: setName, created_at: "2026-11-02T00:00:00.000Z" }] : [],
        })),
        recommendation: { action: "RESUME", set_id: setId, pass_id: passId },
        next_suggestion: null,
        next_suggestion_reason: "ALL_INCOMPLETE_SETS_ACTIVE",
        all_current_sets_complete: false,
      },
    },
  };
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
  const loadingCard = page.locator(".animate-pulse").first();
  await expect(loadingCard).toBeVisible();
  await expect(loadingCard).toHaveCSS("animation-name", "none");

  await Promise.all([
    progress.fulfill(progressResponse({ total_started: 1, learning: 1, learned: 0, needs_review: 0 })),
    sets.fulfill(setsResponse()),
  ]);
  await expect(page.getByRole("heading", { name: "Bộ từ cá nhân" }).locator("..")).toContainText("4 bộ cá nhân");
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
        streak_activity_7d: {
          timezone: "Asia/Ho_Chi_Minh",
          days: ["2026-09-18", "2026-09-19", "2026-09-20", "2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24"]
            .map((date) => ({ date, status: "UNAVAILABLE" })),
        },
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

function activePassProjection({
  activityState = "PRISTINE",
  canContinue = true,
  passId,
  setId,
  snapshotSize,
  studiedItems = 0,
}) {
  const readyToComplete = activityState === "READY_TO_COMPLETE";
  return {
    id: passId,
    set_id: setId,
    state: "ACTIVE",
    snapshot_size: snapshotSize,
    studied_items: studiedItems,
    credited_items: studiedItems,
    remaining_items: snapshotSize - studiedItems,
    ready_to_complete: readyToComplete,
    evidence_counts: { NORMAL: studiedItems, SRS: 0 },
    activity_state: activityState,
    active_sessions: { NORMAL: [], SRS: [] },
    can_continue: canContinue,
    ...(canContinue ? {} : { restart_reason: "SNAPSHOT_CHANGED" }),
    created_at: "2026-11-02T00:00:00.000Z",
    completed_at: null,
  };
}

function publicSet(id, name, cefrLevel, itemCount, coverImageUrl = null) {
  return {
    id, topic_id: "60000000-0000-4000-8000-000000000001", name,
    description: `${name} description`, cefr_level: cefrLevel,
    cover_image_url: coverImageUrl, item_count: itemCount,
  };
}
