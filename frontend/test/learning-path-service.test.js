import assert from "node:assert/strict";
import test from "node:test";
import {
  createLearningPathService,
  LearningPathApiError,
  requirePassProjection,
  requirePathProjection,
} from "../src/services/learning-path-service.js";

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

test("mode-aware pass sessions keep NORMAL backward compatible and accept Backend-authored SRS cards", async () => {
  const requests = [];
  const client = { post: async (url, body) => {
    requests.push({ url, body });
    return { data: { data: body.mode === "SRS"
      ? { session: sessionProjection({ mode: "SRS" }), cards: [srsCard()], evaluated_at: instant, replayed: false, resumed: false }
      : { session: sessionProjection(), replayed: false, resumed: false } } };
  } };
  const service = createLearningPathService(client);
  await service.createNextSession(ids.pass, ids.operation);
  const srs = await service.createNextSession(ids.pass, ids.operation, "SRS");
  assert.deepEqual(requests.map(({ body }) => body), [
    { operation_id: ids.operation },
    { operation_id: ids.operation, mode: "SRS" },
  ]);
  assert.equal(srs.cards[0].id, ids.vocabulary);
  await assert.rejects(service.createNextSession(ids.pass, ids.operation, "QUIZ"), {
    code: "INVALID_LEARNING_PATH_REQUEST",
  });
});

test("pass projection validates canonical evidence counts, readiness and active-session summaries", () => {
  const value = passProjection();
  assert.equal(requirePassProjection(value), value);
  for (const malformed of [
    { ...value, credited_items: 1 },
    { ...value, ready_to_complete: true },
    { ...value, evidence_counts: { NORMAL: 0, SRS: 1 } },
    { ...value, active_sessions: { ...value.active_sessions, SRS: [{ ...activeSrsSession(), mode: "NORMAL" }] } },
  ]) assert.throws(() => requirePassProjection(malformed), { code: "INVALID_LEARNING_PATH_RESPONSE" });
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

function sessionProjection(overrides = {}) {
  return {
    id: ids.session, set_id: ids.set, mode: "NORMAL", state: "ACTIVE",
    created_at: instant, expires_at: "2026-11-10T00:00:00.000Z", completed_at: null,
    snapshot_size: 1, completed_items: 0,
    items: [{ vocabulary_id: ids.vocabulary, position: 0, evidence: null }],
    ...overrides,
  };
}

function passProjection() {
  return {
    id: ids.pass, set_id: ids.set, state: "ACTIVE", snapshot_size: 1,
    studied_items: 0, credited_items: 0, remaining_items: 1,
    ready_to_complete: false, evidence_counts: { NORMAL: 0, SRS: 0 },
    activity_state: "PRISTINE", active_sessions: { NORMAL: [], SRS: [] },
    created_at: instant, completed_at: null,
  };
}

function activeSrsSession() {
  return {
    id: ids.session, mode: "SRS", state: "ACTIVE",
    expires_at: "2026-11-10T00:00:00.000Z", contains_uncredited_items: true,
    unresolved_items: 1, exact_resume_available: true,
  };
}

function srsCard() {
  return {
    id: ids.vocabulary, word: "book", position: 0, meanings: [],
    progress: { effective_status: "NEW", stage: 0, interval_days: null, next_review_at: null, review_count: 0, revision: 0 },
    rating_previews: {
      AGAIN: { kind: "SESSION_REQUEUE", interval_days: null },
      HARD: { kind: "SCHEDULED", interval_days: 1 },
      GOOD: { kind: "SCHEDULED", interval_days: 3 },
      EASY: { kind: "SCHEDULED", interval_days: 7 },
    },
  };
}
