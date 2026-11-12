import assert from "node:assert/strict";
import test from "node:test";
import { createLearningPathService, LearningPathApiError, requirePathProjection } from "../src/services/learning-path-service.js";

const ids = {
  set: "10000000-0000-4000-8000-000000000001",
  pass: "20000000-0000-4000-8000-000000000002",
  operation: "30000000-0000-4000-8000-000000000003",
  session: "40000000-0000-4000-8000-000000000004",
  vocabulary: "50000000-0000-4000-8000-000000000005",
};
const instant = "2026-11-03T00:00:00.000Z";

test("learning path service validates the authoritative A1-C1 projection", async () => {
  const client = { get: async () => ({ data: { data: pathProjection() } }) };
  const value = await createLearningPathService(client).getPath();
  assert.equal(value.highest_unlocked_level, "A1");
  assert.equal(value.recommendation.set_id, ids.set);
  assert.equal(value.next_suggestion.set_id, ids.set);
  assert.equal(value.next_suggestion_reason, null);
  assert.equal(client.post, undefined);
});

test("learning path projection accepts only the stable active-empty discriminator", () => {
  const active = pathProjection();
  active.next_suggestion = null;
  active.next_suggestion_reason = "ALL_INCOMPLETE_SETS_ACTIVE";
  assert.equal(requirePathProjection(active), active);

  const unknown = pathProjection();
  unknown.next_suggestion = null;
  unknown.next_suggestion_reason = "UNKNOWN_REASON";
  assert.throws(() => requirePathProjection(unknown), (error) => (
    error instanceof LearningPathApiError && error.code === "INVALID_LEARNING_PATH_RESPONSE"
  ));

  const contradictory = pathProjection();
  contradictory.next_suggestion_reason = "ALL_INCOMPLETE_SETS_ACTIVE";
  assert.throws(() => requirePathProjection(contradictory), (error) => (
    error instanceof LearningPathApiError && error.code === "INVALID_LEARNING_PATH_RESPONSE"
  ));

  const empty = pathProjection();
  empty.next_suggestion = null;
  empty.next_suggestion_reason = "ALL_INCOMPLETE_SETS_ACTIVE";
  empty.levels[0].incomplete_sets = [];
  assert.throws(() => requirePathProjection(empty), (error) => (
    error instanceof LearningPathApiError && error.code === "INVALID_LEARNING_PATH_RESPONSE"
  ));
});

test("learning path mutations submit only operation_id and preserve pass session identity", async () => {
  let request;
  const client = { post: async (url, body) => {
    request = { url, body };
    return { data: { data: { session: sessionProjection(), replayed: false, resumed: false } } };
  } };
  const value = await createLearningPathService(client).createNextSession(ids.pass, ids.operation);
  assert.deepEqual(request, {
    url: `/api/learning-path/passes/${ids.pass}/sessions`,
    body: { operation_id: ids.operation },
  });
  assert.equal(value.session.id, ids.session);
});

test("learning path service exposes stable backend domain errors without string parsing", async () => {
  const client = { post: async () => { throw { response: { status: 403, data: { error: { code: "CEFR_LEVEL_LOCKED", message: "locked" } } } }; } };
  await assert.rejects(
    createLearningPathService(client).startPass(ids.set, ids.operation),
    (error) => error instanceof LearningPathApiError
      && error.kind === "forbidden" && error.code === "CEFR_LEVEL_LOCKED",
  );
});

function pathProjection() {
  return {
    evaluated_at: instant,
    highest_unlocked_level: "A1",
    path_completed_at: null,
    levels: ["A1", "A2", "B1", "B2", "C1"].map((level, index) => ({
      level, unlocked: index === 0, required_count: index === 0 ? 1 : 0,
      completed_count: 0, configuration: index === 0 ? "READY" : "NO_REQUIRED_SETS",
      current_complete: false,
      incomplete_sets: index === 0 ? [{ id: ids.set, name: "A1 starter", created_at: instant }] : [],
    })),
    recommendation: { action: "START", set_id: ids.set, pass_id: null },
    next_suggestion: { action: "START", set_id: ids.set, pass_id: null },
    next_suggestion_reason: null,
    all_current_sets_complete: false,
  };
}

function sessionProjection() {
  return {
    id: ids.session, set_id: ids.set, mode: "NORMAL", state: "ACTIVE",
    created_at: instant, expires_at: "2026-11-10T00:00:00.000Z", completed_at: null,
    snapshot_size: 1, completed_items: 0,
    items: [{ vocabulary_id: ids.vocabulary, position: 0, evidence: null }],
  };
}
