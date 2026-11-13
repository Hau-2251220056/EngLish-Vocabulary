// @ts-nocheck
import { expect, test } from "@playwright/test";
import { installAuthApiMock, publicUser, responses } from "./fixtures/auth-api.js";

const SET_ID = "10000000-0000-4000-8000-000000000001";
const PASS_ID = "20000000-0000-4000-8000-000000000002";
const SESSION_ID = "30000000-0000-4000-8000-000000000003";
const VOCABULARY_ID = "40000000-0000-4000-8000-000000000004";
const CREATED_AT = "2026-11-03T00:00:00.000Z";

test("required NORMAL Set needs bounded completion and explicit full-pass confirmation", async ({ page }) => {
  await installAuthApiMock(page, { "/api/auth/me": responses.currentUser(publicUser) });
  await page.addInitScript(() => {
    window.__audioPlayCount = 0;
    window.Audio = class MockAudio {
      pause() {}
      play() {
        window.__audioPlayCount += 1;
        return Promise.resolve();
      }
    };
  });
  let revealed = false;
  let boundedComplete = false;
  let fullPassComplete = false;
  let managedSessionCreated = false;
  let releaseReveal = null;
  const revealOperationIds = [];

  await page.route("**/api/learning-path", (route) => route.fulfill({ status: 200, json: { success: true, data: fullPassComplete ? pathProjection() : startPathProjection() } }));

  await page.route(`**/api/learning/sets/${SET_ID}**`, (route) => route.fulfill({
    status: 200,
    json: { success: true, data: {
      id: SET_ID, name: "A1 starter", mode: "NORMAL", total_items: 1,
      cards: [{
        id: VOCABULARY_ID, word: "book", phonetic: "/bʊk/", position: 1,
        pronunciation_url: "https://audio.example.test/book.mp3",
        meanings: [{ id: "50000000-0000-4000-8000-000000000005", part_of_speech: "noun", meaning_vi: "quyển sách", context: null, cefr_level: "A1", examples: [] }],
        progress: { status: "NEW", stored_status: null, effective_status: "NEW", stage: 0, interval_days: null, next_review_at: null, review_count: 0, revision: 0, last_reviewed_at: null },
      }],
    } },
  }));
  await page.route(`**/api/learning-path/sets/${SET_ID}/passes`, (route) => route.fulfill({ status: 201, json: { success: true, data: { pass: passProjection(), replayed: false, resumed: false } } }));
  await page.route(`**/api/learning-path/passes/${PASS_ID}/sessions`, (route) => {
    managedSessionCreated = true;
    return route.fulfill({ status: 201, json: { success: true, data: { session: sessionProjection({ revealed, boundedComplete }), replayed: false, resumed: false } } });
  });
  await page.route(`**/api/learning-sessions/${SESSION_ID}/items/${VOCABULARY_ID}/reveal`, async (route) => {
    const attempt = revealOperationIds.length + 1;
    revealOperationIds.push(route.request().postDataJSON().operation_id);
    await new Promise((resolve) => {
      releaseReveal = async () => {
        if (attempt === 1) {
          await route.fulfill({ status: 503, json: { success: false, error: { code: "SERVICE_UNAVAILABLE", message: "Retry safely." } } });
        } else {
          revealed = true;
          await route.fulfill({ status: 200, json: { success: true, data: { item: { vocabulary_id: VOCABULARY_ID, evidence: "NORMAL_REVEALED", evidence_at: CREATED_AT }, session: sessionProjection({ revealed: true }), cefr_pass: passEvidenceSummary(), replayed: false, already_acknowledged: false } } });
        }
        releaseReveal = null;
        resolve();
      };
    });
  });
  await page.route(`**/api/learning-sessions/${SESSION_ID}/complete`, (route) => {
    boundedComplete = true;
    return route.fulfill({ status: 200, json: { success: true, data: { session: sessionProjection({ revealed: true, boundedComplete: true }), streak: streakProjection(), replayed: false } } });
  });
  await page.route(`**/api/learning-path/passes/${PASS_ID}/complete`, (route) => {
    fullPassComplete = true;
    return route.fulfill({ status: 200, json: { success: true, data: { pass: passProjection({ completed: true }), path: pathProjection(), replayed: false } } });
  });
  await page.route(`**/api/learning-path/passes/${PASS_ID}`, (route) => route.fulfill({ status: 200, json: { success: true, data: passProjection({ ready: boundedComplete }) } }));

  await page.goto("/dashboard");
  const path = page.getByRole("region", { name: "Lộ trình CEFR" });
  const a1Level = path.getByRole("list", { name: "Các cấp độ CEFR" })
    .getByRole("listitem").filter({ hasText: /^A1/ });
  await expect(a1Level).toContainText("đã mở");
  const suggestion = page.getByRole("region", { name: "Gợi ý tiếp theo" });
  await expect(suggestion).toContainText("A1 starter");
  await expect(suggestion.getByText("A1", { exact: true })).toBeVisible();
  const startLink = suggestion.getByRole("link", { name: "Bắt đầu học" });
  await expect(startLink).toHaveAttribute("href", `/learn/vocabulary-sets/${SET_ID}`);
  await startLink.click();
  await expect.poll(() => managedSessionCreated).toBe(true);
  await expect(page.getByRole("status").filter({ hasText: "Đang chuẩn bị phiên học…" })).toHaveCount(0);
  await page.getByRole("heading", { name: "book" }).press("Space");
  await expect.poll(() => revealOperationIds).toHaveLength(1);
  const pendingStatus = page.getByRole("status").filter({ hasText: "Đang ghi nhận bằng chứng học tập…" });
  const card = page.locator(".learning-flip-stage");
  const completeButton = page.getByRole("button", { name: "Hoàn thành phiên" });
  await expect(pendingStatus).toBeVisible();
  await expect(pendingStatus).toBeFocused();
  await expect(card).toHaveAttribute("aria-busy", "true");
  await expect(page.getByRole("heading", { name: "quyển sách" })).toBeVisible();
  await expect(completeButton).toBeDisabled();
  await expect(page.getByRole("button", { name: "Ôn tập SRS" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Học lại từ đầu" })).toBeDisabled();
  const audioButton = page.getByRole("button", { name: "Phát âm từ book" });
  await expect(audioButton).toBeEnabled();
  const audioCountBeforeClick = await page.evaluate(() => window.__audioPlayCount);
  await audioButton.click();
  await expect.poll(() => page.evaluate(() => window.__audioPlayCount)).toBe(audioCountBeforeClick + 1);
  await page.keyboard.press("Space");
  expect(revealOperationIds).toHaveLength(1);

  await releaseReveal();
  const retryButton = page.getByRole("button", { name: "Thử lại ghi nhận" });
  await expect(retryButton).toBeFocused();
  await retryButton.press("Enter");
  await expect.poll(() => revealOperationIds).toHaveLength(2);
  expect(revealOperationIds[1]).toBe(revealOperationIds[0]);
  await expect(pendingStatus).toBeVisible();
  await expect(pendingStatus).toBeFocused();
  await expect(card).toHaveAttribute("aria-busy", "true");

  await releaseReveal();
  await expect(pendingStatus).toHaveCount(0);
  await expect(card).not.toHaveAttribute("aria-busy", "true");
  await expect(completeButton).toBeEnabled();
  await expect(completeButton).toBeFocused();
  await completeButton.click();
  await expect(page.getByRole("heading", { name: "Sẵn sàng hoàn thành bộ từ" })).toBeVisible();
  expect(fullPassComplete).toBe(false);
  await page.getByRole("button", { name: "Hoàn thành bộ từ" }).click();
  await expect(page.getByRole("heading", { name: "Hoàn thành bộ từ" })).toBeVisible();
  expect(fullPassComplete).toBe(true);
});

test("historically completed Set detail starts fresh ordinary NORMAL without touching the completed pass", async ({ page }) => {
  await installAuthApiMock(page, { "/api/auth/me": responses.currentUser(publicUser) });
  const staleSessionId = "60000000-0000-4000-8000-000000000006";
  const pendingCreateOperationId = "80000000-0000-4000-8000-000000000008";
  let passStartCalls = 0;
  let ordinarySessionCreates = 0;
  const ordinaryOperationIds = new Set();
  const passMutationRequests = [];

  await page.addInitScript(({ pendingCreateOperationId, setId, staleSessionId, userId, vocabularyId }) => {
    sessionStorage.setItem(`elvocab.learning.run.v1:${userId}:${setId}`, JSON.stringify({
      version: 3,
      user_id: userId,
      set_id: setId,
      active_mode: "NORMAL",
      srs: {
        snapshot_at: "2026-11-03T00:00:00.000Z",
        initial_ids: ["preserved-srs-card"],
        queue: ["preserved-srs-card"],
        passed_ids: [],
        presentation_count: 0,
        retry_context: null,
        status: "ACTIVE",
      },
      normal_initialized: true,
      normal: {
        snapshot_ids: [vocabularyId],
        batches: [[vocabularyId]],
        active_batch_index: null,
        current_vocabulary_id: null,
        batch_status: "COMPLETED",
        run_status: "COMPLETED",
      },
    }));
    sessionStorage.setItem(
      `elvocab.backend-learning-session.ordinary:v3:${userId}:${setId}:NORMAL_FLASHCARD`,
      JSON.stringify({
        version: 3, user_id: userId, set_id: setId, mode: "NORMAL", pass_id: null,
        session_id: staleSessionId, creation_operation_id: null,
        expires_at: "2026-11-10T00:00:00.000Z", cursor_vocabulary_id: vocabularyId,
        view_state: "COMPLETED",
      }),
    );
    sessionStorage.setItem(
      `elvocab.backend-learning-session-create.ordinary:v3:${userId}:${setId}:NORMAL_FLASHCARD`,
      JSON.stringify({
        version: 3, user_id: userId, set_id: setId, mode: "NORMAL", pass_id: null,
        creation_operation_id: pendingCreateOperationId,
      }),
    );
    sessionStorage.setItem("elvocab.backend-learning-session-create.ordinary:v3:other-user:other-set:NORMAL_FLASHCARD", "other pending identity");
    sessionStorage.setItem(
      `elvocab.backend-learning-session.ordinary:v3:${userId}:${setId}:SRS_FLASHCARD`,
      JSON.stringify({ marker: "srs-preserved" }),
    );
    sessionStorage.setItem("elvocab.normal-learning-operation:v1:preserved", "accepted operation identity");
    sessionStorage.setItem("unrelated-session-state", "preserved");
  }, { pendingCreateOperationId, setId: SET_ID, staleSessionId, userId: publicUser.id, vocabularyId: VOCABULARY_ID });

  await page.route(`**/api/my/vocabulary-sets/${SET_ID}`, (route) => route.fulfill({
    status: 200,
    json: { success: true, data: {
      id: SET_ID, name: "A1 completed", description: null, cefr_level: "A1", cover_image_url: null,
      items: [{
        id: "70000000-0000-4000-8000-000000000007", vocabulary_id: VOCABULARY_ID,
        position: 1, word: "book", phonetic: "/bʊk/", source: "CANONICAL",
        primary_meaning: { part_of_speech: "noun", meaning_vi: "quyển sách", example: null },
      }],
    } },
  }));
  await page.route(`**/api/learning/sets/${SET_ID}**`, (route) => route.fulfill({
    status: 200,
    json: { success: true, data: {
      id: SET_ID, name: "A1 completed", mode: "NORMAL", total_items: 1,
      cards: [{
        id: VOCABULARY_ID, word: "book", phonetic: "/bʊk/", position: 1,
        pronunciation_url: null,
        meanings: [{ id: "50000000-0000-4000-8000-000000000005", part_of_speech: "noun", meaning_vi: "quyển sách", context: null, cefr_level: "A1", examples: [] }],
        progress: { status: "NEW", stored_status: null, effective_status: "NEW", stage: 0, interval_days: null, next_review_at: null, review_count: 0, revision: 0, last_reviewed_at: null },
      }],
    } },
  }));
  await page.route(`**/api/learning-path/sets/${SET_ID}/passes`, (route) => {
    passStartCalls += 1;
    passMutationRequests.push(new URL(route.request().url()).pathname);
    return route.fulfill({
      status: 409,
      json: { success: false, error: { code: "CEFR_SET_ALREADY_COMPLETED", message: "Completed." } },
    });
  });
  await page.route("**/api/learning-path/passes/**", (route) => {
    passMutationRequests.push(new URL(route.request().url()).pathname);
    return route.fulfill({ status: 500, body: "Unexpected pass mutation" });
  });
  await page.route("**/api/learning-sessions", (route) => {
    ordinarySessionCreates += 1;
    const request = route.request().postDataJSON();
    expect(request.mode).toBe("NORMAL");
    expect(request.set_id).toBe(SET_ID);
    expect(request.vocabulary_ids).toEqual([VOCABULARY_ID]);
    expect(request.operation_id).toBe(pendingCreateOperationId);
    ordinaryOperationIds.add(request.operation_id);
    return route.fulfill({
      status: 201,
      json: { success: true, data: { session: sessionProjection(), replayed: false } },
    });
  });

  await page.goto(`/my/vocabulary-sets/${SET_ID}`);
  await page.getByRole("link", { name: /Thẻ ghi nhớ/ }).click();
  await expect(page.getByRole("heading", { name: "book" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Hoàn thành bộ từ" })).toHaveCount(0);
  await expect.poll(() => passStartCalls).toBeGreaterThan(0);
  expect(ordinarySessionCreates).toBeGreaterThan(0);
  expect([...ordinaryOperationIds]).toEqual([pendingCreateOperationId]);
  expect(passMutationRequests).toEqual([`/api/learning-path/sets/${SET_ID}/passes`]);

  const preserved = await page.evaluate(({ setId, userId }) => ({
    run: JSON.parse(sessionStorage.getItem(`elvocab.learning.run.v1:${userId}:${setId}`)),
    pending: sessionStorage.getItem(`elvocab.backend-learning-session-create.ordinary:v3:${userId}:${setId}:NORMAL_FLASHCARD`),
    otherPending: sessionStorage.getItem("elvocab.backend-learning-session-create.ordinary:v3:other-user:other-set:NORMAL_FLASHCARD"),
    srsSession: sessionStorage.getItem(`elvocab.backend-learning-session.ordinary:v3:${userId}:${setId}:SRS_FLASHCARD`),
    acceptedOperation: sessionStorage.getItem("elvocab.normal-learning-operation:v1:preserved"),
    unrelated: sessionStorage.getItem("unrelated-session-state"),
    ordinary: JSON.parse(sessionStorage.getItem(`elvocab.backend-learning-session.ordinary:v3:${userId}:${setId}:NORMAL_FLASHCARD`)),
  }), { setId: SET_ID, userId: publicUser.id });
  expect(preserved.run.normal.run_status).toBe("ACTIVE");
  expect(preserved.run.normal.current_vocabulary_id).toBe(VOCABULARY_ID);
  expect(preserved.run.srs.queue).toEqual(["preserved-srs-card"]);
  expect(preserved.pending).toBeNull();
  expect(preserved.otherPending).toBe("other pending identity");
  expect(preserved.srsSession).toContain("srs-preserved");
  expect(preserved.acceptedOperation).toBe("accepted operation identity");
  expect(preserved.unrelated).toBe("preserved");
  expect(preserved.ordinary.session_id).toBe(SESSION_ID);
  expect(preserved.ordinary.pass_id).toBeNull();
});

function passProjection({ ready = false, completed = false } = {}) {
  const credited = ready || completed ? 1 : 0;
  return { id: PASS_ID, set_id: SET_ID, state: completed ? "COMPLETED" : "ACTIVE", snapshot_size: 1,
    studied_items: credited, credited_items: credited, remaining_items: 1 - credited,
    ready_to_complete: ready && !completed, evidence_counts: { NORMAL: credited, SRS: 0 },
    activity_state: completed ? "COMPLETED" : ready ? "READY_TO_COMPLETE" : "PRISTINE",
    active_sessions: { NORMAL: [], SRS: [] },
    created_at: CREATED_AT, completed_at: completed ? CREATED_AT : null };
}
function passEvidenceSummary() { return { id: PASS_ID, state: "ACTIVE", snapshot_size: 1, credited_items: 1, remaining_items: 0, ready_to_complete: true }; }
function sessionProjection({ revealed = false, boundedComplete = false } = {}) {
  return { id: SESSION_ID, set_id: SET_ID, mode: "NORMAL", state: boundedComplete ? "COMPLETED" : "ACTIVE", created_at: CREATED_AT, expires_at: "2026-11-10T00:00:00.000Z", completed_at: boundedComplete ? "2026-11-03T00:01:00.000Z" : null, snapshot_size: 1, completed_items: revealed ? 1 : 0, items: [{ vocabulary_id: VOCABULARY_ID, position: 0, evidence: revealed ? "NORMAL_REVEALED" : null }] };
}
function streakProjection() { return { current_streak: 1, completed_today: true, last_qualified_date: "2026-11-03", timezone: "Asia/Ho_Chi_Minh", evaluated_at: CREATED_AT }; }
function pathProjection() {
  return { evaluated_at: CREATED_AT, highest_unlocked_level: "A2", path_completed_at: null, levels: ["A1", "A2", "B1", "B2", "C1"].map((level, index) => ({ level, unlocked: index < 2, required_count: index === 0 ? 1 : 0, completed_count: index === 0 ? 1 : 0, configuration: index === 0 ? "READY" : "NO_REQUIRED_SETS", current_complete: index === 0, incomplete_sets: [] })), recommendation: null, next_suggestion: null, next_suggestion_reason: "NO_ELIGIBLE_NEXT_SET", all_current_sets_complete: false };
}
function startPathProjection() {
  return { evaluated_at: CREATED_AT, highest_unlocked_level: "A1", path_completed_at: null, levels: ["A1", "A2", "B1", "B2", "C1"].map((level, index) => ({ level, unlocked: index === 0, required_count: index === 0 ? 1 : 0, completed_count: 0, configuration: index === 0 ? "READY" : "NO_REQUIRED_SETS", current_complete: false, incomplete_sets: index === 0 ? [{ id: SET_ID, name: "A1 starter", created_at: CREATED_AT }] : [] })), recommendation: { action: "START", set_id: SET_ID, pass_id: null }, next_suggestion: { action: "START", set_id: SET_ID, pass_id: null }, next_suggestion_reason: null, all_current_sets_complete: false };
}
