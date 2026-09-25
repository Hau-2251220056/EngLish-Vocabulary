import assert from "node:assert/strict";
import test from "node:test";
import {
  LearningApiError,
  createLearningService,
} from "../src/services/learning-service.js";

test("Learning service uses only the approved Learning endpoints", async () => {
  const calls = [];
  const service = createLearningService(createClient(calls));
  const event = {
    event_id: "event-id",
    set_id: "set-id",
    vocabulary_id: "vocabulary-id",
    expected_revision: 0,
    outcome: "REMEMBERED",
  };

  assert.deepEqual(await service.getLearningSet("set/id"), learningSet);
  assert.deepEqual(await service.recordMeaningfulEvent(event), progress);
  assert.deepEqual(
    await service.getLearningProgress({
      page: 2,
      page_size: 10,
      status: "LEARNED",
    }),
    learningProgress,
  );
  assert.deepEqual(calls, [
    ["GET", "/api/learning/sets/set%2Fid"],
    ["POST", "/api/learning/events", event],
    [
      "GET",
      "/api/learning/progress",
      { params: { page: 2, page_size: 10, status: "LEARNED" } },
    ],
  ]);
});

test("Learning service maps approved not-found, conflict and operational failures", async () => {
  await assert.rejects(
    createLearningService({
      async get() {
        throw {
          response: {
            status: 404,
            data: { error: { code: "LEARNING_SET_NOT_FOUND", message: "Missing." } },
          },
        };
      },
    }).getLearningSet("missing"),
    (error) => {
      assert.equal(error instanceof LearningApiError, true);
      assert.equal(error.kind, "not-found");
      assert.equal(error.code, "LEARNING_SET_NOT_FOUND");
      return true;
    },
  );

  await assert.rejects(
    createLearningService({
      async post() {
        throw {
          response: {
            status: 409,
            data: {
              error: { code: "LEARNING_PROGRESS_CHANGED", message: "Changed." },
            },
          },
        };
      },
    }).recordMeaningfulEvent({}),
    (error) => {
      assert.equal(error.kind, "conflict");
      assert.equal(error.status, 409);
      return true;
    },
  );

  await assert.rejects(
    createLearningService({ async get() { throw new Error("network detail"); } })
      .getLearningSet("set"),
    (error) => {
      assert.equal(error.kind, "operational");
      assert.equal(error.code, "LEARNING_REQUEST_FAILED");
      return true;
    },
  );
});

test("Learning service rejects malformed success envelopes", async () => {
  const invalidSetService = createLearningService({
    async get() { return { data: { data: { id: "set", cards: null } } }; },
  });
  const invalidProgressService = createLearningService({
    async post() { return { data: { data: { status: "LEARNED" } } }; },
  });

  await assert.rejects(invalidSetService.getLearningSet("set"), {
    code: "INVALID_LEARNING_RESPONSE",
  });
  await assert.rejects(invalidProgressService.recordMeaningfulEvent({}), {
    code: "INVALID_LEARNING_RESPONSE",
  });

  await assert.rejects(
    createLearningService({
      async get() {
        return {
          data: {
            data: {
              ...learningProgress,
              summary: { ...learningProgress.summary, total_started: 99 },
            },
          },
        };
      },
    }).getLearningProgress(),
    { code: "INVALID_LEARNING_RESPONSE" },
  );
});

test("Learning service rejects unsupported progress queries before transport", async () => {
  const calls = [];
  const service = createLearningService(createClient(calls));
  for (const query of [
    { page: 0 },
    { page_size: 101 },
    { status: "NEW" },
    { search: "word" },
  ]) {
    await assert.rejects(service.getLearningProgress(query), {
      code: "INVALID_LEARNING_PROGRESS_QUERY",
    });
  }
  assert.deepEqual(calls, []);
});

function createClient(calls) {
  return {
    async get(url, options) {
      calls.push(options ? ["GET", url, options] : ["GET", url]);
      return {
        data: {
          data: url.endsWith("/progress") ? learningProgress : learningSet,
        },
      };
    },
    async post(url, input) {
      calls.push(["POST", url, input]);
      return { data: { data: progress } };
    },
  };
}

const learningSet = Object.freeze({ id: "set-id", name: "Set", cards: [] });
const progress = Object.freeze({
  status: "LEARNED",
  review_count: 1,
  revision: 1,
  last_reviewed_at: "2026-09-23T00:00:00.000Z",
});
const learningProgress = Object.freeze({
  summary: {
    total_started: 2,
    learning: 1,
    learned: 1,
    needs_review: 0,
  },
  items: [
    {
      vocabulary: { id: "vocabulary-id", word: "word", phonetic: null },
      status: "LEARNED",
      review_count: 2,
      last_reviewed_at: "2026-09-24T00:00:00.000Z",
    },
  ],
  pagination: {
    page: 2,
    page_size: 10,
    total_items: 2,
    total_pages: 1,
  },
  filter: { status: "LEARNED" },
});
