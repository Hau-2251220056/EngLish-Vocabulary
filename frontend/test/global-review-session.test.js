import assert from "node:assert/strict";
import test from "node:test";
import { applyGlobalReviewRating, createGlobalReviewQueue, createReviewSessionWithReplay, submitReviewRatingWithReplay } from "../src/learning/global-review-session.js";

const OPERATION_ID = "10000000-0000-4000-8000-000000000001";
const EVENT_ID = "10000000-0000-4000-8000-000000000002";

test("GLOBAL queue resolves passing ratings and requeues AGAIN after up to three cards", () => {
  const queue = ["a", "b", "c", "d", "e"];
  assert.deepEqual(applyGlobalReviewRating(queue, "a", "AGAIN"), ["b", "c", "d", "a", "e"]);
  assert.deepEqual(applyGlobalReviewRating(queue, "a", "GOOD"), ["b", "c", "d", "e"]);
  assert.deepEqual(applyGlobalReviewRating(queue, "x", "GOOD"), queue);
  assert.deepEqual(createGlobalReviewQueue({ items: [{ vocabulary_id: "a", evidence: null }, { vocabulary_id: "b", evidence: "SRS_GOOD" }] }), ["a"]);
});

test("lost create response reuses the exact operation identity", async () => {
  const storage = memoryStorage();
  let calls = 0;
  const service = { async createGlobalReviewSession(operationId) { calls += 1; assert.equal(operationId, OPERATION_ID); if (calls === 1) throw new Error("lost"); return { session: null }; } };
  const input = { storage, service, randomUuid: () => OPERATION_ID };
  await assert.rejects(createReviewSessionWithReplay(input), /lost/);
  await createReviewSessionWithReplay({ ...input, randomUuid: () => { throw new Error("must not replace identity"); } });
  assert.equal(calls, 2);
});

test("lost rating response retains storage metadata but retries the same API event without it", async () => {
  const storage = memoryStorage();
  const request = {
    set_id: null,
    vocabulary_id: "10000000-0000-4000-8000-000000000003",
    expected_revision: 4,
    rating: "AGAIN",
    session_id: "10000000-0000-4000-8000-000000000004",
  };
  const calls = [];
  const service = {
    async recordMeaningfulEvent(event) {
      calls.push(event);
      assert.equal(Object.hasOwn(event, "version"), false);
      if (calls.length === 1) throw new Error("lost");
      return { accepted: true };
    },
  };
  const input = { storage, service, request, randomUuid: () => EVENT_ID };

  await assert.rejects(submitReviewRatingWithReplay(input), /lost/);
  assert.deepEqual(JSON.parse(storage.getItem("elvocab.global-review.event.v1")), {
    version: 1,
    ...request,
    event_id: EVENT_ID,
  });
  await submitReviewRatingWithReplay({
    ...input,
    randomUuid: () => { throw new Error("must not replace identity"); },
  });

  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0], { ...request, event_id: EVENT_ID });
  assert.deepEqual(calls[1], calls[0]);
  assert.equal(storage.getItem("elvocab.global-review.event.v1"), null);
});

function memoryStorage() { const values = new Map(); return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) }; }
