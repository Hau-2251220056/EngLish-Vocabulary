import assert from "node:assert/strict";
import test from "node:test";
import { LearningApiError, createLearningService } from "../src/services/learning-service.js";

const SET_ALPHA = "10000000-0000-4000-8000-000000000001";
const SET_BETA = "10000000-0000-4000-8000-000000000002";
const NOW = "2026-11-08T12:00:00.000Z";

test("Review Center service reads the approved endpoint and preserves non-additive counts", async () => {
  const calls = [];
  const value = {
    evaluated_at: NOW,
    due_count: 2,
    has_due_items: true,
    nearest_future_review_at: null,
    sets: [
      { set_id: SET_ALPHA, name: "Alpha", due_count: 2, set_scope: "PUBLIC" },
      { set_id: SET_BETA, name: "Beta", due_count: 1, set_scope: "PERSONAL" },
    ],
  };
  const service = createLearningService({
    async get(url) {
      calls.push(["GET", url]);
      return { data: { success: true, data: value } };
    },
  });

  assert.deepEqual(await service.getReviewCenterSummary(), value);
  assert.deepEqual(calls, [["GET", "/api/learning/review/center"]]);
  assert.ok(value.sets.reduce((sum, set) => sum + set.due_count, 0) > value.due_count);
});

test("Review Center service accepts the authoritative zero-due response", async () => {
  const value = {
    evaluated_at: NOW,
    due_count: 0,
    has_due_items: false,
    nearest_future_review_at: "2026-11-09T12:00:00.000Z",
    sets: [],
  };
  const service = createLearningService({
    async get() { return { data: { success: true, data: value } }; },
  });
  assert.deepEqual(await service.getReviewCenterSummary(), value);
});

test("Review Center service rejects malformed or misleading summaries", async () => {
  const valid = {
    evaluated_at: NOW,
    due_count: 2,
    has_due_items: true,
    nearest_future_review_at: null,
    sets: [{ set_id: SET_ALPHA, name: "Alpha", due_count: 2, set_scope: "PUBLIC" }],
  };
  for (const value of [
    { ...valid, due_count: undefined },
    { ...valid, has_due_items: false },
    { ...valid, evaluated_at: "invalid" },
    { ...valid, sets: [{ ...valid.sets[0], due_count: 0 }] },
    { ...valid, sets: [{ ...valid.sets[0], set_id: "not-a-uuid" }] },
    { ...valid, sets: [{ ...valid.sets[0], set_scope: undefined }] },
    { ...valid, sets: [{ ...valid.sets[0], set_scope: "PRIVATE" }] },
    { ...valid, sets: [valid.sets[0], valid.sets[0]] },
    { ...valid, sets: [] },
    { ...valid, due_count: 0, has_due_items: false },
  ]) {
    await assert.rejects(
      createLearningService({ async get() { return { data: { data: value } }; } })
        .getReviewCenterSummary(),
      { code: "INVALID_LEARNING_RESPONSE" },
    );
  }
});

test("Review Center service preserves API and transport error mapping", async () => {
  await assert.rejects(
    createLearningService({
      async get() {
        throw { response: { status: 401, data: { error: { code: "AUTHENTICATION_FAILED", message: "Authentication failed." } } } };
      },
    }).getReviewCenterSummary(),
    (error) => error instanceof LearningApiError
      && error.code === "AUTHENTICATION_FAILED" && error.status === 401,
  );
  await assert.rejects(
    createLearningService({ async get() { throw new Error("offline"); } })
      .getReviewCenterSummary(),
    (error) => error instanceof LearningApiError
      && error.kind === "operational" && error.code === "LEARNING_REQUEST_FAILED",
  );
});
