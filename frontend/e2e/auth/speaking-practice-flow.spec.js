import { expect, test } from "@playwright/test";
import { installAuthApiMock, publicAdmin, publicUser, responses } from "./fixtures/auth-api.js";

const setId = "set-speaking-browser";

for (const viewport of [
  { name: "mobile-320", width: 320, height: 720, direction: "column" },
  { name: "mobile-375", width: 375, height: 812, direction: "column" },
  { name: "mobile-390", width: 390, height: 844, direction: "column" },
  { name: "desktop-1024", width: 1024, height: 768, direction: "row" },
]) {
  test(`practice actions keep a stable ${viewport.name} layout`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await installSpeakingBrowserMocks(page);
    await page.goto(`/pronunciation/vocabulary-sets/${setId}`);

    const actions = page.getByTestId("speaking-actions");
    const listen = page.getByRole("button", { name: "Nghe từ mẫu" });
    const speak = page.getByRole("button", { name: "Nói", exact: true });
    await expect(actions).toHaveCSS("flex-direction", viewport.direction);
    await expect(listen).toBeVisible();
    await expect(speak).toBeVisible();
    if (viewport.direction === "column") {
      await expect(listen.locator("span")).toBeHidden();
      await expect(speak.locator("span")).toBeHidden();
    } else {
      await expect(listen.locator("span")).toBeVisible();
      await expect(speak.locator("span")).toBeVisible();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

    const readyBoxes = await Promise.all([listen.boundingBox(), speak.boundingBox()]);
    expect(readyBoxes.every((box) => box && box.width >= 44 && box.height >= 44)).toBe(true);
    if (viewport.direction === "column") expect(readyBoxes[0].y).toBeLessThan(readyBoxes[1].y);
    else expect(readyBoxes[0].x).toBeLessThan(readyBoxes[1].x);

    await speak.click();
    await page.getByRole("button", { name: "Tiếp tục" }).click();
    const stop = page.getByRole("button", { name: "Dừng nói" });
    await expect(actions).toHaveCSS("flex-direction", viewport.direction);
    await expect(stop).toBeVisible();
    const listeningBoxes = await Promise.all([listen.boundingBox(), stop.boundingBox()]);
    expect(listeningBoxes.every((box) => box && box.width >= 44 && box.height >= 44)).toBe(true);
    if (viewport.direction === "column") expect(listeningBoxes[0].y).toBeLessThan(listeningBoxes[1].y);
    else expect(listeningBoxes[0].x).toBeLessThan(listeningBoxes[1].x);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });
}

test("USER enters from public Set Detail and completes a read-only mocked speaking journey", async ({ page }) => {
  const calls = await installSpeakingBrowserMocks(page, { includePublicDetail: true });

  await page.goto(`/vocabulary-sets/${setId}`);
  const activities = page.getByRole("region", { name: "Bắt đầu học" });
  await expect(activities.getByRole("link", { name: /Thẻ ghi nhớ/ })).toHaveAttribute("href", `/learn/vocabulary-sets/${setId}`);
  await expect(activities.getByRole("link", { name: /Quiz/ })).toHaveAttribute("href", `/quiz/vocabulary-sets/${setId}`);
  await activities.getByRole("link", { name: /Luyện nói/ }).click();

  await expect(page).toHaveURL(new RegExp(`/pronunciation/vocabulary-sets/${setId}$`));
  await expect(page.getByRole("heading", { name: "book" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sẵn sàng luyện nói" })).toHaveCount(0);
  await expect(page.getByText("Từ 1 / 2", { exact: true })).toBeVisible();
  await expect(page.getByText("/bʊk/", { exact: true })).toBeVisible();
  await expect(page.getByTestId("listening-waveform")).toHaveCount(0);
  expect(calls.learning.length).toBeGreaterThanOrEqual(1);
  expect(calls.learning.every((call) => call.method === "GET" && call.mode === "NORMAL" && call.setId === setId)).toBe(true);

  await page.getByRole("button", { name: "Nghe" }).click();
  await expect.poll(() => page.evaluate(() => window.__speakingNative.audioPlays)).toBe(1);
  expect(await page.evaluate(() => window.__speakingRecognitions.length)).toBe(0);

  await page.getByRole("button", { name: "Nói" }).click();
  await expect(page.getByRole("heading", { name: "Xác nhận trước khi dùng micro" })).toBeVisible();
  expect(await page.evaluate(() => window.__speakingRecognitions.length)).toBe(0);
  await page.getByRole("button", { name: "Tiếp tục" }).click();
  await expect(page.getByRole("button", { name: "Dừng nói" })).toBeVisible();
  await expect(page.getByTestId("listening-waveform")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Đang lắng nghe" })).toHaveCount(0);
  await expect(page.getByText("Đang lắng nghe.", { exact: true })).toBeAttached();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.getByTestId("listening-waveform").locator("span").first()).toHaveCSS("animation-name", "none");
  expect(await page.evaluate(() => window.__speakingNative.recognitionStarts)).toBe(1);

  await page.getByRole("button", { name: "Dừng nói" }).click();
  await expect(page.getByTestId("listening-waveform")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Đang chờ kết quả nhận diện" })).toHaveCount(0);
  await expect(page.getByText("Đang chờ kết quả nhận diện.", { exact: true })).toBeAttached();
  expect(await page.evaluate(() => window.__speakingNative.recognitionStops)).toBe(1);
  await emitRecognitionResult(page, ["page", "book"]);
  const alternativeFeedback = page.getByRole("heading", { name: "Nhận diện chưa chắc chắn" });
  await expect(alternativeFeedback).toBeVisible();
  await expect(page.getByText("Từ mục tiêu chỉ xuất hiện trong kết quả thay thế.", { exact: true })).toBeVisible();
  await expect(alternativeFeedback.locator("xpath=ancestor::section[1]")).toHaveClass(/bg-\[#FFFBEB\]/);
  await expect(page.getByText("Trình duyệt đã nhận diện:")).toBeVisible();

  const oldRecognitionIndex = await page.evaluate(() => window.__speakingRecognitions.length - 1);
  await page.getByRole("button", { name: "Từ tiếp theo" }).click();
  await expect(page.getByRole("heading", { name: "travel" })).toBeVisible();
  await expect(page.getByText("Từ 2 / 2", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Từ trước" }).click();
  await expect(page.getByRole("heading", { name: "book" })).toBeVisible();
  await expect(page.getByText("Từ 1 / 2", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Từ tiếp theo" }).click();
  await expect(page.getByRole("heading", { name: "travel" })).toBeVisible();
  await expect(page.getByText("Từ 2 / 2", { exact: true })).toBeVisible();
  await emitRecognitionResult(page, ["book"], oldRecognitionIndex);
  await expect(page.getByRole("heading", { name: "travel" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Đã nhận diện từ mục tiêu" })).toHaveCount(0);

  await page.getByRole("button", { name: "Bỏ qua từ này" }).click();
  await expect(page.getByRole("heading", { name: "Hoàn thành luyện nói" })).toBeVisible();
  await page.getByRole("button", { name: "Học lại từ đầu" }).click();
  await expect(page.getByRole("heading", { name: "book" })).toBeVisible();
  await page.getByRole("button", { name: "Browser Speaking Set" }).click();
  await expect(page).toHaveURL(new RegExp(`/vocabulary-sets/${setId}$`));

  expect(calls.writes).toEqual([]);
  expect(calls.providerRequests).toEqual([]);
});

test("Exit aborts active native recognition and stale callbacks cannot restart or restore it", async ({ page }) => {
  await installSpeakingBrowserMocks(page, { includePublicDetail: true });
  await page.goto(`/pronunciation/vocabulary-sets/${setId}`);
  await beginRecognition(page);

  const recognitionIndex = await page.evaluate(() => {
    const index = window.__speakingRecognitions.length - 1;
    window.__lateRecognitionResult = window.__speakingRecognitions[index]?.onresult;
    return index;
  });
  expect(recognitionIndex).toBe(0);
  expect(await page.evaluate(() => window.__speakingNative.recognitionStarts)).toBe(1);
  expect(await page.evaluate(() => window.__speakingNative.recognitionAborts)).toBe(0);

  await page.getByRole("button", { name: "Browser Speaking Set" }).click();
  await expect(page).toHaveURL(new RegExp(`/vocabulary-sets/${setId}$`));
  await expect.poll(() => page.evaluate(() => window.__speakingNative.recognitionAborts)).toBe(1);

  await page.evaluate(() => {
    const result = [{ transcript: "book", confidence: 0.99 }];
    result.isFinal = true;
    window.__lateRecognitionResult?.({ resultIndex: 0, results: [result] });
  });
  await expect(page).toHaveURL(new RegExp(`/vocabulary-sets/${setId}$`));
  await expect(page.getByRole("heading", { name: "Browser Speaking Set" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Đã nhận diện từ mục tiêu" })).toHaveCount(0);
  expect(await page.evaluate(() => window.__speakingNative.recognitionStarts)).toBe(1);
  expect(await page.evaluate(() => window.__speakingNative.recognitionAborts)).toBe(1);
});

test("owned-private entry preserves its validated Exit destination", async ({ page }) => {
  await installSpeakingBrowserMocks(page, { includePrivateDetail: true });
  await page.goto(`/my/vocabulary-sets/${setId}`);
  await page.getByRole("link", { name: /Luyện nói/ }).click();
  await expect(page).toHaveURL(new RegExp(`/pronunciation/vocabulary-sets/${setId}$`));
  await page.getByRole("button", { name: "Browser Speaking Set" }).click();
  await expect(page).toHaveURL(new RegExp(`/my/vocabulary-sets/${setId}$`));
});

test("permission failure is localized and Retry starts only from an explicit action", async ({ page }) => {
  await installSpeakingBrowserMocks(page);
  await page.goto(`/pronunciation/vocabulary-sets/${setId}`);
  await beginRecognition(page);
  await emitRecognitionError(page, "not-allowed");

  await expect(page.getByRole("heading", { name: "Không thể sử dụng microphone" })).toBeVisible();
  await expect(page.getByText("Hãy cho phép ELVocab truy cập microphone trong cài đặt trình duyệt rồi thử lại.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Nghe từ mẫu" })).toBeEnabled();
  expect(await page.evaluate(() => window.__speakingNative.recognitionStarts)).toBe(1);
  await page.getByRole("button", { name: "Thử nói lại" }).click();
  await expect(page.getByRole("button", { name: "Dừng nói" })).toBeVisible();
  expect(await page.evaluate(() => window.__speakingNative.recognitionStarts)).toBe(2);
});

test("unsupported recognition keeps reference playback and navigation available", async ({ page }) => {
  await installSpeakingBrowserMocks(page, { recognitionSupported: false });
  await page.goto(`/pronunciation/vocabulary-sets/${setId}`);

  await expect(page.getByRole("heading", { name: "Trình duyệt chưa hỗ trợ nhận diện giọng nói" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Nói" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Nghe" })).toBeEnabled();
  await page.getByRole("button", { name: "Nghe" }).click();
  await expect.poll(() => page.evaluate(() => window.__speakingNative.audioPlays)).toBe(1);
  await page.getByRole("button", { name: "Từ tiếp theo" }).click();
  await expect(page.getByRole("heading", { name: "travel" })).toBeVisible();
});

test("Learning failure exposes retry and keeps the request read-only", async ({ page }) => {
  const calls = await installSpeakingBrowserMocks(page, { learningFailures: 2 });
  await page.goto(`/pronunciation/vocabulary-sets/${setId}`);

  await expect(page.getByRole("heading", { name: "Chưa thể nhận diện lúc này" })).toBeVisible();
  await expect(page.getByText("Không thể tải bộ từ lúc này.")).toBeVisible();
  await page.getByRole("button", { name: "Thử lại" }).click();
  await expect(page.getByRole("heading", { name: "book" })).toBeVisible();
  expect(calls.learning.length).toBeGreaterThanOrEqual(3);
  expect(calls.learning.every((call) => call.method === "GET" && call.mode === "NORMAL")).toBe(true);
  expect(calls.writes).toEqual([]);
});

test("startup and finalization watchdogs settle at their approved boundaries", async ({ page }) => {
  await installSpeakingBrowserMocks(page, { recognitionStartsSynchronously: false });
  await page.goto(`/pronunciation/vocabulary-sets/${setId}`);
  await page.getByRole("button", { name: "Nói" }).click();
  await page.getByRole("button", { name: "Tiếp tục" }).click();
  await expect(page.getByRole("heading", { name: "Đang bắt đầu nhận diện" })).toHaveCount(0);
  await expect(page.getByText("Đang bắt đầu nhận diện.", { exact: true })).toBeAttached();
  await expect(page.getByRole("heading", { name: "Chưa thể xác định kết quả" })).toBeVisible({ timeout: 6_500 });
  await expect(page.getByRole("button", { name: "Thử nói lại" })).toBeVisible();

  await page.reload();
  await page.evaluate(() => { window.__speakingNative.recognitionStartsSynchronously = true; });
  await beginRecognition(page);
  await page.getByRole("button", { name: "Dừng nói" }).click();
  await expect(page.getByRole("heading", { name: "Đang chờ kết quả nhận diện" })).toHaveCount(0);
  await expect(page.getByText("Đang chờ kết quả nhận diện.", { exact: true })).toBeAttached();
  await expect(page.getByText("Đã dừng lượt nói.", { exact: true })).toBeAttached({ timeout: 5_500 });
  await expect(page.getByRole("heading", { name: "Chưa thể xác định kết quả" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Nói" })).toBeEnabled();
});

test("Guest and ADMIN cannot enter the USER-only Speaking Practice route", async ({ browser }) => {
  for (const user of [null, publicAdmin]) {
    const page = await browser.newPage();
    await installSpeakingBrowserMocks(page, { user });
    await page.goto(`/pronunciation/vocabulary-sets/${setId}`);
    await expect(page).not.toHaveURL(new RegExp(`/pronunciation/vocabulary-sets/${setId}$`));
    expect(await page.evaluate(() => window.__speakingRecognitions.length)).toBe(0);
    await page.close();
  }
});

async function beginRecognition(page) {
  await expect(page.getByRole("heading", { name: "book" })).toBeVisible();
  await page.getByRole("button", { name: "Nói" }).click();
  await page.getByRole("button", { name: "Tiếp tục" }).click();
  await expect(page.getByRole("button", { name: "Dừng nói" })).toBeVisible();
}

async function emitRecognitionResult(page, transcripts, recognitionIndex = -1) {
  await page.evaluate(({ alternatives, index }) => {
    const result = alternatives.map((transcript) => ({ transcript, confidence: 0.99 }));
    result.isFinal = true;
    const recognitions = window.__speakingRecognitions;
    const recognition = index < 0 ? recognitions.at(-1) : recognitions[index];
    recognition?.onresult?.({ resultIndex: 0, results: [result] });
  }, { alternatives: transcripts, index: recognitionIndex });
}

async function emitRecognitionError(page, error) {
  await page.evaluate((value) => window.__speakingRecognitions.at(-1)?.onerror?.({ error: value }), error);
}

async function installSpeakingBrowserMocks(page, options = {}) {
  const calls = { learning: [], providerRequests: [], writes: [] };
  const user = Object.hasOwn(options, "user") ? options.user : publicUser;
  let learningFailures = options.learningFailures ?? 0;

  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/")
      && /speech|recognition|transcri|provider/i.test(url.pathname)) {
      calls.providerRequests.push(request.url());
    }
  });

  await page.addInitScript(({ recognitionSupported, recognitionStartsSynchronously }) => {
    window.__speakingRecognitions = [];
    window.__speakingNative = {
      audioPauses: 0,
      audioPlays: 0,
      recognitionAborts: 0,
      recognitionStarts: 0,
      recognitionStops: 0,
      recognitionStartsSynchronously,
    };
    class FakeAudio {
      constructor(url) { this.src = url; }
      play() { window.__speakingNative.audioPlays += 1; this.onplay?.(); return Promise.resolve(); }
      pause() { window.__speakingNative.audioPauses += 1; }
    }
    class FakeSpeechRecognition {
      constructor() { window.__speakingRecognitions.push(this); }
      start() {
        window.__speakingNative.recognitionStarts += 1;
        if (window.__speakingNative.recognitionStartsSynchronously) this.onstart?.();
      }
      stop() { window.__speakingNative.recognitionStops += 1; }
      abort() { window.__speakingNative.recognitionAborts += 1; this.onend?.(); }
    }
    window.Audio = FakeAudio;
    if (recognitionSupported) window.SpeechRecognition = FakeSpeechRecognition;
    else {
      delete window.SpeechRecognition;
      delete window.webkitSpeechRecognition;
    }
  }, {
    recognitionSupported: options.recognitionSupported !== false,
    recognitionStartsSynchronously: options.recognitionStartsSynchronously !== false,
  });

  await installAuthApiMock(page, {
    "/api/auth/me": user ? responses.currentUser(user) : responses.guest(),
  });
  await page.route("**/api/learning/sets/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const requestedSetId = decodeURIComponent(url.pathname.split("/").at(-1));
    calls.learning.push({ method: request.method(), mode: url.searchParams.get("mode"), setId: requestedSetId });
    if (request.method() !== "GET") calls.writes.push({ method: request.method(), pathname: url.pathname });
    if (learningFailures > 0) {
      learningFailures -= 1;
      await route.fulfill({ status: 503, json: { success: false, error: { code: "LEARNING_REQUEST_FAILED", message: "temporary" } } });
      return;
    }
    await route.fulfill({ status: 200, json: { success: true, data: learningPayload() } });
  });
  await page.route("**/api/learning/events", async (route) => {
    calls.writes.push({ method: route.request().method(), pathname: new URL(route.request().url()).pathname });
    await route.fulfill({ status: 500, body: "unexpected write" });
  });
  if (options.includePublicDetail) {
    await page.route(`**/api/vocabulary-sets/${setId}`, (route) => route.fulfill({
      status: 200,
      json: { success: true, data: publicDetailPayload() },
    }));
  }
  if (options.includePrivateDetail) {
    await page.route(`**/api/my/vocabulary-sets/${setId}`, (route) => route.fulfill({
      status: 200,
      json: { success: true, data: privateDetailPayload() },
    }));
  }
  return calls;
}

function learningPayload() {
  return {
    id: setId,
    name: "Browser Speaking Set",
    mode: "NORMAL",
    total_items: 2,
    cards: [
      learningCard("vocabulary-book-exact", "book", "/bʊk/", 1, "https://audio.example.test/book.mp3"),
      learningCard("vocabulary-travel-exact", "travel", "/ˈtrævəl/", 2, null),
    ],
  };
}

function learningCard(id, word, phonetic, position, pronunciationUrl) {
  return {
    id,
    word,
    phonetic,
    position,
    pronunciation_url: pronunciationUrl,
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

function publicDetailPayload() {
  return {
    id: setId,
    name: "Browser Speaking Set",
    description: "Mocked browser integration",
    cefr_level: "A1",
    cover_image_url: null,
    item_count: 2,
    topic_id: "topic-browser",
    items: [
      { id: "set-item-book", vocabulary_id: "vocabulary-book-exact", position: 1, word: "book", phonetic: "/bʊk/" },
      { id: "set-item-travel", vocabulary_id: "vocabulary-travel-exact", position: 2, word: "travel", phonetic: "/ˈtrævəl/" },
    ],
  };
}

function privateDetailPayload() {
  return {
    ...publicDetailPayload(),
    items: publicDetailPayload().items.map((item) => ({ ...item, source: "CANONICAL", primary_meaning: null })),
  };
}
