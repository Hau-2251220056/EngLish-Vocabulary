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
  let revealed = false;
  let boundedComplete = false;
  let fullPassComplete = false;
  let managedSessionCreated = false;

  await page.route("**/api/learning-path", (route) => route.fulfill({ status: 200, json: { success: true, data: fullPassComplete ? pathProjection() : startPathProjection() } }));

  await page.route(`**/api/learning/sets/${SET_ID}**`, (route) => route.fulfill({
    status: 200,
    json: { success: true, data: {
      id: SET_ID, name: "A1 starter", mode: "NORMAL", total_items: 1,
      cards: [{
        id: VOCABULARY_ID, word: "book", phonetic: "/bʊk/", position: 1,
        pronunciation_url: null,
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
  await page.route(`**/api/learning-sessions/${SESSION_ID}/items/${VOCABULARY_ID}/reveal`, (route) => {
    revealed = true;
    return route.fulfill({ status: 200, json: { success: true, data: { item: { vocabulary_id: VOCABULARY_ID, evidence: "NORMAL_REVEALED", evidence_at: CREATED_AT }, session: sessionProjection({ revealed: true }), replayed: false, already_acknowledged: false } } });
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
  await page.getByRole("region", { name: "Lộ trình CEFR" }).getByRole("link", { name: "Bắt đầu học" }).click();
  await expect.poll(() => managedSessionCreated).toBe(true);
  await expect(page.getByRole("status").filter({ hasText: "Đang chuẩn bị phiên học…" })).toHaveCount(0);
  await page.getByRole("heading", { name: "book" }).press("Space");
  await expect(page.getByRole("button", { name: "Hoàn thành phiên" })).toBeEnabled();
  await page.getByRole("button", { name: "Hoàn thành phiên" }).click();
  await expect(page.getByRole("heading", { name: "Sẵn sàng hoàn thành bộ từ" })).toBeVisible();
  expect(fullPassComplete).toBe(false);
  await page.getByRole("button", { name: "Hoàn thành bộ từ" }).click();
  await expect(page.getByRole("heading", { name: "Hoàn thành bộ từ" })).toBeVisible();
  expect(fullPassComplete).toBe(true);
});

function passProjection({ ready = false, completed = false } = {}) {
  return { id: PASS_ID, set_id: SET_ID, state: completed ? "COMPLETED" : "ACTIVE", snapshot_size: 1, studied_items: ready || completed ? 1 : 0, remaining_items: ready || completed ? 0 : 1, created_at: CREATED_AT, completed_at: completed ? CREATED_AT : null };
}
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
