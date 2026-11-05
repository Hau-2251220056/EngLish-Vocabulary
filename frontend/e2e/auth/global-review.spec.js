// @ts-nocheck
import { expect, test } from "@playwright/test";
import { installAuthApiMock, publicAdmin, publicUser, responses } from "./fixtures/auth-api.js";

const SESSION_ID = "10000000-0000-4000-8000-000000000001";
const VOCABULARY_ID = "20000000-0000-4000-8000-000000000002";
const NOW = "2026-11-03T00:00:00.000Z";

test("USER completes one fixed GLOBAL snapshot and explicitly requests continuation", async ({ page }) => {
  await installAuthApiMock(page, { "/api/auth/me": responses.currentUser(publicUser) });
  let createCalls = 0;
  const operationIds = [];
  await page.route("**/api/learning/review/sessions", (route) => {
    createCalls += 1;
    const operationId = route.request().postDataJSON().operation_id;
    operationIds.push(operationId);
    const isInitialOperation = operationId === operationIds[0];
    const replayed = isInitialOperation && operationIds.filter((id) => id === operationId).length > 1;
    return route.fulfill({
      status: isInitialOperation && !replayed ? 201 : 200,
      json: {
        success: true,
        data: isInitialOperation
          ? { ...reviewSession(), replayed }
          : { session: null, cards: [], reason: "REVIEW_UP_TO_DATE", evaluated_at: NOW, nearest_future_review_at: null, replayed: false },
      },
    });
  });
  await page.route("**/api/learning/events", (route) => route.fulfill({ status: 200, json: { success: true, data: ratingResult() } }));

  await page.goto("/review");
  const card = page.getByRole("button", { name: /book/ });
  await expect(card).toBeFocused();
  await page.keyboard.press("Space");
  await expect(page.getByRole("button", { name: /quyển sách/ })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: /book/ })).toBeFocused();
  await page.keyboard.press("Space");
  await page.getByRole("button", { name: "Tốt" }).click();
  await expect(page.getByRole("heading", { name: "Hoàn thành phiên ôn tập" })).toBeVisible();
  expect(new Set(operationIds).size).toBe(1);
  await page.getByRole("button", { name: "Ôn tiếp" }).click();
  await expect(page.getByRole("heading", { name: "Bạn đã ôn tập đầy đủ" })).toBeVisible();
  expect(new Set(operationIds).size).toBe(2);
  expect(createCalls).toBeGreaterThanOrEqual(2);
});

test("ADMIN cannot enter the USER global review route or call review APIs", async ({ page }) => {
  await installAuthApiMock(page, { "/api/auth/me": responses.currentUser(publicAdmin) });
  let calls = 0;
  await page.route("**/api/learning/review**", (route) => { calls += 1; return route.abort("failed"); });
  await page.goto("/review");
  await expect(page).toHaveURL(/\/dashboard$/);
  expect(calls).toBe(0);
});

test("successful ratings refocus the flip button for changed-ID and same-ID AGAIN transitions", async ({ page }) => {
  await installAuthApiMock(page, { "/api/auth/me": responses.currentUser(publicUser) });
  const secondId = "20000000-0000-4000-8000-000000000003";
  const evidence = new Map([[VOCABULARY_ID, null], [secondId, null]]);
  await page.route("**/api/learning/review/sessions", (route) => route.fulfill({
    status: 201,
    json: { success: true, data: { evaluated_at: NOW, replayed: false, session: twoCardSession(evidence, secondId), cards: [reviewCard(VOCABULARY_ID, 0, "alpha"), reviewCard(secondId, 1, "beta")] } },
  }));
  await page.route("**/api/learning/events", (route) => {
    const body = route.request().postDataJSON();
    if (body.rating !== "AGAIN") evidence.set(body.vocabulary_id, `SRS_${body.rating}`);
    return route.fulfill({ status: 200, json: { success: true, data: ratingResultFor(body.vocabulary_id, body.rating, twoCardSession(evidence, secondId)) } });
  });

  await page.goto("/review");
  await expect(page.getByRole("button", { name: /alpha/ })).toBeFocused();
  await page.keyboard.press("Space");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Tốt" })).toBeFocused();
  await page.keyboard.press("Enter");
  const secondCard = page.getByRole("button", { name: /beta/ });
  await expect(secondCard).toBeFocused();
  await expect.poll(() => secondCard.evaluate((element) => getComputedStyle(element).boxShadow !== "none")).toBe(true);

  await page.keyboard.press("Space");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Lại" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(secondCard).toBeFocused();
  await expect.poll(() => secondCard.evaluate((element) => getComputedStyle(element).boxShadow !== "none")).toBe(true);
});

function reviewSession() {
  return { evaluated_at: NOW, replayed: false, session: sessionProjection("ACTIVE", null), cards: [{ id: VOCABULARY_ID, word: "book", phonetic: null, pronunciation_url: null, position: 0, meanings: [{ id: "m1", part_of_speech: "noun", meaning_vi: "quyển sách", context: null, cefr_level: "A1", examples: [] }], progress: { status: "NEEDS_REVIEW", stored_status: "NEEDS_REVIEW", effective_status: "NEEDS_REVIEW", stage: 1, interval_days: 1, next_review_at: NOW, last_reviewed_at: NOW, review_count: 1, revision: 1 }, rating_previews: { AGAIN: { kind: "SESSION_REQUEUE", interval_days: null }, HARD: { kind: "SCHEDULED", interval_days: 1 }, GOOD: { kind: "SCHEDULED", interval_days: 3 }, EASY: { kind: "SCHEDULED", interval_days: 7 } } }] };
}
function sessionProjection(state, evidence) { return { id: SESSION_ID, set_id: null, scope: "GLOBAL", mode: "SRS", state, created_at: NOW, expires_at: "2026-11-10T00:00:00.000Z", completed_at: state === "COMPLETED" ? "2026-11-03T00:01:00.000Z" : null, snapshot_size: 1, completed_items: evidence ? 1 : 0, items: [{ vocabulary_id: VOCABULARY_ID, position: 0, evidence }] }; }
function ratingResult() { return { vocabulary_id: VOCABULARY_ID, status: "LEARNED", stored_status: "LEARNED", effective_status: "LEARNED", stage: 2, interval_days: 3, next_review_at: "2026-11-06T00:00:00.000Z", last_reviewed_at: NOW, review_count: 2, revision: 2, reward: { source_event_id: "30000000-0000-4000-8000-000000000003", xp_earned: 1, replayed: false, total_xp: 1, level: 1, level_min_xp: 0, next_level_xp: 50, is_max_level: false }, session: sessionProjection("COMPLETED", "SRS_GOOD"), streak: { current_streak: 1, completed_today: true, last_qualified_date: "2026-11-03", timezone: "Asia/Ho_Chi_Minh", evaluated_at: NOW } }; }
function twoCardSession(evidence, secondId) { return { ...sessionProjection("ACTIVE", null), snapshot_size: 2, completed_items: [...evidence.values()].filter(Boolean).length, items: [{ vocabulary_id: VOCABULARY_ID, position: 0, evidence: evidence.get(VOCABULARY_ID) }, { vocabulary_id: secondId, position: 1, evidence: evidence.get(secondId) }] }; }
function reviewCard(id, position, word) { return { id, word, phonetic: null, pronunciation_url: null, position, meanings: [{ id: `m-${id}`, part_of_speech: "noun", meaning_vi: `nghĩa ${word}`, context: null, cefr_level: "A1", examples: [] }], progress: { status: "NEEDS_REVIEW", stored_status: "NEEDS_REVIEW", effective_status: "NEEDS_REVIEW", stage: 1, interval_days: 1, next_review_at: NOW, last_reviewed_at: NOW, review_count: 1, revision: 1 }, rating_previews: { AGAIN: { kind: "SESSION_REQUEUE", interval_days: null }, HARD: { kind: "SCHEDULED", interval_days: 1 }, GOOD: { kind: "SCHEDULED", interval_days: 3 }, EASY: { kind: "SCHEDULED", interval_days: 7 } } }; }
function ratingResultFor(vocabularyId, rating, session) { return { vocabulary_id: vocabularyId, status: "NEEDS_REVIEW", stored_status: "NEEDS_REVIEW", effective_status: "NEEDS_REVIEW", stage: 1, interval_days: rating === "AGAIN" ? 1 : 3, next_review_at: NOW, last_reviewed_at: NOW, review_count: 2, revision: 2, reward: { source_event_id: "30000000-0000-4000-8000-000000000004", xp_earned: 1, replayed: false, total_xp: 2, level: 1, level_min_xp: 0, next_level_xp: 50, is_max_level: false }, session }; }
