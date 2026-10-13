import { expect, test } from "@playwright/test";
import { installAuthApiMock, publicUser, responses } from "./fixtures/auth-api.js";

test("initial authorized load preserves user-owned focus", async ({ page }) => {
  let releaseLearning;
  await installSpeakingMocks(page, {
    waitForLearning: () => new Promise((resolve) => { releaseLearning = resolve; }),
  });
  await page.goto("/pronunciation/vocabulary-sets/set-focus");
  await expect(page.getByRole("status")).toContainText("Đang chuẩn bị luyện nói");
  await page.evaluate(() => {
    const control = document.createElement("button");
    control.dataset.externalFocus = "true";
    control.textContent = "External focus owner";
    document.body.append(control);
    control.focus();
  });

  releaseLearning();
  await expect(page.getByRole("heading", { name: "book" })).toBeVisible();
  await expect(page.locator("[data-external-focus]" )).toBeFocused();
});

for (const terminal of [
  { name: "successful result", transcript: "book", heading: "Đã nhận diện từ mục tiêu", liveRole: "status" },
  { name: "non-match result", transcript: "cat", heading: "Chưa nhận diện khớp", liveRole: "status" },
  { name: "inconclusive result", error: "no-speech", heading: "Chưa thể xác định kết quả", liveRole: "status" },
  { name: "recoverable error", error: "bad-grammar", heading: "Chưa thể nhận diện lúc này", liveRole: "alert" },
]) {
  test(`keyboard recognition focuses ${terminal.name}`, async ({ page }) => {
    await installSpeakingMocks(page);
    await page.goto("/pronunciation/vocabulary-sets/set-focus");
    await beginRecognitionWithKeyboard(page);

    if (terminal.error) await emitRecognitionError(page, terminal.error);
    else await emitRecognitionResult(page, terminal.transcript);

    const heading = page.getByRole("heading", { name: terminal.heading });
    await expect(heading).toBeFocused();
    await expect(heading).toHaveAttribute("tabindex", "-1");
    await expect(page.locator(`.sr-only[role=${terminal.liveRole}]`)).toHaveCount(0);
  });
}

test("keyboard Retry restores target focus and a later result can receive focus again", async ({ page }) => {
  await installSpeakingMocks(page);
  await page.goto("/pronunciation/vocabulary-sets/set-focus");
  await beginRecognitionWithKeyboard(page);
  await emitRecognitionResult(page, "book");
  await expect(page.getByRole("heading", { name: "Đã nhận diện từ mục tiêu" })).toBeFocused();

  await page.getByRole("button", { name: "Thử nói lại" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "book" })).toBeFocused();
  await expect(page.getByRole("button", { name: "Dừng nói" })).toBeVisible();

  await emitRecognitionResult(page, "cat");
  await expect(page.getByRole("heading", { name: "Chưa nhận diện khớp" })).toBeFocused();
});

test("target navigation, completion and Restart keep deliberate focus destinations", async ({ page }) => {
  await installSpeakingMocks(page);
  await page.goto("/pronunciation/vocabulary-sets/set-focus");
  await expect(page.getByRole("heading", { name: "book" })).not.toBeFocused();

  await page.getByRole("button", { name: "Từ tiếp theo" }).press("Enter");
  await expect(page.getByRole("heading", { name: "travel" })).toBeFocused();
  await page.getByRole("button", { name: "Từ tiếp theo" }).press("Enter");
  await expect(page.getByRole("heading", { name: "Đã đi hết bộ từ" })).toBeFocused();

  await page.getByRole("button", { name: "Luyện lại từ đầu" }).press("Enter");
  await expect(page.getByRole("heading", { name: "book" })).toBeFocused();
});

test("terminal updates do not steal focus from an unrelated learner-owned control", async ({ page }) => {
  await installSpeakingMocks(page);
  await page.goto("/pronunciation/vocabulary-sets/set-focus");
  await beginRecognitionWithKeyboard(page);
  const exit = page.getByRole("button", { name: "Focus Set" });
  await exit.focus();

  await emitRecognitionResult(page, "book");
  await expect(exit).toBeFocused();
  await expect(page.locator(".sr-only[role=status]")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Đã nhận diện từ mục tiêu" })).not.toBeFocused();

  await page.evaluate(() => window.__speakingRecognitions.at(-1).onend?.());
  await expect(exit).toBeFocused();

  await page.reload();
  await expect(page.getByRole("heading", { name: "book" })).toBeVisible();
  await page.getByRole("button", { name: "Nói" }).click();
  await page.getByRole("button", { name: "Tiếp tục" }).click();
  await emitRecognitionResult(page, "book");
  await expect(page.getByRole("heading", { name: "Đã nhận diện từ mục tiêu" })).not.toBeFocused();
  await expect(page.locator(".sr-only[role=status]")).toHaveCount(1);
});

async function beginRecognitionWithKeyboard(page) {
  await expect(page.getByRole("heading", { name: "book" })).toBeVisible();
  const speak = page.getByRole("button", { name: "Nói" });
  await speak.focus();
  await page.keyboard.press("Enter");
  const confirm = page.getByRole("button", { name: "Tiếp tục" });
  await confirm.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Dừng nói" })).toBeVisible();
}

async function emitRecognitionResult(page, transcript) {
  await page.evaluate((value) => {
    const result = [{ transcript: value, confidence: 1 }];
    result.isFinal = true;
    window.__speakingRecognitions.at(-1).onresult?.({ resultIndex: 0, results: [result] });
  }, transcript);
}

async function emitRecognitionError(page, error) {
  await page.evaluate((value) => {
    window.__speakingRecognitions.at(-1).onerror?.({ error: value });
  }, error);
}

async function installSpeakingMocks(page, { waitForLearning = null } = {}) {
  await page.addInitScript(() => {
    window.__speakingRecognitions = [];
    class FakeSpeechRecognition {
      constructor() { window.__speakingRecognitions.push(this); }
      start() { this.onstart?.(); }
      stop() {}
      abort() { this.onend?.(); }
    }
    window.SpeechRecognition = FakeSpeechRecognition;
  });
  await installAuthApiMock(page, {
    "/api/auth/me": responses.currentUser(publicUser),
  });
  await page.route("**/api/learning/sets/set-focus**", async (route) => {
    if (waitForLearning) await waitForLearning();
    await route.fulfill({
      status: 200,
      json: {
        success: true,
        data: {
          id: "set-focus",
          name: "Focus Set",
          mode: "NORMAL",
          total_items: 2,
          cards: [learningCard("vocabulary-book", "book", 1), learningCard("vocabulary-travel", "travel", 2)],
        },
      },
    });
  });
}

function learningCard(id, word, position) {
  return {
    id,
    word,
    position,
    phonetic: null,
    pronunciation_url: null,
    meanings: [],
    progress: {
      effective_status: "NEW",
      stage: 0,
      interval_days: null,
      next_review_at: null,
      review_count: 0,
      revision: 0,
    },
  };
}
