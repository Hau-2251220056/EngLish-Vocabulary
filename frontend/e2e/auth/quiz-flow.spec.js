import { expect, test } from "@playwright/test";
import { answerResult, failure, ids, installQuizApiMock, publicAdmin, question, questionPayload, success } from "./fixtures/quiz-api.js";

test.describe("Multiple Choice Quiz mocked flow", () => {
  test("starts directly, completes ordered questions and writes no Learning event", async ({ page }) => {
    const calls = await installQuizApiMock(page);
    await page.goto("/quiz/vocabulary-sets/set-flow");
    await expect(page.getByRole("heading", { name: "wake" })).toBeVisible();
    await expect(page.getByRole("radio")).toHaveCount(4);
    await page.getByRole("radio", { name: /thức dậy/ }).check();
    await page.getByRole("button", { name: "Kiểm tra đáp án" }).click();
    await expect(page.getByRole("heading", { name: "Chính xác" })).toBeVisible();
    await page.getByRole("button", { name: "Câu tiếp theo" }).click();
    await expect(page.getByRole("heading", { name: "sleep" })).toBeVisible();
    await page.getByRole("radio", { name: /ăn/ }).check();
    await page.getByRole("button", { name: "Kiểm tra đáp án" }).click();
    await expect(page.locator('[data-answer-state="correct"]')).toHaveCount(1);
    await expect(page.locator('[data-answer-state="incorrect-selected"]')).toHaveCount(1);
    await expect(page.getByText("Đáp án đúng", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Đáp án sai", { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Xem kết quả" }).click();
    await expect(page.getByRole("heading", { name: "Hoàn thành Quiz" })).toBeVisible();
    expect(calls.questions.every(({ quizType }) => quizType === "MULTIPLE_CHOICE")).toBe(true);
    expect(calls.answers.map(({ selected_choice_id }) => selected_choice_id)).toEqual([ids[0], ids[1]]);
    expect(calls.learningEvents).toHaveLength(0);
  });

  test("pending blocks duplicates and operational retry reuses identical body", async ({ page }) => {
    let resolve; const pending = new Promise((done) => { resolve = done; });
    const calls = await installQuizApiMock(page, { onAnswer: ({ body, call }) => call === 1 ? pending : success(answerResult(body)) });
    await page.goto("/quiz/vocabulary-sets/set-flow");
    await page.getByRole("radio").first().check(); await page.getByRole("button", { name: "Kiểm tra đáp án" }).click();
    await expect(page.getByRole("button", { name: "Đang kiểm tra…" })).toBeDisabled();
    expect(calls.answers).toHaveLength(1); resolve({ abort: "failed" });
    await expect(page.getByRole("button", { name: "Thử gửi lại" })).toBeVisible();
    await expect(page.getByRole("alert").filter({ hasText: /\+\d+ XP/ })).toHaveCount(0);
    await page.getByRole("button", { name: "Thử gửi lại" }).click();
    await expect(page.getByRole("heading", { name: "Chính xác" })).toBeVisible();
    await expect(page.getByRole("alert").filter({ hasText: "Bạn vừa nhận +3 XP!" })).toHaveCount(1);
    expect(calls.answers[1]).toEqual(calls.answers[0]);
  });

test("new Quiz XP uses one Toast without surviving reload or duplicating inline feedback", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await installQuizApiMock(page);
    await page.goto("/quiz/vocabulary-sets/set-flow");
    await page.getByRole("radio").first().check();
    await page.getByRole("button", { name: "Kiểm tra đáp án" }).press("Enter");

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
    await page.screenshot({
      fullPage: true,
      path: "test-results/task-230-evidence/quiz-positive-xp-mobile.png",
    });
    await expect(page.getByTestId("quiz-xp-feedback")).toHaveCount(0);
    await expect(page.getByRole("status")).not.toContainText(/\+\d+ XP/);
    const stored = await page.evaluate(() => Object.entries(sessionStorage)
      .filter(([key]) => key.startsWith("elvocab.quiz.run.v2:"))
      .map(([, value]) => value).join(""));
    expect(stored).not.toContain("reward");
    expect(stored).not.toContain("xp_earned");
    await page.reload();
    await expect(page.getByRole("heading", { name: "sleep" })).toBeVisible();
    await expect(page.getByTestId("quiz-xp-feedback")).toHaveCount(0);
    await expect(page.getByRole("alert").filter({ hasText: /\+\d+ XP/ })).toHaveCount(0);
    await expect(page.getByRole("status")).toHaveCount(0);
  });

  test("zero and replayed Quiz responses keep reward feedback silent", async ({ browser }) => {
    for (const responseKind of ["zero", "replay"]) {
      const context = await browser.newContext();
      const page = await context.newPage();
      await installQuizApiMock(page, {
        async onAnswer({ body }) {
          const response = answerResult(body, { is_correct: responseKind === "replay" });
          if (responseKind === "replay") response.reward.replayed = true;
          return success(response);
        },
      });
      await page.goto("/quiz/vocabulary-sets/set-flow");
      await page.getByRole("radio").first().check();
      await page.getByRole("button", { name: "Kiểm tra đáp án" }).click();
      await expect(page.getByTestId("quiz-xp-feedback")).toHaveCount(0);
      await expect(page.getByRole("alert").filter({ hasText: /\+\d+ XP/ })).toHaveCount(0);
      await expect(page.getByRole("status")).not.toContainText(/\+\d+ XP/);
      await context.close();
    }
  });

  test("one-shot stale question recovery deliberately retries once", async ({ page }) => {
    const calls = await installQuizApiMock(page, { onQuestions: ({ call, runId }) => call === 1 ? failure(409, "QUIZ_CHOICES_UNAVAILABLE") : success(questionPayload(runId)) });
    await page.goto("/quiz/vocabulary-sets/set-flow");
    await expect(page.getByRole("heading", { name: "wake" })).toBeVisible();
    expect(calls.questions).toHaveLength(2);
  });

  test("restart confirms partial progress, starts a fresh run, and is direct after completion", async ({ page }) => {
    const calls = await installQuizApiMock(page, { questions: [question("word-wake", 1, "wake", "thức dậy")] });
    await page.goto("/quiz/vocabulary-sets/set-flow");
    await page.getByRole("radio", { name: /thức dậy/ }).check();
    await page.getByRole("button", { name: "Học lại từ đầu" }).click();
    const dialog = page.getByRole("dialog", { name: "Học lại từ đầu?" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Hủy" }).click();
    await expect(dialog).toBeHidden();

    await page.getByRole("button", { name: "Học lại từ đầu" }).click();
    await dialog.getByRole("button", { name: "Học lại từ đầu" }).click();
    await expect.poll(() => calls.questions.length).toBe(2);
    expect(calls.questions[1].runId).not.toBe(calls.questions[0].runId);

    await page.getByRole("radio", { name: /thức dậy/ }).check();
    await page.getByRole("button", { name: "Kiểm tra đáp án" }).click();
    await page.getByRole("button", { name: "Xem kết quả" }).click();
    await expect(page.getByRole("heading", { name: "Hoàn thành Quiz" })).toBeVisible();
    await page.getByRole("button", { name: "Học lại từ đầu" }).click();
    await expect(dialog).toBeHidden();
    await expect.poll(() => calls.questions.length).toBe(3);
    expect(calls.questions[2].runId).not.toBe(calls.questions[1].runId);
  });

  test("responsive long choices have safe targets, cursors and no page overflow", async ({ page }) => {
    const long = "Một nghĩa tiếng Việt rất dài để xác minh nội dung tự xuống dòng an toàn mà không bị cắt hoặc làm tràn ngang toàn bộ trang";
    await installQuizApiMock(page, { questions: [question("long", 1, "an-extraordinarily-long-english-expression-that-wraps", long)] });
    for (const viewport of [{ width: 320, height: 700 }, { width: 375, height: 812 }, { width: 844, height: 390 }, { width: 1024, height: 768 }, { width: 1440, height: 900 }]) {
      await page.setViewportSize(viewport); await page.goto("/quiz/vocabulary-sets/set-flow");
      const radios = page.getByRole("radio"); await expect(radios).toHaveCount(4);
      const radio = radios.first(); const label = radio.locator("xpath=..");
      const boxes = await radios.evaluateAll((nodes) => nodes.map((node) => { const box = node.parentElement.getBoundingClientRect(); return { left: box.left, right: box.right, top: box.top, bottom: box.bottom }; }));
      expect((await label.boundingBox()).height).toBeGreaterThanOrEqual(44);
      expect(boxes).toHaveLength(4);
      expect(new Set(boxes.map(({ left }) => Math.round(left))).size).toBe(1);
      expect(boxes.every((box, index) => index === 0 || box.top >= boxes[index - 1].bottom)).toBe(true);
      expect((await page.getByTestId("quiz-panel").boundingBox()).width).toBeLessThanOrEqual(680);
      await expect(label).toHaveCSS("cursor", "pointer");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  });

  test("progress animation follows the reduced-motion preference", async ({ page }) => {
    await installQuizApiMock(page);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/quiz/vocabulary-sets/set-flow");
    const progressFill = page.getByRole("progressbar").locator("span");
    expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(false);
    await expect(progressFill).toHaveCSS("transition-property", "width");

    await page.emulateMedia({ reducedMotion: "reduce" });
    expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
    await expect(progressFill).toHaveCSS("transition-property", "none");
  });

  test("Guest and ADMIN cannot enter USER Quiz", async ({ browser }) => {
    for (const options of [{ guest: true }, { user: publicAdmin }]) { const context = await browser.newContext(); const page = await context.newPage(); const calls = await installQuizApiMock(page, options); await page.goto("/quiz/vocabulary-sets/set-flow"); await expect(page).toHaveURL(options.guest ? /\/login$/ : /\/dashboard$/); expect(calls.questions).toHaveLength(0); await context.close(); }
  });
});
