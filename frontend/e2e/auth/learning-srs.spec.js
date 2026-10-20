// @ts-nocheck
import { expect, test } from "@playwright/test";
import { installAuthApiMock, publicUser, responses } from "./fixtures/auth-api.js";

const SET_ID = "10000000-0000-4000-8000-000000000001";
const SESSION_ID = "20000000-0000-4000-8000-000000000001";

test("defaults to SRS, reveals four ratings, focuses deterministically and requeues AGAIN once", async ({ page }) => {
  const calls = await installLearningMock(page);
  await page.goto(`/learn/vocabulary-sets/${SET_ID}`);

  await expect(page.getByRole("button", { name: "Ôn tập SRS" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Đã hoàn thành 0 / 4")).toBeVisible();
  await expect(page.getByText("Tiến độ SRS", { exact: true })).toBeVisible();
  await expect(page.locator("progress")).toHaveAttribute("value", "0");
  await expect(page.getByRole("button", { name: "Thẻ trước" })).toHaveCount(0);
  await page.getByRole("heading", { name: "word-1" }).press("Space");
  await expect(page.getByRole("heading", { name: "nghĩa word-1" })).toBeFocused();
  const ratings = page.getByRole("region", { name: "Đánh giá SRS" });
  await expect(ratings.getByRole("button")).toHaveText([
    "LạiTrong phiên này", "KhóNgày mai", "Tốt1–3 ngày", "Dễ1 tuần+",
  ]);
  for (const button of await ratings.getByRole("button").all()) {
    await expect(button).toHaveAttribute("aria-label", /.+, .+/);
  }
  await ratings.getByRole("button", { name: "Lại, Trong phiên này", exact: true }).press("Enter");
  await expect(page.getByRole("heading", { name: "word-2" })).toBeFocused();
  await expect(page.getByText("Đã hoàn thành 0 / 4")).toBeVisible();
  const afterAgain = await page.evaluate((setId) => JSON.parse(
    sessionStorage.getItem(`elvocab.learning.run.v1:user-1:${setId}`),
  ), SET_ID);
  expect(afterAgain.srs.queue).toEqual([2, 3, 4, 1].map(vocabularyId));
  expect(afterAgain.srs.passed_ids).toEqual([]);
  await expect(page.locator('.sr-only[role="status"]')).not.toContainText(/\+\d+ XP/);

  for (const word of ["word-2", "word-3", "word-4"]) {
    await page.getByRole("heading", { name: word }).press("Space");
    await page.getByRole("button", { name: "Tốt" }).click();
  }
  await expect(page.getByRole("heading", { name: "word-1" })).toBeFocused();
  await expect(page.getByText("Đã hoàn thành 3 / 4")).toBeVisible();
  expect(calls.events.map(({ vocabulary_id }) => vocabulary_id)).toEqual([
    vocabularyId(1), vocabularyId(2), vocabularyId(3), vocabularyId(4),
  ]);
});

test("focuses the initial SRS card only after the authoritative session becomes active", async ({ page }) => {
  const calls = await installLearningMock(page, { deferSrsSession: true });
  await page.goto(`/learn/vocabulary-sets/${SET_ID}`);

  await expect.poll(() => calls.sessions.filter(({ method, body }) => method === "POST"
    && body.mode === "SRS").length).toBe(1);
  const cardHeading = page.getByRole("heading", { name: "word-1" });
  await expect(cardHeading).toHaveCount(0);

  calls.resolveSrsSession();
  await expect(cardHeading).toBeVisible();
  await expect(cardHeading).toBeFocused();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Hoàn thành ôn tập" })).toHaveCount(0);

  await page.keyboard.press("Space");
  await expect(page.getByRole("heading", { name: "nghĩa word-1" })).toBeFocused();
});

test("new SRS XP uses one Toast without persistence and reload stays silent", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await installLearningMock(page, { cardCount: 2 });
  await page.goto(`/learn/vocabulary-sets/${SET_ID}`);
  await page.getByRole("heading", { name: "word-1" }).press("Space");
  await page.getByRole("button", { name: "Tốt" }).press("Enter");

  const xpToast = page.getByRole("alert").filter({ hasText: "Bạn vừa nhận +3 XP!" });
  await expect(xpToast).toHaveCount(1);
  const toastRoot = xpToast.locator("xpath=ancestor-or-self::div[contains(concat(' ', normalize-space(@class), ' '), ' Toastify__toast ')][1]");
  await toastRoot.hover();
  await expect(toastRoot).toHaveCSS("transform", "none");
  const toastBox = await toastRoot.boundingBox();
  expect(toastBox.x).toBeGreaterThanOrEqual(8);
  expect(toastBox.x + toastBox.width).toBeLessThanOrEqual(375 - 8);
  const closeBox = await toastRoot.locator(".Toastify__close-button").boundingBox();
  expect(closeBox.width).toBeGreaterThanOrEqual(44);
  expect(closeBox.height).toBeGreaterThanOrEqual(44);
  await expect(page.locator('.sr-only[role="status"]')).not.toContainText(/\+\d+ XP/);
  const stored = await page.evaluate((setId) => sessionStorage.getItem(`elvocab.learning.run.v1:user-1:${setId}`), SET_ID);
  expect(stored).not.toContain("reward");
  expect(stored).not.toContain("xp_earned");
  await page.screenshot({
    fullPage: true,
    path: "test-results/task-230-evidence/srs-positive-xp-mobile.png",
  });

  await page.reload();
  await expect(page.getByRole("heading", { name: "word-2" })).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: /\+\d+ XP/ })).toHaveCount(0);
  await expect(page.locator('.sr-only[role="status"]')).not.toContainText(/\+\d+ XP/);
});

test("zero and replayed SRS responses never announce XP", async ({ page }) => {
  await installLearningMock(page, {
    onEvent(body) {
      const response = successRating(body);
      if (body.rating === "GOOD") response.data.reward.replayed = true;
      return { status: 200, json: response };
    },
  });
  await page.goto(`/learn/vocabulary-sets/${SET_ID}`);
  await page.getByRole("heading", { name: "word-1" }).press("Space");
  await page.getByRole("button", { name: "Lại, Trong phiên này", exact: true }).press("Enter");
  await expect(page.getByRole("alert").filter({ hasText: /\+\d+ XP/ })).toHaveCount(0);
  await expect(page.locator('.sr-only[role="status"]')).not.toContainText(/\+\d+ XP/);
  await page.getByRole("heading", { name: "word-2" }).press("Space");
  await page.getByRole("button", { name: "Tốt" }).press("Enter");
  await expect(page.getByRole("alert").filter({ hasText: /\+\d+ XP/ })).toHaveCount(0);
  await expect(page.locator('.sr-only[role="status"]')).not.toContainText(/\+\d+ XP/);
});

test("SRS lost response retry preserves the exact event and session identity", async ({ page }) => {
  const calls = await installLearningMock(page, { failEventOnce: true });
  await page.goto(`/learn/vocabulary-sets/${SET_ID}`);
  await page.getByRole("heading", { name: "word-1" }).press("Space");
  await page.getByRole("button", { name: "Tốt" }).click();
  await expect(page.getByRole("alert")).toContainText("thử lại");
  const original = { ...calls.events[0] };
  await page.reload();
  await expect(page.getByRole("alert")).toContainText("chưa xác định kết quả");
  await page.getByRole("alert").getByRole("button", { name: "Thử lại" }).click();
  expect(calls.events).toHaveLength(2);
  expect(calls.events[1]).toEqual(original);
  expect(calls.events[1].session_id).toBe(SESSION_ID);
});

test("SRS terminal mutation rejection reconciles authoritative expiry", async ({ page }) => {
  const terminal = await installLearningMock(page, { eventTerminalCode: "LEARNING_SESSION_EXPIRED" });
  await page.goto(`/learn/vocabulary-sets/${SET_ID}`);
  await page.getByRole("heading", { name: "word-1" }).press("Space");
  await page.getByRole("button", { name: "Tốt" }).click();
  await expect(page.getByRole("alert")).toContainText("Phiên SRS đã hết hạn");
  expect(terminal.events).toHaveLength(1);
});

test("NORMAL preserves browsing and never submits a rating", async ({ page }) => {
  const calls = await installLearningMock(page);
  await page.goto(`/learn/vocabulary-sets/${SET_ID}`);
  await page.getByRole("button", { name: "Ôn tập thường" }).click();
  await expect(page.getByRole("button", { name: "Ôn tập thường" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Thẻ 1 / 4")).toBeVisible();
  await expect(page.getByText("Tiến độ", { exact: true })).toBeVisible();
  await expect(page.locator("progress")).toHaveAttribute("value", "1");
  await expect(page.getByRole("region", { name: "Đánh giá SRS" })).toHaveCount(0);
  const normalNavigation = page.getByRole("navigation", { name: "Điều hướng thẻ" });
  const previous = normalNavigation.getByRole("button", { name: "Thẻ trước" });
  const next = normalNavigation.getByRole("button", { name: "Thẻ sau" });
  await expect(previous).toHaveCSS("cursor", "not-allowed");
  await expect(next).toHaveCSS("cursor", "pointer");
  await expectEqualNavigationButtons(previous, next);
  await page.getByRole("button", { name: "Thẻ sau" }).click();
  await expect(page.getByRole("heading", { name: "word-2" })).toBeFocused();
  await page.mouse.move(0, 0);
  await expect(previous).toHaveCSS("cursor", "pointer");
  await expect(previous).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(previous).toHaveCSS("border-color", "rgb(249, 115, 22)");
  await expect(previous).toHaveCSS("color", "rgb(249, 115, 22)");
  await expect(next).toHaveCSS("background-color", "rgb(126, 211, 33)");
  await expect(next).toHaveCSS("border-color", "rgb(126, 211, 33)");
  await expect(next).toHaveCSS("color", "rgb(255, 255, 255)");
  await expect(previous).toContainText("Key: ←");
  await expect(next).toContainText("Key: →");
  await page.getByRole("heading", { name: "word-2" }).press("Space");
  await expect(page.getByRole("button", { name: "Thẻ trước" })).toBeVisible();
  await expectEqualNavigationButtons(previous, next);
  expect(calls.events).toHaveLength(0);
});

test("NORMAL records each reveal, completes explicitly and reopens the terminal session without XP", async ({ page }) => {
  const calls = await installLearningMock(page);
  await page.goto(`/learn/vocabulary-sets/${SET_ID}`);
  await page.getByRole("button", { name: "Ôn tập thường" }).click();
  await expect.poll(() => calls.sessions.filter(({ body }) => body.mode === "NORMAL").length).toBe(1);

  for (let number = 1; number <= 4; number += 1) {
    await page.getByRole("heading", { name: `word-${number}` }).press("Space");
    await expect(page.locator('.sr-only[role="status"]')).toContainText("Đã ghi nhận thẻ được lật");
    if (number < 4) await page.getByRole("button", { name: "Thẻ sau" }).click();
  }
  const finish = page.getByRole("button", { name: "Hoàn thành phiên" });
  await expect(finish).toBeEnabled();
  await finish.click();
  const summaryHeading = page.getByRole("heading", { name: "Hoàn thành bộ từ" });
  const summary = page.getByRole("status").filter({ has: summaryHeading });
  await expect(summaryHeading).toBeVisible();
  await expect(summaryHeading).toBeFocused();
  await expect(summary).toContainText("Chuỗi hiện tại 1 ngày");
  await expect(page.getByRole("alert").filter({ hasText: /XP/ })).toHaveCount(0);
  expect(calls.events).toHaveLength(0);
  expect(calls.sessions.filter(({ method }) => method === "PUT")).toHaveLength(4);
  expect(calls.sessions.filter(({ method, pathname }) => method === "POST" && pathname.endsWith("/complete"))).toHaveLength(1);

  await page.reload();
  await expect(page.getByRole("heading", { name: "Hoàn thành bộ từ" })).toBeVisible();
  expect(calls.sessions.filter(({ method, pathname, body }) => method === "POST"
    && pathname === "/api/learning-sessions" && body.mode === "NORMAL")).toHaveLength(1);
});

test("NORMAL retries a lost reveal with the same operation and resumes its persisted cursor", async ({ page }) => {
  const calls = await installLearningMock(page, { failRevealOnce: true });
  await page.goto(`/learn/vocabulary-sets/${SET_ID}`);
  await page.getByRole("group").first().getByRole("button").nth(1).click();
  await expect.poll(() => calls.sessions.filter(({ method, body }) => method === "POST"
    && body.mode === "NORMAL").length).toBe(1);
  const normalNavigation = page.getByRole("navigation", { name: "Điều hướng thẻ" });
  const nextCard = normalNavigation.getByRole("button", { name: /Thẻ sau/ });
  await expect(page.getByRole("status").filter({ hasText: "Đang chuẩn bị phiên học…" })).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(nextCard).toBeVisible();
  await expect(nextCard).toBeEnabled();
  await expect(page.getByRole("button", { name: /^(Lại|Khó|Tốt|Dễ),/ })).toHaveCount(0);
  await page.getByRole("heading", { name: "word-1" }).press("Space");
  await expect(page.getByRole("alert").getByRole("button")).toBeVisible();
  await page.getByRole("alert").getByRole("button").click();
  const revealCalls = calls.sessions.filter(({ method }) => method === "PUT");
  expect(revealCalls).toHaveLength(2);
  expect(revealCalls[0].body.operation_id).toBe(revealCalls[1].body.operation_id);
  await page.keyboard.press("Space");
  await page.keyboard.press("Space");
  expect(calls.sessions.filter(({ method }) => method === "PUT")).toHaveLength(2);

  await page.getByRole("navigation").getByRole("button").nth(1).click();
  await expect(page.getByRole("heading", { name: "word-2" })).toBeFocused();
  await page.reload();
  await expect(page.getByRole("heading", { name: "word-2" })).toBeVisible();
  await expect(page.locator('.sr-only[role="status"]')).not.toContainText(/XP/);
  expect(calls.events).toHaveLength(0);
});

test("NORMAL reveal expiry reconciles terminal state and preserves keyboard focus recovery", async ({ page }) => {
  const calls = await installLearningMock(page, { revealTerminalCode: "LEARNING_SESSION_EXPIRED" });
  await page.goto(`/learn/vocabulary-sets/${SET_ID}`);
  await expect.poll(() => calls.sessions.filter(({ body }) => body.mode === "SRS").length).toBe(1);
  await page.getByRole("group").first().getByRole("button").nth(1).click();
  await expect.poll(() => calls.sessions.filter(({ body }) => body.mode === "NORMAL").length).toBe(1);
  await page.getByRole("heading", { name: "word-1" }).press("Space");
  await expect(page.getByRole("alert").getByRole("button")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
  expect(calls.events).toHaveLength(0);
});

test("NORMAL completion access revocation reconciles inaccessible without evidence mutation", async ({ page }) => {
  const calls = await installLearningMock(page, { cardCount: 1, completeTerminalCode: "LEARNING_SESSION_INACCESSIBLE" });
  await page.goto(`/learn/vocabulary-sets/${SET_ID}`);
  await expect.poll(() => calls.sessions.filter(({ body }) => body.mode === "SRS").length).toBe(1);
  await page.getByRole("group").first().getByRole("button").nth(1).click();
  await expect.poll(() => calls.sessions.filter(({ body }) => body.mode === "NORMAL").length).toBe(1);
  await page.getByRole("heading", { name: "word-1" }).press("Space");
  await page.getByRole("navigation").getByRole("button").nth(1).click();
  await expect(page.getByRole("alert").getByRole("button")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("alert").getByRole("button")).toBeVisible();
  expect(calls.events).toHaveLength(0);
  expect(calls.sessions.filter(({ method }) => method === "PUT")).toHaveLength(1);
});

test("learning header centers modes, uses a full-width divider and exposes restart tooltip", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await installLearningMock(page);
  await page.goto("/learn/vocabulary-sets/10000000-0000-4000-8000-000000000001");

  const header = page.locator(".learning-toolbar");
  const headerBox = await header.boundingBox();
  expect(headerBox.x).toBe(0);
  expect(headerBox.width).toBe(1366);
  await expect(header).toHaveCSS("border-bottom-width", "1px");

  const backBox = await page.getByRole("button", { name: /Bộ ôn tập/ }).boundingBox();
  const hintsBox = await page.getByLabel("Phím tắt học").boundingBox();
  const modes = page.getByRole("group", { name: "Chế độ ôn tập" });
  const modesBox = await modes.boundingBox();
  const restartBox = await page.getByRole("button", { name: "Bắt đầu lại" }).boundingBox();
  expect(backBox.x).toBeLessThan(hintsBox.x);
  expect(hintsBox.x).toBeLessThan(modesBox.x);
  expect(modesBox.x).toBeLessThan(restartBox.x);
  await expect(page.getByLabel("Phím tắt học")).toContainText("SpaceLật thẻ");
  await expect(page.getByLabel("Phím tắt học")).not.toContainText("Thẻ trước");
  await expect(page.getByLabel("Phím tắt học").getByText("Lật thẻ", { exact: true })).toHaveCSS("font-size", "15px");
  await expect(page.getByLabel("Phím tắt học").getByText("Lật thẻ", { exact: true })).toHaveCSS("font-weight", "500");
  for (const name of ["Ôn tập SRS", "Ôn tập thường"]) {
    await expect(page.getByRole("button", { name })).toHaveCSS("cursor", "pointer");
  }

  const restart = page.getByRole("button", { name: "Bắt đầu lại" });
  const tooltip = page.getByRole("tooltip", { name: "Bắt đầu lại" });
  await expect(restart).toHaveText("");
  await expect(restart).toHaveCSS("cursor", "pointer");
  await expect(tooltip).toHaveCSS("opacity", "0");
  await restart.hover();
  await expect(tooltip).toHaveCSS("opacity", "1");
  await page.mouse.move(0, 0);
  await restart.focus();
  await expect(restart).toBeFocused();
  await expect(tooltip).toHaveCSS("opacity", "1");
});

test("NORMAL arrow shortcuts respect boundaries and editable/native controls while SRS arrows never skip", async ({ page }) => {
  await installLearningMock(page);
  await page.goto("/learn/vocabulary-sets/10000000-0000-4000-8000-000000000001");

  await page.getByRole("heading", { name: "word-1" }).press("ArrowRight");
  await expect(page.getByRole("heading", { name: "word-1" })).toBeVisible();
  await page.getByRole("heading", { name: "word-1" }).press("Space");
  await expect(page.getByRole("heading", { name: "nghĩa word-1" })).toBeFocused();
  await page.getByRole("heading", { name: "nghĩa word-1" }).press("ArrowLeft");
  await expect(page.getByRole("heading", { name: "nghĩa word-1" })).toBeVisible();

  await page.getByRole("button", { name: "Ôn tập thường" }).click();
  await expect(page.getByLabel("Phím tắt học")).toContainText("←Thẻ trước");
  await expect(page.getByLabel("Phím tắt học")).toContainText("→Thẻ sau");
  await page.getByRole("heading", { name: "word-1" }).press("ArrowLeft");
  await expect(page.getByRole("heading", { name: "word-1" })).toBeVisible();
  await page.getByRole("heading", { name: "word-1" }).press("ArrowRight");
  await expect(page.getByRole("heading", { name: "word-2" })).toBeFocused();
  await page.getByRole("heading", { name: "word-2" }).press("ArrowLeft");
  await expect(page.getByRole("heading", { name: "word-1" })).toBeFocused();

  await page.evaluate(() => {
    const input = document.createElement("input");
    input.setAttribute("aria-label", "Shortcut guard input");
    document.body.append(input);
  });
  const input = page.getByLabel("Shortcut guard input");
  await input.focus();
  await input.press("ArrowRight");
  await expect(page.getByRole("heading", { name: "word-1" })).toBeVisible();

  const next = page.getByRole("navigation", { name: "Điều hướng thẻ" }).getByRole("button", { name: /Thẻ sau/ });
  await next.focus();
  await next.press("ArrowRight");
  await expect(page.getByRole("heading", { name: "word-1" })).toBeVisible();
});

test("mode switching keeps the learning shell visible and uses card-area loading", async ({ page }) => {
  let releaseNormal;
  const normalPending = new Promise((resolve) => { releaseNormal = resolve; });
  await installLearningMock(page, {
    onRead: (mode) => mode === "NORMAL" ? normalPending : Promise.resolve(),
  });
  await page.goto("/learn/vocabulary-sets/10000000-0000-4000-8000-000000000001");
  await page.getByRole("button", { name: "Ôn tập thường" }).click();

  await expect(page.getByRole("group", { name: "Chế độ ôn tập" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ôn tập thường" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Đang chuyển chế độ…")).toBeVisible();
  await expect(page.getByText("Đang chuẩn bị phiên ôn tập")).toHaveCount(0);

  releaseNormal();
  await expect(page.getByText("Thẻ 1 / 4")).toBeVisible();
  await expect(page.getByText("Đang chuyển chế độ…")).toHaveCount(0);
});

test("old two-outcome storage fails closed and accepted state resumes after reload", async ({ page }) => {
  await page.addInitScript(() => {
    if (localStorage.getItem("learning-v1-seeded")) return;
    localStorage.setItem("learning-v1-seeded", "true");
    sessionStorage.setItem("elvocab.learning.run.v1:user-1:10000000-0000-4000-8000-000000000001", JSON.stringify({
      version: 1, user_id: "user-1", set_id: "10000000-0000-4000-8000-000000000001",
      current_vocabulary_id: "word-4", assessments: { "word-1": "REMEMBERED" },
    }));
  });
  await installLearningMock(page);
  await page.goto("/learn/vocabulary-sets/10000000-0000-4000-8000-000000000001");
  await expect(page.getByRole("heading", { name: "word-1" })).toBeVisible();
  await page.getByRole("heading", { name: "word-1" }).press("Space");
  await page.getByRole("button", { name: "Lại, Trong phiên này", exact: true }).click();
  await page.reload();
  await expect(page.getByRole("heading", { name: "word-2" })).toBeVisible();
  const stored = await page.evaluate(() => JSON.parse(sessionStorage.getItem("elvocab.learning.run.v1:user-1:10000000-0000-4000-8000-000000000001")));
  expect(stored.version).toBe(3);
  expect(stored.srs.queue.filter((id) => id === vocabularyId(1))).toHaveLength(1);
});

test("a completed v3 review remains completed until explicit continuation", async ({ page }) => {
  await seedSettledSession(page);
  await installLearningMock(page, { initialSession: completedSrsProjection(4) });
  await page.goto("/learn/vocabulary-sets/10000000-0000-4000-8000-000000000001");

  await expect(page.getByRole("heading", { name: "Hoàn thành ôn tập" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ôn tiếp" })).toBeVisible();
});

test("a completed v3 review can explicitly continue into the up-to-date state", async ({ page }) => {
  await seedSettledSession(page);
  await installLearningMock(page, { upToDate: true, initialSession: completedSrsProjection(4) });
  await page.goto("/learn/vocabulary-sets/10000000-0000-4000-8000-000000000001");

  await expect(page.getByRole("heading", { name: "Hoàn thành ôn tập" })).toBeVisible();
  await page.getByRole("button", { name: "Ôn tiếp" }).click();
  await expect(page.getByRole("heading", { name: "Hoàn thành ôn tập" })).toBeVisible();
});

test("AGAIN on the final card immediately presents that unresolved card again", async ({ page }) => {
  const calls = await installLearningMock(page, { cardCount: 1 });
  await page.goto("/learn/vocabulary-sets/10000000-0000-4000-8000-000000000001");
  await page.getByRole("heading", { name: "word-1" }).press("Space");
  await page.getByRole("button", { name: "Lại, Trong phiên này", exact: true }).click();

  await expect(page.getByRole("heading", { name: "word-1" })).toBeFocused();
  await expect(page.getByText("Đã hoàn thành 0 / 1")).toBeVisible();
  await expect(page.getByRole("region", { name: "Đánh giá SRS" })).toHaveCount(0);
  const stored = await page.evaluate(() => JSON.parse(
    sessionStorage.getItem("elvocab.learning.run.v1:user-1:10000000-0000-4000-8000-000000000001"),
  ));
  expect(stored.srs.queue).toEqual([vocabularyId(1)]);
  expect(stored.srs.passed_ids).toEqual([]);

  await page.getByRole("heading", { name: "word-1" }).press("Space");
  await page.getByRole("button", { name: "Tốt" }).click();
  await expect(page.getByRole("heading", { name: "Hoàn thành ôn tập" })).toBeVisible();
  expect(calls.events.map(({ rating }) => rating)).toEqual(["AGAIN", "GOOD"]);
});

test("completed session route re-entry preserves completion until explicit continuation", async ({ page }) => {
  const calls = await installLearningMock(page, {
    cardCount: 1,
    upToDate: ({ events }) => events.length > 0,
  });
  await page.goto("/learn/vocabulary-sets/10000000-0000-4000-8000-000000000001");
  await page.getByRole("heading", { name: "word-1" }).press("Space");
  await page.getByRole("button", { name: "Dễ" }).click();
  await expect(page.getByRole("heading", { name: "Hoàn thành ôn tập" })).toBeVisible();

  await page.goto("/dashboard");
  await page.goto("/learn/vocabulary-sets/10000000-0000-4000-8000-000000000001");
  await expect(page.getByRole("heading", { name: "Hoàn thành ôn tập" })).toBeVisible();
  expect(calls.reads.length).toBeGreaterThanOrEqual(2);
  expect(calls.reads.every((mode) => mode === "SRS")).toBe(true);
});

test("completed session continuation fetches fresh eligibility and becomes up-to-date", async ({ page }) => {
  const calls = await installLearningMock(page, {
    cardCount: 1,
    upToDate: ({ events }) => events.length > 0,
  });
  await page.goto("/learn/vocabulary-sets/10000000-0000-4000-8000-000000000001");
  await page.getByRole("heading", { name: "word-1" }).press("Space");
  await page.getByRole("button", { name: "Tốt" }).click();
  await expect(page.getByRole("heading", { name: "Hoàn thành ôn tập" })).toBeVisible();

  await page.getByRole("button", { name: "Ôn tiếp" }).click();
  await expect(page.getByRole("heading", { name: "Hoàn thành ôn tập" })).toBeVisible();
  expect(calls.reads.length).toBeGreaterThanOrEqual(2);
  expect(calls.reads.every((mode) => mode === "SRS")).toBe(true);
});

test("pending and conflict states never advance optimistically", async ({ page }) => {
  let resolveEvent;
  const pending = new Promise((resolve) => { resolveEvent = resolve; });
  await installLearningMock(page, { onEvent: () => pending });
  await page.goto("/learn/vocabulary-sets/10000000-0000-4000-8000-000000000001");
  await page.getByRole("heading", { name: "word-1" }).press("Space");
  await page.getByRole("button", { name: "Tốt" }).click();
  await expect(page.getByRole("button", { name: "Tốt" })).toBeDisabled();
  await expect(page.getByRole("heading", { name: "nghĩa word-1" })).toBeVisible();
  resolveEvent({ status: 409, json: failure("LEARNING_PROGRESS_CHANGED") });
  await expect(page.getByRole("alert")).toContainText("Phiên SRS đã thay đổi");
  await expect(page.getByRole("alert").filter({ hasText: /\+\d+ XP/ })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "nghĩa word-1" })).toBeVisible();
});

test("up-to-date SRS offers Normal review and return action", async ({ page }) => {
  await installLearningMock(page, { upToDate: true });
  await page.goto("/learn/vocabulary-sets/10000000-0000-4000-8000-000000000001");
  await expect(page.getByRole("heading", { name: "Hoàn thành ôn tập" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ôn tập thường" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Quay lại bộ từ" })).toBeVisible();
  await expect(page.getByText("Hiện chưa có từ nào đến hạn. Bạn có thể ôn tập thường hoặc quay lại bộ từ.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Làm mới SRS" })).toHaveCount(0);
});

test("rating sub-labels render backend-provided intervals without frontend derivation", async ({ page }) => {
  await installLearningMock(page, {
    ratingPreviews: ratingPreviews(3, 7, 14),
  });
  await page.goto("/learn/vocabulary-sets/10000000-0000-4000-8000-000000000001");
  await page.getByRole("heading", { name: "word-1" }).press("Space");

  for (const accessibleName of [
    "Lại, Trong phiên này", "Khó, 1–3 ngày", "Tốt, 1 tuần+", "Dễ, 2 tuần",
  ]) {
    await expect(page.getByRole("button", { name: accessibleName, exact: true })).toBeVisible();
  }
});

test("rating sub-labels render exact 14-day and capped 30-day previews", async ({ page }) => {
  await installLearningMock(page, {
    ratingPreviews: ratingPreviews(14, 30, 30),
  });
  await page.goto("/learn/vocabulary-sets/10000000-0000-4000-8000-000000000001");
  await page.getByRole("heading", { name: "word-1" }).press("Space");

  await expect(page.getByRole("button", { name: "Khó, 2 tuần", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Tốt, 30 ngày", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Dễ, 30 ngày", exact: true })).toBeVisible();
});

test("long back-face content grows the shared card and never creates internal scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await installLearningMock(page, { longContent: true });
  await page.goto("/learn/vocabulary-sets/10000000-0000-4000-8000-000000000001");
  await page.getByRole("heading", { name: "word-1" }).press("Space");

  await expect(page.getByText("Long example ending marker.")).toBeVisible();
  const measurements = await page.locator(".learning-card").evaluateAll((faces) => faces.map((face) => ({
    clientHeight: face.clientHeight,
    overflowY: getComputedStyle(face).overflowY,
    scrollHeight: face.scrollHeight,
  })));
  for (const face of measurements) {
    expect(face.overflowY).not.toMatch(/auto|scroll/);
    expect(face.scrollHeight).toBeLessThanOrEqual(face.clientHeight);
  }
  const cardBox = await page.locator(".learning-flip-stage").boundingBox();
  expect(cardBox.height).toBeGreaterThan(384);
});

for (const viewport of [
  { name: "desktop-1366", width: 1366, height: 768 },
  { name: "desktop-1536", width: 1536, height: 864 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "tablet-820", width: 820, height: 1180 },
  { name: "mobile-375", width: 375, height: 812 },
  { name: "mobile-390", width: 390, height: 844 },
]) {
  test(`segmented header and four ratings remain responsive on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await installLearningMock(page);
    await page.goto("/learn/vocabulary-sets/10000000-0000-4000-8000-000000000001");
    const headerBox = await page.locator(".learning-toolbar").boundingBox();
    expect(headerBox.x).toBe(0);
    expect(headerBox.width).toBe(viewport.width);
    await expect(page.locator(".learning-toolbar")).toHaveCSS("border-bottom-width", "1px");
    await expect(page.getByRole("group", { name: "Chế độ ôn tập" })).toBeVisible();
    await expect(page.getByLabel("Phím tắt học")).toContainText("SpaceLật thẻ");
    const cardBox = await page.locator(".learning-flip-stage").boundingBox();
    expect(cardBox.width).toBeLessThanOrEqual(640);
    if (viewport.width >= 1024) expect(cardBox.height).toBe(384);
    await expect(page.locator("progress")).toBeVisible();
    await page.getByRole("heading", { name: "word-1" }).press("Space");
    for (const overflowY of await page.locator(".learning-card").evaluateAll((faces) =>
      faces.map((face) => getComputedStyle(face).overflowY))) {
      expect(overflowY).not.toMatch(/auto|scroll/);
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);
    for (const name of ["Ôn tập SRS", "Ôn tập thường", "Lại, Trong phiên này", "Khó, Ngày mai", "Tốt, 1–3 ngày", "Dễ, 1 tuần+"]) {
      const box = await page.getByRole("button", { name, exact: true }).boundingBox();
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    const ratingBoxes = await page.getByRole("region", { name: "Đánh giá SRS" })
      .getByRole("button").evaluateAll((buttons) => buttons.map((button) => ({
        width: button.getBoundingClientRect().width,
        height: button.getBoundingClientRect().height,
        borderWidth: getComputedStyle(button).borderTopWidth,
        borderColor: getComputedStyle(button).borderTopColor,
        backgroundColor: getComputedStyle(button).backgroundColor,
      })));
    expect(new Set(ratingBoxes.map(({ width }) => width)).size).toBe(1);
    expect(new Set(ratingBoxes.map(({ height }) => height)).size).toBe(1);
    expect(ratingBoxes[0].height).toBe(56);
    for (const { borderWidth, borderColor, backgroundColor } of ratingBoxes) {
      expect(borderWidth).toBe("2px");
      expect(borderColor).not.toBe("rgba(0, 0, 0, 0)");
      expect(borderColor).not.toBe(backgroundColor);
      expect(backgroundColor).toBe("rgb(255, 255, 255)");
    }
    await page.getByRole("button", { name: "Ôn tập thường" }).click();
    const normalNavigation = page.getByRole("navigation", { name: "Điều hướng thẻ" });
    await expectEqualNavigationButtons(
      normalNavigation.getByRole("button", { name: "Thẻ trước" }),
      normalNavigation.getByRole("button", { name: "Thẻ sau" }),
    );
    const duration = await page.locator(".learning-card-flipper").evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).transitionDuration));
    expect(duration).toBeLessThanOrEqual(0.001);
  });
}

async function expectEqualNavigationButtons(previous, next) {
  const [previousBox, nextBox] = await Promise.all([previous.boundingBox(), next.boundingBox()]);
  expect(previousBox.width).toBe(nextBox.width);
  expect(previousBox.height).toBe(nextBox.height);
  expect(previousBox.height).toBe(56);
  for (const button of [previous, next]) {
    const fontWeight = Number(await button.evaluate((element) => getComputedStyle(element).fontWeight));
    expect(fontWeight).toBeGreaterThanOrEqual(600);
  }
}

async function installLearningMock(page, options = {}) {
  await installAuthApiMock(page, { "/api/auth/me": responses.currentUser(publicUser) });
  const calls = { reads: [], events: [], sessions: [] };
  let resolveSrsSession;
  const srsSessionReady = options.deferSrsSession
    ? new Promise((resolve) => { resolveSrsSession = resolve; })
    : null;
  calls.resolveSrsSession = () => resolveSrsSession?.();
  let session = options.initialSession ?? null;
  let revealFailures = options.failRevealOnce ? 1 : 0;
  let eventFailures = options.failEventOnce ? 1 : 0;
  await page.route("**/api/learning-sessions**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const body = request.postData() ? request.postDataJSON() : {};
    calls.sessions.push({ method: request.method(), pathname: url.pathname, body });
    if (request.method() === "POST" && url.pathname === "/api/learning-sessions") {
      const srsUpToDate = typeof options.upToDate === "function"
        ? options.upToDate(calls) : options.upToDate;
      if (body.mode === "SRS" && srsUpToDate === true) {
        await route.fulfill({ status: 200, json: { success: true, data: {
          session: null, reason: "SRS_UP_TO_DATE", replayed: false,
        } } });
        return;
      }
      const ids = body.mode === "SRS"
        ? Array.from({ length: options.cardCount ?? 4 }, (_, index) => vocabularyId(index + 1))
        : body.vocabulary_ids;
      session = learningSessionProjection(body.mode, ids);
      if (body.mode === "SRS" && srsSessionReady) await srsSessionReady;
      await route.fulfill({ status: 201, json: { success: true, data: { session, replayed: false } } });
      return;
    }
    if (request.method() === "GET") {
      await route.fulfill({ status: 200, json: { success: true, data: {
        ...session, can_continue: session.state === "ACTIVE" && session.restart_reason === undefined,
      } } });
      return;
    }
    if (request.method() === "PUT") {
      const vocabularyId = url.pathname.split("/").at(-2);
      if (revealFailures > 0) {
        revealFailures -= 1;
        await route.fulfill({ status: 503, json: failure("LEARNING_SESSION_REQUEST_FAILED") });
        return;
      }
      if (options.revealTerminalCode) {
        session = terminalSession(session, options.revealTerminalCode);
        await route.fulfill({ status: 409, json: failure(options.revealTerminalCode) });
        return;
      }
      session = { ...session,
        items: session.items.map((item) => item.vocabulary_id === vocabularyId ? { ...item, evidence: "NORMAL_REVEALED" } : item) };
      session = { ...session, completed_items: session.items.filter(({ evidence }) => evidence !== null).length };
      await route.fulfill({ status: 200, json: { success: true, data: {
        item: { vocabulary_id: vocabularyId, evidence: "NORMAL_REVEALED", evidence_at: NOW },
        session, replayed: false, already_acknowledged: false,
      } } });
      return;
    }
    if (options.completeTerminalCode) {
      session = terminalSession(session, options.completeTerminalCode);
      await route.fulfill({ status: 409, json: failure(options.completeTerminalCode) });
      return;
    }
    session = { ...session, state: "COMPLETED", completed_at: NOW };
    await route.fulfill({ status: 200, json: { success: true, data: {
      session, replayed: false,
      streak: { current_streak: 1, completed_today: true, last_qualified_date: "2026-10-04", timezone: "Asia/Ho_Chi_Minh", evaluated_at: NOW },
    } } });
  });
  await page.route("**/api/learning/sets/**", async (route) => {
    const mode = new URL(route.request().url()).searchParams.get("mode") ?? "SRS";
    calls.reads.push(mode);
    if (options.onRead) await options.onRead(mode);
    const upToDate = typeof options.upToDate === "function"
      ? options.upToDate(calls)
      : options.upToDate;
    await route.fulfill({ status: 200, json: { success: true, data: mode === "NORMAL" ? normalPayload(options.longContent, options.cardCount) : srsPayload(upToDate, options.longContent, options.cardCount, options.ratingPreviews) } });
  });
  await page.route("**/api/learning/events", async (route) => {
    const body = route.request().postDataJSON();
    calls.events.push(body);
    if (eventFailures > 0) {
      eventFailures -= 1;
      await route.fulfill({ status: 503, json: failure("LEARNING_REQUEST_FAILED") });
      return;
    }
    if (options.eventTerminalCode) {
      session = terminalSession(session, options.eventTerminalCode);
      await route.fulfill({ status: 409, json: failure(options.eventTerminalCode) });
      return;
    }
    const response = options.onEvent ? await options.onEvent(body) : { status: 200, json: successRating(body) };
    if (response.status === 200 && response.json?.data && body.session_id === session?.id) {
      const evidence = body.rating === "AGAIN" ? null : `SRS_${body.rating}`;
      if (evidence) {
        session = { ...session, items: session.items.map((item) => (
          item.vocabulary_id === body.vocabulary_id ? { ...item, evidence } : item
        )) };
        const completedItems = session.items.filter((item) => item.evidence !== null).length;
        session = {
          ...session,
          completed_items: completedItems,
          ...(completedItems === session.snapshot_size
            ? { state: "COMPLETED", completed_at: NOW } : {}),
        };
      }
      response.json.data.session = session;
      if (session.state === "COMPLETED") {
        response.json.data.streak = {
          current_streak: 1, completed_today: true, last_qualified_date: "2026-10-04",
          timezone: "Asia/Ho_Chi_Minh", evaluated_at: NOW,
        };
      }
    }
    await route.fulfill(response);
  });
  return calls;
}

function terminalSession(session, code) {
  if (code === "LEARNING_SESSION_INACCESSIBLE") {
    return { ...session, restart_reason: "SESSION_INACCESSIBLE" };
  }
  return { ...session, state: "EXPIRED" };
}

function learningSessionProjection(mode, vocabularyIds) {
  return {
    id: SESSION_ID, set_id: SET_ID, mode, state: "ACTIVE",
    created_at: "2026-10-04T00:00:00.000Z", expires_at: "2026-10-11T00:00:00.000Z",
    completed_at: null, snapshot_size: vocabularyIds.length, completed_items: 0,
    items: vocabularyIds.map((vocabulary_id, position) => ({ vocabulary_id, position, evidence: null })),
  };
}

function completedSrsProjection(cardCount) {
  return {
    ...learningSessionProjection(
      "SRS",
      Array.from({ length: cardCount }, (_, index) => vocabularyId(index + 1)),
    ),
    state: "COMPLETED",
    completed_at: NOW,
    completed_items: cardCount,
    items: Array.from({ length: cardCount }, (_, index) => ({
      vocabulary_id: vocabularyId(index + 1), position: index, evidence: "SRS_GOOD",
    })),
  };
}

function srsPayload(upToDate = false, longContent = false, cardCount = 4, previews = ratingPreviews(1, 3, 7)) {
  return { id: "10000000-0000-4000-8000-000000000001", name: "Bộ ôn tập", topic: null, mode: "SRS", evaluated_at: NOW, total_items: cardCount, eligible_count: upToDate ? 0 : cardCount, next_review_at: upToDate ? "2026-10-05T00:00:00.000Z" : null, cards: upToDate ? [] : cards(longContent, cardCount, previews) };
}
function normalPayload(longContent = false, cardCount = 4) {
  return { id: "10000000-0000-4000-8000-000000000001", name: "Bộ ôn tập", topic: null, mode: "NORMAL", total_items: cardCount, cards: cards(longContent, cardCount) };
}
function cards(longContent = false, cardCount = 4, previews = null) {
  return Array.from({ length: cardCount }, (_, index) => index + 1).map((number) => ({ id: vocabularyId(number), position: number, word: `word-${number}`, phonetic: `/w${number}/`, pronunciation_url: null, meanings: [{ id: `meaning-${number}`, part_of_speech: "noun", meaning_vi: `nghĩa word-${number}`, context: longContent && number === 1 ? LONG_CONTEXT : null, cefr_level: "A1", examples: [{ id: `example-${number}`, example_en: longContent && number === 1 ? LONG_EXAMPLE : `Example ${number}.`, example_vi: longContent && number === 1 ? LONG_TRANSLATION : null }] }], progress: { status: "NEW", stored_status: null, effective_status: "NEW", stage: 0, interval_days: null, next_review_at: null, review_count: 0, revision: 0, last_reviewed_at: null }, ...(previews ? { rating_previews: previews } : {}) }));
}
function vocabularyId(number) { return `30000000-0000-4000-8000-${String(number).padStart(12, "0")}`; }
function ratingPreviews(hard, good, easy) {
  return {
    AGAIN: { kind: "SESSION_REQUEUE", interval_days: null },
    HARD: { kind: "SCHEDULED", interval_days: hard },
    GOOD: { kind: "SCHEDULED", interval_days: good },
    EASY: { kind: "SCHEDULED", interval_days: easy },
  };
}
function successRating(body) {
  const again = body.rating === "AGAIN";
  return { success: true, data: { vocabulary_id: body.vocabulary_id, status: again ? "LEARNING" : "LEARNED", stored_status: again ? "LEARNING" : "LEARNED", effective_status: again ? "LEARNING" : "LEARNED", stage: again ? 0 : 1, interval_days: again ? null : 1, next_review_at: again ? NOW : "2026-10-05T00:00:00.000Z", last_reviewed_at: NOW, review_count: 1, revision: body.expected_revision + 1, reward: { source_event_id: body.event_id, xp_earned: again ? 0 : 3, replayed: false, total_xp: again ? 0 : 3, level: 1, level_min_xp: 0, next_level_xp: 50, is_max_level: false } } };
}
function failure(code) { return { success: false, error: { code, message: "Changed." } }; }
const NOW = "2026-10-04T00:00:00.000Z";
const LONG_CONTEXT = "A deliberately extended learning context that explains how this vocabulary appears in several realistic situations, preserves the complete approved content, and requires substantially more vertical room than the standard card without becoming an internal scrolling panel.";
const LONG_EXAMPLE = "This deliberately long example demonstrates that unusually detailed learning material can expand the complete shared flashcard while the surrounding page handles any required viewport scrolling. Long example ending marker.";
const LONG_TRANSLATION = "Bản dịch dài được giữ đầy đủ để xác nhận nội dung quan trọng không bị cắt khi mặt sau cần nhiều chiều cao hơn mức tối thiểu thông thường.";

async function seedSettledSession(page) {
  await page.addInitScript(() => {
    sessionStorage.setItem("elvocab.learning.run.v1:user-1:10000000-0000-4000-8000-000000000001", JSON.stringify({
      version: 3,
      user_id: "user-1",
      set_id: "10000000-0000-4000-8000-000000000001",
      active_mode: "SRS",
      srs: {
        snapshot_at: "2026-10-01T00:00:00.000Z",
        initial_ids: ["word-1", "word-2", "word-3", "word-4"],
        queue: [],
        passed_ids: ["word-1", "word-2", "word-3", "word-4"],
        presentation_count: 4,
        retry_context: null,
        status: "COMPLETED",
      },
      normal_initialized: false,
      normal: {
        snapshot_ids: [], batches: [], active_batch_index: null,
        current_vocabulary_id: null, batch_status: "COMPLETED", run_status: "COMPLETED",
      },
    }));
    sessionStorage.setItem("elvocab.backend-learning-session:v2:user-1:10000000-0000-4000-8000-000000000001:SRS_FLASHCARD", JSON.stringify({
      version: 2,
      user_id: "user-1",
      set_id: "10000000-0000-4000-8000-000000000001",
      mode: "SRS",
      session_id: "20000000-0000-4000-8000-000000000001",
      creation_operation_id: "70000000-0000-4000-8000-000000000001",
      expires_at: "2026-10-11T00:00:00.000Z",
      cursor_vocabulary_id: "30000000-0000-4000-8000-000000000001",
      view_state: "COMPLETED",
    }));
  });
}
