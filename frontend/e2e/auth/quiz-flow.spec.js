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
    await page.getByRole("button", { name: "Thử gửi lại" }).click();
    await expect(page.getByRole("heading", { name: "Chính xác" })).toBeVisible();
    expect(calls.answers[1]).toEqual(calls.answers[0]);
  });

  test("unavailable choices and changed choice are actionable", async ({ page }) => {
    await installQuizApiMock(page, { onQuestions: ({ call, runId }) => call === 1 ? failure(409, "QUIZ_CHOICES_UNAVAILABLE") : success(questionPayload(runId)) });
    await page.goto("/quiz/vocabulary-sets/set-flow");
    await expect(page.getByRole("heading", { name: "Chưa đủ lựa chọn" })).toBeVisible();
    await page.getByRole("button", { name: "Thử lại" }).click();
    await expect(page.getByRole("heading", { name: "wake" })).toBeVisible();
  });

  test("restart confirms partial progress, starts a fresh run, and is direct after completion", async ({ page }) => {
    const calls = await installQuizApiMock(page, { questions: [question("word-wake", 1, "wake", "thức dậy")] });
    await page.goto("/quiz/vocabulary-sets/set-flow");
    await page.getByRole("radio", { name: /thức dậy/ }).check();
    await page.getByRole("button", { name: "Bắt đầu lại" }).click();
    const dialog = page.getByRole("dialog", { name: "Bắt đầu lại Quiz?" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Hủy" }).click();
    await expect(dialog).toBeHidden();

    await page.getByRole("button", { name: "Bắt đầu lại" }).click();
    await dialog.getByRole("button", { name: "Bắt đầu lại" }).click();
    await expect.poll(() => calls.questions.length).toBe(2);
    expect(calls.questions[1].runId).not.toBe(calls.questions[0].runId);

    await page.getByRole("radio", { name: /thức dậy/ }).check();
    await page.getByRole("button", { name: "Kiểm tra đáp án" }).click();
    await page.getByRole("button", { name: "Xem kết quả" }).click();
    await expect(page.getByRole("heading", { name: "Hoàn thành Quiz" })).toBeVisible();
    await page.getByRole("button", { name: "Bắt đầu lại" }).click();
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

  test("Guest and ADMIN cannot enter USER Quiz", async ({ browser }) => {
    for (const options of [{ guest: true }, { user: publicAdmin }]) { const context = await browser.newContext(); const page = await context.newPage(); const calls = await installQuizApiMock(page, options); await page.goto("/quiz/vocabulary-sets/set-flow"); await expect(page).toHaveURL(options.guest ? /\/login$/ : /\/dashboard$/); expect(calls.questions).toHaveLength(0); await context.close(); }
  });
});
