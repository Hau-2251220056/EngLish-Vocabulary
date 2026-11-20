import assert from "node:assert/strict";
import test from "node:test";
import { createGlobalReviewAuthorizer, createLearningService } from "../../src/services/learning-service.js";

const USER_ID = "10000000-0000-4000-8000-000000000001";
const OPERATION_ID = "20000000-0000-4000-8000-000000000002";
const SESSION_ID = "30000000-0000-4000-8000-000000000003";
const NOW = new Date("2026-11-03T00:00:00.000Z");

test("global review summary reports exact due count and nearest accessible future review", async () => {
  const candidates = [candidate(1, { due: true }), candidate(2, { future: "2026-11-04T00:00:00.000Z" }), candidate(3, { future: "2026-11-05T00:00:00.000Z" })];
  const service = serviceWith(candidates);
  assert.deepEqual(await service.getGlobalReviewSummary(USER_ID), {
    due_count: 1, has_due_items: true, evaluated_at: NOW,
    nearest_future_review_at: new Date("2026-11-04T00:00:00.000Z"),
  });
});

test("global review creates one GLOBAL SRS snapshot capped at ten exact IDs", async () => {
  const candidates = Array.from({ length: 12 }, (_, index) => candidate(index + 1, { due: true, word: "same" }));
  const service = serviceWith(candidates);
  const result = await service.createGlobalReviewSession(USER_ID, { operation_id: OPERATION_ID });
  assert.equal(result.session.scope, "GLOBAL");
  assert.equal(result.session.set_id, null);
  assert.equal(result.session.mode, "SRS");
  assert.equal(result.session.snapshot_size, 10);
  assert.equal(new Set(result.cards.map(({ id }) => id)).size, 10);
  assert.ok(result.cards.every(({ word }) => word === "same"));
});

test("global review authorizer checks every unresolved exact ID against current unlocked reachability", async () => {
  const checked = [];
  const authorize = createGlobalReviewAuthorizer({
    createLearningRepository: () => ({
      async isReviewVocabularyReachable(userId, vocabularyId, levels) {
        checked.push({ userId, vocabularyId, levels });
        return vocabularyId !== vocabularyIdFor(2) ? { id: vocabularyId } : null;
      },
    }),
    createLearningPathRepository: () => ({ findPathState: async () => ({ highest_unlocked_level: "B1" }) }),
  });
  await assert.rejects(
    authorize({}, USER_ID, [{ vocabulary_id: vocabularyIdFor(1) }, { vocabulary_id: vocabularyIdFor(2) }]),
    (error) => error.code === "LEARNING_SESSION_INACCESSIBLE",
  );
  assert.deepEqual(checked[0].levels, ["A1", "A2", "B1"]);
  assert.equal(checked.length, 2);
});

function serviceWith(candidates) {
  const repository = {
    withTransaction: (callback) => callback(repository, {}),
    listReachableReviewCandidates: async () => candidates,
  };
  const sessionRepository = {
    findCreationReplay: async () => null,
    createSessionWithItems: async (input) => ({
      ...input, status: "ACTIVE", completed_at: null, completion_event_id: null,
      items: input.items.map((item, index) => ({ id: vocabularyIdFor(80 + index), evidence: null, evidence_event_id: null, evidence_at: null, ...item })),
    }),
  };
  return createLearningService({
    learningRepository: repository,
    createSessionRepository: () => sessionRepository,
    createStreakRepository: () => ({}),
    createLearningPathRepository: () => ({ findPathState: async () => null }),
    authorizeGlobalReview: async () => true,
    now: () => NOW,
    uuid: () => SESSION_ID,
  });
}

function candidate(number, { due = false, future = null, word = `word-${number}` } = {}) {
  return {
    id: vocabularyIdFor(60 + number), user_id: USER_ID, vocabulary_id: vocabularyIdFor(number),
    status: due ? "NEEDS_REVIEW" : "LEARNED", review_count: 1, revision: 1,
    last_reviewed_at: new Date("2026-11-01T00:00:00.000Z"), last_event_id: null,
    interval_days: 1, next_review_at: new Date(future ?? (due ? "2026-11-02T00:00:00.000Z" : "2026-11-04T00:00:00.000Z")),
    vocabulary: { id: vocabularyIdFor(number), word, phonetic: null, pronunciation_url: null, meanings: [] },
  };
}
function vocabularyIdFor(number) { return `40000000-0000-4000-8000-${String(number).padStart(12, "0")}`; }
