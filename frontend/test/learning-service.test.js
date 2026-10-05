import assert from "node:assert/strict";
import test from "node:test";
import { LearningApiError, createLearningService } from "../src/services/learning-service.js";

test("Learning service serializes SRS/NORMAL reads and four-rating commands", async () => {
  const calls = [];
  const service = createLearningService(createClient(calls));
  assert.equal((await service.getLearningSet("set/id")).mode, "SRS");
  assert.equal((await service.getLearningSet("set/id", { mode: "NORMAL" })).mode, "NORMAL");
  assert.equal((await service.getLearningSet("set/id", { omitMode: true })).mode, "SRS");
  const event = { event_id: "e", set_id: "s", vocabulary_id: "v", expected_revision: 0, rating: "GOOD" };
  assert.deepEqual(await service.recordMeaningfulEvent(event), ratingProgress);
  assert.equal((await service.getLearningProgress()).evaluated_at, NOW);
  assert.deepEqual(calls, [
    ["GET", "/api/learning/sets/set%2Fid", { params: { mode: "SRS" } }],
    ["GET", "/api/learning/sets/set%2Fid", { params: { mode: "NORMAL" } }],
    ["GET", "/api/learning/sets/set%2Fid"],
    ["POST", "/api/learning/events", event],
    ["GET", "/api/learning/progress", { params: {} }],
  ]);
});

test("all four ratings are accepted and old outcome/malformed modes fail before transport", async () => {
  const calls = [];
  const service = createLearningService(createClient(calls));
  for (const rating of ["AGAIN", "HARD", "GOOD", "EASY"]) {
    await service.recordMeaningfulEvent({ rating });
  }
  await assert.rejects(service.recordMeaningfulEvent({ outcome: "REMEMBERED" }), { code: "INVALID_LEARNING_RATING" });
  await assert.rejects(service.getLearningSet("set", { mode: "normal" }), { code: "INVALID_LEARNING_MODE" });
  assert.equal(calls.filter(([method]) => method === "POST").length, 4);
});

test("mode-specific and authoritative response guards reject malformed data", async () => {
  await assert.rejects(
    createLearningService({ async get() { return { data: { data: { ...srsSet, mode: "NORMAL" } } }; } }).getLearningSet("set"),
    { code: "INVALID_LEARNING_RESPONSE" },
  );
  await assert.rejects(
    createLearningService({ async get() { return { data: { data: { ...normalSet, cards: [] } } }; } }).getLearningSet("set", { mode: "NORMAL" }),
    { code: "INVALID_LEARNING_RESPONSE" },
  );
  await assert.rejects(
    createLearningService({ async post() { return { data: { data: { status: "LEARNED" } } }; } }).recordMeaningfulEvent({ rating: "GOOD" }),
    { code: "INVALID_LEARNING_RESPONSE" },
  );
  for (const ratingPreviews of [
    undefined,
    { ...previews, AGAIN: { kind: "SCHEDULED", interval_days: 1 } },
    { ...previews, GOOD: { kind: "SCHEDULED", interval_days: 2 } },
    { ...previews, EXTRA: { kind: "SCHEDULED", interval_days: 1 } },
  ]) {
    await assert.rejects(
      createLearningService({ async get() { return { data: { data: { ...srsSet, cards: [{ ...card, rating_previews: ratingPreviews }] } } }; } }).getLearningSet("set"),
      { code: "INVALID_LEARNING_RESPONSE" },
    );
  }
});

test("Learning service maps not-found, conflict and operational failures", async () => {
  await assert.rejects(
    createLearningService({ async get() { throw { response: { status: 404, data: { error: { code: "LEARNING_SET_NOT_FOUND", message: "Missing." } } } }; } }).getLearningSet("missing"),
    (error) => error instanceof LearningApiError && error.kind === "not-found",
  );
  await assert.rejects(
    createLearningService({ async post() { throw { response: { status: 409, data: { error: { code: "LEARNING_PROGRESS_CHANGED" } } } }; } }).recordMeaningfulEvent({ rating: "AGAIN" }),
    (error) => error.kind === "conflict" && error.status === 409,
  );
});

function createClient(calls) {
  return {
    async get(url, options) {
      calls.push(options ? ["GET", url, options] : ["GET", url]);
      if (url.endsWith("/progress")) return { data: { data: learningProgress } };
      const mode = options?.params?.mode ?? "SRS";
      return { data: { data: mode === "NORMAL" ? normalSet : srsSet } };
    },
    async post(url, input) { calls.push(["POST", url, input]); return { data: { data: ratingProgress } }; },
  };
}

const NOW = "2026-10-04T03:15:00.000Z";
const previews = Object.freeze({ AGAIN: { kind: "SESSION_REQUEUE", interval_days: null }, HARD: { kind: "SCHEDULED", interval_days: 1 }, GOOD: { kind: "SCHEDULED", interval_days: 3 }, EASY: { kind: "SCHEDULED", interval_days: 7 } });
const card = Object.freeze({ id: "v", word: "book", position: 1, meanings: [], progress: { effective_status: "NEW", stage: 0, interval_days: null, next_review_at: null, review_count: 0, revision: 0 }, rating_previews: previews });
const srsSet = Object.freeze({ id: "s", name: "Set", mode: "SRS", evaluated_at: NOW, total_items: 1, eligible_count: 1, next_review_at: null, cards: [card] });
const normalCard = { ...card };
delete normalCard.rating_previews;
Object.freeze(normalCard);
const normalSet = Object.freeze({ id: "s", name: "Set", mode: "NORMAL", total_items: 1, cards: [normalCard] });
const ratingProgress = Object.freeze({ vocabulary_id: "v", status: "LEARNED", effective_status: "LEARNED", stage: 1, interval_days: 1, next_review_at: "2026-10-05T03:15:00.000Z", last_reviewed_at: NOW, review_count: 1, revision: 1 });
const learningProgress = Object.freeze({ evaluated_at: NOW, summary: { total_started: 1, learning: 0, learned: 1, needs_review: 0 }, items: [{ vocabulary: { id: "v", word: "book", phonetic: null }, status: "LEARNED", review_count: 1, last_reviewed_at: NOW, interval_days: 1, next_review_at: "2026-10-05T03:15:00.000Z" }], pagination: { page: 1, page_size: 20, total_items: 1, total_pages: 1 }, filter: { status: null } });
