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
  assert.deepEqual((await service.getLearningProgress()).xp_level, xpLevel);
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

  for (const malformedReward of [
    undefined,
    { ...reward, source_event_id: "not-a-uuid" },
    { ...reward, xp_earned: 2 },
    { ...reward, replayed: "false" },
    { ...reward, level: 16 },
    { ...reward, reward_type: "SRS_INITIAL" },
  ]) {
    await assert.rejects(
      createLearningService({
        async post() {
          return { data: { data: { ...ratingProgress, reward: malformedReward } } };
        },
      }).recordMeaningfulEvent({ rating: "GOOD" }),
      { code: "INVALID_LEARNING_RESPONSE" },
    );
  }

  for (const malformedXpLevel of [
    undefined,
    { ...xpLevel, total_xp: -1 },
    { ...xpLevel, level: 0 },
    { ...xpLevel, level_min_xp: 51 },
    { ...xpLevel, next_level_xp: null },
    { ...xpLevel, is_max_level: "false" },
  ]) {
    await assert.rejects(
      createLearningService({
        async get() {
          return { data: { data: { ...learningProgress, xp_level: malformedXpLevel } } };
        },
      }).getLearningProgress(),
      { code: "INVALID_LEARNING_RESPONSE" },
    );
  }
});

test("Learning mutation accepts authoritative original, replay, zero and MAX rewards", async () => {
  for (const nextReward of [
    reward,
    { ...reward, xp_earned: 0 },
    { ...reward, replayed: true, total_xp: 153, level: 3, level_min_xp: 150, next_level_xp: 300 },
    { ...reward, total_xp: 6000, level: 15, level_min_xp: 5250, next_level_xp: null, is_max_level: true },
  ]) {
    const service = createLearningService({
      async post() {
        return { data: { data: { ...ratingProgress, reward: nextReward } } };
      },
    });
    assert.deepEqual((await service.recordMeaningfulEvent({ rating: "GOOD" })).reward, nextReward);
  }
});

test("session-aware SRS validates identity, evidence and terminal Streak without changing legacy shape", async () => {
  const request = {
    event_id: reward.source_event_id,
    session_id: SESSION_ID,
    set_id: SET_ID,
    vocabulary_id: VOCABULARY_ID,
    expected_revision: 0,
    rating: "GOOD",
  };
  const completed = srsSession({
    state: "COMPLETED",
    completed_at: NOW,
    completed_items: 1,
    evidence: "SRS_GOOD",
  });
  const value = { ...ratingProgress, vocabulary_id: VOCABULARY_ID, session: completed, streak };
  const service = createLearningService({ async post() { return { data: { data: value } }; } });
  assert.deepEqual(await service.recordMeaningfulEvent(request), value);

  for (const malformed of [
    { ...value, session: { ...completed, id: "99999999-9999-4999-8999-999999999999" } },
    { ...value, session: { ...completed, mode: "NORMAL" } },
    { ...value, session: srsSession({ evidence: null }) },
    { ...value, streak: undefined },
  ]) {
    await assert.rejects(
      createLearningService({ async post() { return { data: { data: malformed } }; } })
        .recordMeaningfulEvent(request),
      { code: "INVALID_LEARNING_RESPONSE" },
    );
  }
});

test("session-aware AGAIN requires unresolved evidence and nonterminal responses omit Streak", async () => {
  const request = {
    event_id: reward.source_event_id,
    session_id: SESSION_ID,
    set_id: SET_ID,
    vocabulary_id: VOCABULARY_ID,
    expected_revision: 0,
    rating: "AGAIN",
  };
  const value = { ...ratingProgress, vocabulary_id: VOCABULARY_ID, session: srsSession() };
  assert.deepEqual(await createLearningService({
    async post() { return { data: { data: value } }; },
  }).recordMeaningfulEvent(request), value);
  await assert.rejects(createLearningService({
    async post() { return { data: { data: { ...value, streak } } }; },
  }).recordMeaningfulEvent(request), { code: "INVALID_LEARNING_RESPONSE" });
  await assert.rejects(createLearningService({
    async post() { throw new Error("transport must not run"); },
  }).recordMeaningfulEvent({ ...request, session_id: "not-a-uuid" }), {
    code: "INVALID_LEARNING_RATING",
  });
});

test("NORMAL reads preserve server-authored identity, word and order without issuing writes", async () => {
  const calls = [];
  const duplicateWordSet = {
    ...normalSet,
    total_items: 2,
    cards: [
      { ...normalCard, id: "v-private", word: "book", position: 1 },
      { ...normalCard, id: "v-canonical", word: "book", position: 2 },
    ],
  };
  const service = createLearningService({
    async get(url, options) {
      calls.push(["GET", url, options]);
      return { data: { data: duplicateWordSet } };
    },
    async post(url, input) {
      calls.push(["POST", url, input]);
      throw new Error("NORMAL reads must not issue a Learning write.");
    },
  });

  const result = await service.getLearningSet("set/id", { mode: "NORMAL" });

  assert.deepEqual(
    result.cards.map(({ id, word, position }) => ({ id, word, position })),
    [
      { id: "v-private", word: "book", position: 1 },
      { id: "v-canonical", word: "book", position: 2 },
    ],
  );
  assert.deepEqual(calls, [
    ["GET", "/api/learning/sets/set%2Fid", { params: { mode: "NORMAL" } }],
  ]);
});

test("NORMAL response validation rejects malformed identity, word, position and total count", async () => {
  for (const malformedSet of [
    { ...normalSet, cards: [{ ...normalCard, id: null }] },
    { ...normalSet, cards: [{ ...normalCard, word: null }] },
    { ...normalSet, cards: [{ ...normalCard, position: -1 }] },
    { ...normalSet, total_items: 2 },
  ]) {
    await assert.rejects(
      createLearningService({
        async get() { return { data: { data: malformedSet } }; },
      }).getLearningSet("set", { mode: "NORMAL" }),
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
const SESSION_ID = "33333333-3333-4333-8333-333333333333";
const SET_ID = "44444444-4444-4444-8444-444444444444";
const VOCABULARY_ID = "55555555-5555-4555-8555-555555555555";
const xpLevel = Object.freeze({ total_xp: 50, level: 2, level_min_xp: 50, next_level_xp: 150, is_max_level: false });
const reward = Object.freeze({ source_event_id: "22222222-2222-4222-8222-222222222222", xp_earned: 3, replayed: false, ...xpLevel });
const previews = Object.freeze({ AGAIN: { kind: "SESSION_REQUEUE", interval_days: null }, HARD: { kind: "SCHEDULED", interval_days: 1 }, GOOD: { kind: "SCHEDULED", interval_days: 3 }, EASY: { kind: "SCHEDULED", interval_days: 7 } });
const card = Object.freeze({ id: "v", word: "book", position: 1, meanings: [], progress: { effective_status: "NEW", stage: 0, interval_days: null, next_review_at: null, review_count: 0, revision: 0 }, rating_previews: previews });
const srsSet = Object.freeze({ id: "s", name: "Set", mode: "SRS", evaluated_at: NOW, total_items: 1, eligible_count: 1, next_review_at: null, cards: [card] });
const normalCard = { ...card };
delete normalCard.rating_previews;
Object.freeze(normalCard);
const normalSet = Object.freeze({ id: "s", name: "Set", mode: "NORMAL", total_items: 1, cards: [normalCard] });
const ratingProgress = Object.freeze({ vocabulary_id: "v", status: "LEARNED", effective_status: "LEARNED", stage: 1, interval_days: 1, next_review_at: "2026-10-05T03:15:00.000Z", last_reviewed_at: NOW, review_count: 1, revision: 1, reward });
const learningProgress = Object.freeze({ evaluated_at: NOW, xp_level: xpLevel, summary: { total_started: 1, learning: 0, learned: 1, needs_review: 0 }, items: [{ vocabulary: { id: "v", word: "book", phonetic: null }, status: "LEARNED", review_count: 1, last_reviewed_at: NOW, interval_days: 1, next_review_at: "2026-10-05T03:15:00.000Z" }], pagination: { page: 1, page_size: 20, total_items: 1, total_pages: 1 }, filter: { status: null } });
const streak = Object.freeze({ current_streak: 1, completed_today: true, last_qualified_date: "2026-10-04", timezone: "Asia/Ho_Chi_Minh", evaluated_at: NOW });
function srsSession({ state = "ACTIVE", completed_at = null, completed_items = 0, evidence = null } = {}) {
  return {
    id: SESSION_ID, set_id: SET_ID, mode: "SRS", state,
    created_at: "2026-10-04T03:00:00.000Z", expires_at: "2026-10-11T03:00:00.000Z",
    completed_at, snapshot_size: 1, completed_items,
    items: [{ vocabulary_id: VOCABULARY_ID, position: 0, evidence }],
  };
}
