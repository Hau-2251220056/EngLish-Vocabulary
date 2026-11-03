import assert from "node:assert/strict";
import test from "node:test";
import { createLearningService, LearningApiError } from "../src/services/learning-service.js";

const OPERATION_ID = "10000000-0000-4000-8000-000000000001";

test("global review summary validates authoritative due and future state", async () => {
  const client = { get: async () => ({ data: { data: { due_count: 2, has_due_items: true, evaluated_at: "2026-11-03T00:00:00.000Z", nearest_future_review_at: "2026-11-04T00:00:00.000Z" } } }) };
  const result = await createLearningService(client).getGlobalReviewSummary();
  assert.equal(result.due_count, 2);
});

test("global review create sends only operation identity and accepts stable empty reason", async () => {
  let request;
  const client = { post: async (url, body) => { request = { url, body }; return { data: { data: { session: null, cards: [], reason: "REVIEW_UP_TO_DATE", evaluated_at: "2026-11-03T00:00:00.000Z", nearest_future_review_at: null, replayed: false } } }; } };
  const result = await createLearningService(client).createGlobalReviewSession(OPERATION_ID);
  assert.deepEqual(request, { url: "/api/learning/review/sessions", body: { operation_id: OPERATION_ID } });
  assert.equal(result.session, null);
});

test("global review errors retain stable domain codes", async () => {
  const client = { get: async () => { throw { response: { status: 409, data: { error: { code: "LEARNING_SESSION_INACCESSIBLE", message: "inaccessible" } } } }; } };
  await assert.rejects(createLearningService(client).getGlobalReviewSummary(), (error) => error instanceof LearningApiError && error.code === "LEARNING_SESSION_INACCESSIBLE");
});
