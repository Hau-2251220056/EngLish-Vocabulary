import { expect, test } from "@playwright/test";
import { installAuthApiMock, publicUser, responses } from "./fixtures/auth-api.js";

test("pointer submission announces a correct result without moving focus", async ({ page }) => {
  await installQuizMocks(page, { correct: true });
  await page.goto("/quiz/vocabulary-sets/set-focus?type=VI_TO_ENGLISH");

  await page.getByLabel("Câu trả lời bằng tiếng Anh").fill("book");
  await page.getByRole("button", { name: "Kiểm tra đáp án" }).click();

  const heading = page.getByRole("heading", { name: "Chính xác" });
  const next = page.getByRole("button", { name: "Xem kết quả" });
  await expect(heading).toBeVisible();
  await expect(heading).not.toBeFocused();
  await expect(heading).toHaveCSS("outline-style", "none");
  await expect(next).not.toBeFocused();
  const status = page.getByRole("status").filter({ hasText: "Chính xác. Bạn đã trả lời đúng." });
  await expect(status).toHaveAttribute("aria-live", "polite");
  await expect(status).toHaveAttribute("aria-atomic", "true");
  await expect(status).not.toContainText("Đáp án đúng");
  await expect(status).not.toContainText("Chi tiết ký tự");
});

test("keyboard Enter focuses the incorrect result and Tab reaches the next action", async ({ page }) => {
  await installQuizMocks(page, { correct: false });
  await page.goto("/quiz/vocabulary-sets/set-focus?type=VI_TO_ENGLISH");

  const input = page.getByLabel("Câu trả lời bằng tiếng Anh");
  await input.fill("bok");
  await input.press("Enter");

  const heading = page.getByRole("heading", { name: "Chưa chính xác" });
  await expect(heading).toBeFocused();
  await expect(heading).toHaveAttribute("tabindex", "-1");
  await expect(heading).toHaveCSS("outline-style", "none");
  await expect(page.locator(".quiz-feedback.is-incorrect")).toHaveCSS("color", "rgb(169, 38, 58)");
  const status = page.getByRole("status").filter({
    hasText: "Chưa chính xác. Hãy xem lại đáp án trước khi tiếp tục.",
  });
  await expect(status).toHaveAttribute("aria-live", "polite");
  await expect(status).toHaveAttribute("aria-atomic", "true");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Xem kết quả" })).toBeFocused();
});

test("keyboard Space activation focuses the accepted result without pointer misclassification", async ({ page }) => {
  await installQuizMocks(page, { correct: true });
  await page.goto("/quiz/vocabulary-sets/set-focus?type=VI_TO_ENGLISH");

  await page.getByLabel("Câu trả lời bằng tiếng Anh").fill("book");
  const submit = page.getByRole("button", { name: "Kiểm tra đáp án" });
  await submit.focus();
  await page.keyboard.press("Space");

  await expect(page.getByRole("heading", { name: "Chính xác" })).toBeFocused();
});

async function installQuizMocks(page, { correct }) {
  await installAuthApiMock(page, {
    "/api/auth/me": responses.currentUser(publicUser),
  });
  await page.route("**/api/quiz/sets/*/questions**", (route) =>
    route.fulfill({
      status: 200,
      json: {
        success: true,
        data: {
          id: "set-focus",
          name: "Focus review set",
          quiz_type: "VI_TO_ENGLISH",
          run_id: new URL(route.request().url()).searchParams.get("run_id"),
          questions: [{
            vocabulary_id: "vocabulary-focus",
            position: 1,
            question_revision: "question-revision-focus",
            prompt: {
              meaning_vi: "quyển sách",
              context: null,
              part_of_speech: "noun",
              cefr_level: "A1",
            },
            progress: {
              status: "NEW",
              review_count: 0,
              revision: 0,
              last_reviewed_at: null,
            },
          }],
        },
      },
    }),
  );
  await page.route("**/api/quiz/answers", async (route) => {
    const request = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      json: {
        success: true,
        data: {
          set_id: request.set_id,
          vocabulary_id: request.vocabulary_id,
          run_id: request.run_id,
          quiz_type: request.quiz_type,
          is_correct: correct,
          correct_answer: "book",
          normalized_answer: request.answer,
          character_feedback: correct
            ? [
                { position: 0, submitted: "b", expected: "b", state: "correct" },
                { position: 1, submitted: "o", expected: "o", state: "correct" },
                { position: 2, submitted: "o", expected: "o", state: "correct" },
                { position: 3, submitted: "k", expected: "k", state: "correct" },
              ]
            : [
                { position: 0, submitted: "b", expected: "b", state: "correct" },
                { position: 1, submitted: "o", expected: "o", state: "correct" },
                { position: 2, submitted: null, expected: "o", state: "missing" },
                { position: 3, submitted: "k", expected: "k", state: "correct" },
              ],
          progress: {
            status: correct ? "LEARNED" : "LEARNING",
            review_count: 1,
            revision: 1,
            last_reviewed_at: "2026-09-27T00:00:00.000Z",
          },
        },
      },
    });
  });
}
