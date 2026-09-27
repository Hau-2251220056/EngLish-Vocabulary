import { expect, test } from "@playwright/test";
import { answerResult, failure, installQuizApiMock, publicAdmin, questionPayload, success, viQuestion } from "./fixtures/quiz-api.js";

test.describe("Quiz V1 mocked browser flow", () => {
  test("VI_TO_ENGLISH completes ordered questions and restart creates a new run", async ({ page }) => {
    const calls = await installQuizApiMock(page);
    await page.goto("/quiz/vocabulary-sets/set-flow");
    await selectType(page, "Tiếng Việt → Tiếng Anh");

    await expect(page.getByRole("heading", { name: "quyển sách" })).toBeVisible();
    await submitText(page, "book");
    await expect(page.getByRole("heading", { name: "Chính xác" })).toBeVisible();
    await page.getByRole("button", { name: "Câu tiếp theo" }).click();
    await expect(page.getByRole("heading", { name: "du lịch" })).toBeVisible();
    await submitText(page, "wrong");
    await page.getByRole("button", { name: "Xem kết quả" }).click();

    await expect(page.getByRole("heading", { name: "Hoàn thành Quiz" })).toBeVisible();
    await expect(page.getByText("2", { exact: true })).toHaveCount(1);
    await expect(page.getByText("1", { exact: true })).toHaveCount(2);
    const firstRun = calls.questions[0].runId;
    await page.getByRole("button", { name: "Làm lại Quiz" }).click();
    await expect(page.getByRole("heading", { name: "quyển sách" })).toBeVisible();
    expect(calls.questions.at(-1).runId).not.toBe(firstRun);
    expect(calls.answers.map(({ vocabulary_id }) => vocabulary_id)).toEqual(["word-book", "word-travel"]);
  });

  test("UNSCRAMBLE_WORD respects supplied tiles, duplicate identities, separators, keyboard use and identity fallback", async ({ page }) => {
    const calls = await installQuizApiMock(page);
    await page.goto("/quiz/vocabulary-sets/set-flow");
    await selectType(page, "Sắp xếp từ tiếng Anh");

    const pool = page.getByRole("group", { name: "Các ký tự có thể chọn" });
    await expect(pool.getByRole("button")).toHaveText(["o", "b", "k", "o"]);
    await pool.getByRole("button", { name: /Chọn ký tự b/ }).press("Enter");
    const oTiles = pool.getByRole("button", { name: /Chọn ký tự o/ });
    await oTiles.first().press("Enter");
    await page.getByRole("button", { name: /Bỏ ký tự o khỏi vị trí 2/ }).press("Enter");
    await expect(pool.getByRole("button")).toHaveText(["o", "k", "o"]);

    await pool.getByRole("button", { name: /Chọn ký tự o/ }).first().press("Enter");
    await pool.getByRole("button", { name: /Chọn ký tự o/ }).first().press("Enter");
    await pool.getByRole("button", { name: /Chọn ký tự k/ }).press("Enter");
    await expect(page.getByLabel("Ký tự cố định -")).toBeVisible();
    await page.getByRole("button", { name: "Kiểm tra đáp án" }).press("Enter");
    expect(calls.answers[0].answer).toBe("bo-ok");
    await page.getByRole("button", { name: "Câu tiếp theo" }).click();

    await expect(page.getByText(/không thể đảo thành một thứ tự khác/)).toBeVisible();
    await page.getByRole("button", { name: /Chọn ký tự a/ }).press("Enter");
    await page.getByRole("button", { name: "Kiểm tra đáp án" }).press("Enter");
    expect(calls.answers[1].answer).toBe("a");
  });

  test("UI and browser Back preserve the Set -> selection -> active hierarchy without mutations", async ({ page }) => {
    const calls = await installQuizApiMock(page);
    await page.goto("/quiz/vocabulary-sets/set-flow");
    await selectType(page, "Tiếng Việt → Tiếng Anh");
    await page.getByRole("button", { name: "Quay lại" }).first().click();
    await expect(page.getByRole("heading", { name: "Chọn loại Quiz" })).toBeVisible();
    await selectType(page, "Sắp xếp từ tiếng Anh");
    await page.goBack();
    await expect(page.getByRole("heading", { name: "Chọn loại Quiz" })).toBeVisible();
    await page.getByRole("button", { name: "Quay lại" }).click();
    await expect(page).toHaveURL(/\/my\/vocabulary-sets$/);
    expect(calls.answers).toHaveLength(0);
    expect(calls.learningEvents).toHaveLength(0);
  });

  test("deep-linked active Quiz falls back safely to type selection", async ({ page }) => {
    await installQuizApiMock(page);
    await page.goto("/quiz/vocabulary-sets/set-flow?type=VI_TO_ENGLISH");
    await page.getByRole("button", { name: "Quay lại" }).first().click();
    await expect(page).toHaveURL(/\/quiz\/vocabulary-sets\/set-flow$/);
    await expect(page.getByRole("heading", { name: "Chọn loại Quiz" })).toBeVisible();
  });

  test("reload restores accepted transient progress without persisting answers or history", async ({ page }) => {
    const calls = await installQuizApiMock(page);
    await page.goto("/quiz/vocabulary-sets/set-flow?type=VI_TO_ENGLISH");
    await submitText(page, "book");
    await page.getByRole("button", { name: "Câu tiếp theo" }).click();
    await page.reload();
    await expect(page.getByRole("heading", { name: "du lịch" })).toBeVisible();
    const quizStorage = await page.evaluate(() => Object.entries(sessionStorage).filter(([key]) => key.startsWith("elvocab.quiz.")));
    const serialized = JSON.stringify(quizStorage);
    expect(serialized).not.toContain("correct_answer");
    expect(serialized).not.toContain("character_feedback");
    expect(serialized).not.toContain("pending_attempt\":{\"");
    expect(calls.answers).toHaveLength(1);
  });

  test("loading, operational error retry and empty Set reach explicit terminal states", async ({ page }) => {
    let resolveFirst;
    const first = new Promise((resolve) => { resolveFirst = resolve; });
    await installQuizApiMock(page, {
      onQuestions: async ({ call, quizType, runId }) => call === 1 ? first : success(questionPayload(quizType, runId)),
    });
    await page.goto("/quiz/vocabulary-sets/set-flow?type=VI_TO_ENGLISH");
    await expect(page.getByRole("status")).toContainText("Đang chuẩn bị Quiz");
    resolveFirst(failure(500, "QUIZ_REQUEST_FAILED"));
    await expect(page.getByRole("alert")).toContainText("Không thể tải Quiz");
    await page.getByRole("button", { name: "Thử lại" }).click();
    await expect(page.getByRole("heading", { name: "quyển sách" })).toBeVisible();

    await page.unrouteAll({ behavior: "wait" });
    await installQuizApiMock(page, { onQuestions: () => failure(409, "QUIZ_SET_EMPTY") });
    await page.goto("/quiz/vocabulary-sets/empty?type=VI_TO_ENGLISH");
    await expect(page.getByRole("heading", { name: "Bộ từ chưa sẵn sàng" })).toBeVisible();
  });

  test("pending blocks duplicate submit and uncertain retry reuses the identical body", async ({ page }) => {
    let resolveAnswer;
    const pendingAnswer = new Promise((resolve) => { resolveAnswer = resolve; });
    const calls = await installQuizApiMock(page, {
      onAnswer: async ({ body, call }) => call === 1 ? pendingAnswer : success(answerResult(body)),
    });
    await page.goto("/quiz/vocabulary-sets/set-flow?type=VI_TO_ENGLISH");
    await page.getByLabel("Câu trả lời bằng tiếng Anh").fill("book");
    await page.getByRole("button", { name: "Kiểm tra đáp án" }).click();
    await expect(page.getByRole("button", { name: "Đang kiểm tra…" })).toBeDisabled();
    await page.getByRole("button", { name: "Đang kiểm tra…" }).click({ force: true });
    expect(calls.answers).toHaveLength(1);
    resolveAnswer({ abort: "failed" });
    await expect(page.getByRole("alert")).toContainText("Chưa thể xác nhận");
    await page.getByRole("button", { name: "Thử gửi lại" }).click();
    await expect(page.getByRole("heading", { name: "Chính xác" })).toBeVisible();
    expect(calls.answers).toHaveLength(2);
    expect(calls.answers[1]).toEqual(calls.answers[0]);
  });

  test("question conflict offers authoritative refresh instead of accepting stale feedback", async ({ page }) => {
    const calls = await installQuizApiMock(page, {
      onAnswer: () => failure(409, "QUIZ_QUESTION_CHANGED"),
    });
    await page.goto("/quiz/vocabulary-sets/set-flow?type=VI_TO_ENGLISH");
    await submitText(page, "book");
    await expect(page.getByRole("alert")).toContainText("Nội dung câu hỏi đã thay đổi");
    await page.getByRole("button", { name: "Làm mới Quiz" }).click();
    await expect(page.getByRole("heading", { name: "quyển sách" })).toBeVisible();
    expect(calls.questions.length).toBeGreaterThan(1);
  });

  test("feedback DOM exposes all states, canonical answer and accepted separator equivalence", async ({ page }) => {
    await installQuizApiMock(page, {
      onAnswer: ({ body }) => success(answerResult(body, {
        is_correct: false,
        correct_answer: "book-case",
        character_feedback: [
          { position: 0, submitted: "b", expected: "b", state: "correct" },
          { position: 1, submitted: "x", expected: "o", state: "incorrect" },
          { position: 2, submitted: null, expected: "o", state: "missing" },
          { position: 3, submitted: "z", expected: null, state: "extra" },
          { position: 4, submitted: " ", expected: "-", state: "correct" },
        ],
      })),
    });
    await page.goto("/quiz/vocabulary-sets/set-flow?type=VI_TO_ENGLISH");
    await submitText(page, "bxz case");
    await expect(page.getByText("book-case", { exact: true })).toBeVisible();
    for (const label of [/Ký tự 1: b, đúng/, /Ký tự 2: x, đáp án là o/, /Ký tự 3: thiếu o/, /Ký tự 4: z là ký tự thừa/, /dấu cách được chấp nhận thay cho dấu gạch nối/]) {
      await expect(page.getByLabel(label)).toBeVisible();
    }
    await expect(page.getByLabel(/Ký tự 3: thiếu o/)).toHaveText("_");
  });

  test("Guest and ADMIN cannot enter the USER-only Quiz flow", async ({ browser }) => {
    for (const access of ["guest", "admin"]) {
      const context = await browser.newContext();
      const page = await context.newPage();
      const calls = await installQuizApiMock(page, access === "guest" ? { guest: true } : { user: publicAdmin });
      await page.goto("/quiz/vocabulary-sets/set-flow?type=VI_TO_ENGLISH");
      await expect(page).toHaveURL(access === "guest" ? /\/login$/ : /\/dashboard$/);
      expect(calls.questions).toHaveLength(0);
      expect(calls.answers).toHaveLength(0);
      await context.close();
    }
  });
});

for (const viewport of [
  { name: "desktop", width: 1366, height: 768 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 375, height: 812 },
]) {
  test(`Quiz runtime contains long content and touch targets on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce" });
    const longMeaning = "Một nghĩa tiếng Việt rất dài dùng để xác minh nội dung Quiz tự xuống dòng an toàn trong vùng làm bài mà không tạo tràn ngang ngoài trang";
    await installQuizApiMock(page, {
      questions: [viQuestion("word-long", 1, "C".repeat(43), longMeaning, { context: `${longMeaning} ${longMeaning}` })],
    });
    await page.goto("/quiz/vocabulary-sets/set-flow?type=VI_TO_ENGLISH");
    await expect(page.getByRole("heading", { name: longMeaning })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);
    const submitBox = await page.getByRole("button", { name: "Kiểm tra đáp án" }).boundingBox();
    expect(submitBox.height).toBeGreaterThanOrEqual(44);
    await expect(page.locator(".quiz-progress-track > span")).toHaveCSS("transition-duration", "0s");
  });
}

async function selectType(page, label) {
  await page.getByRole("radio", { name: label }).check();
  await page.getByRole("button", { name: "Bắt đầu Quiz" }).click();
}

async function submitText(page, answer) {
  await page.getByLabel("Câu trả lời bằng tiếng Anh").fill(answer);
  await page.getByRole("button", { name: "Kiểm tra đáp án" }).click();
}
