import assert from "node:assert/strict";
import test from "node:test";
import { applyGlobalReviewRating, createGlobalReviewQueue, createReviewSessionWithReplay } from "../src/learning/global-review-session.js";

const OPERATION_ID = "10000000-0000-4000-8000-000000000001";

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

function memoryStorage() { const values = new Map(); return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) }; }
