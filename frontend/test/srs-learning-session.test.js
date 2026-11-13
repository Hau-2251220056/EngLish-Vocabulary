import assert from "node:assert/strict";
import test from "node:test";
import {
  acceptSrsRatingProjection,
  openPassLinkedSrsSession,
  openSrsLearningSession,
  reconcileSrsLearningSession,
} from "../src/learning/srs-learning-session.js";
import {
  clearLearningSessionState,
  loadLearningSessionState,
} from "../src/session-storage/learning-session-state.js";

const IDENTITY = Object.freeze({
  userId: "user",
  setId: "22222222-2222-4222-8222-222222222222",
  mode: "SRS",
});
const SESSION = "33333333-3333-4333-8333-333333333333";
const ITEM = "44444444-4444-4444-8444-444444444444";
const OPERATION = "55555555-5555-4555-8555-555555555555";
const PASS = "66666666-6666-4666-8666-666666666666";

test("SRS create persists pending identity, accepts backend snapshot and resumes by read", async () => {
  const storage = memoryStorage();
  const calls = [];
  const service = {
    async createSession(request) {
      calls.push(["create", request]);
      return { session: projection(), replayed: false };
    },
    async readSession(id) {
      calls.push(["read", id]);
      return projection();
    },
  };
  const created = await openSrsLearningSession({
    storage, identity: IDENTITY, service, randomUuid: () => OPERATION,
  });
  assert.equal(created.session_id, SESSION);
  assert.deepEqual(calls[0][1], {
    operation_id: OPERATION, set_id: IDENTITY.setId, mode: "SRS",
  });
  const resumed = await openSrsLearningSession({
    storage, identity: IDENTITY, service, randomUuid: () => "unused",
  });
  assert.equal(resumed.session_id, SESSION);
  assert.deepEqual(calls[1], ["read", SESSION]);
});

test("rating and terminal reconciliation persist only authoritative backend projection", async () => {
  const storage = memoryStorage();
  const active = await openSrsLearningSession({
    storage, identity: IDENTITY,
    service: { createSession: async () => ({ session: projection(), replayed: false }), readSession: async () => projection() },
    randomUuid: () => OPERATION,
  });
  const accepted = acceptSrsRatingProjection({
    storage, identity: IDENTITY, state: active,
    backendSession: projection({ completed_items: 1, items: [item("SRS_GOOD")] }),
  });
  assert.deepEqual(accepted.acknowledged_ids, [ITEM]);
  const expired = await reconcileSrsLearningSession({
    storage, identity: IDENTITY, state: accepted,
    service: { readSession: async () => projection({ state: "EXPIRED" }) },
  });
  assert.equal(expired.view_state, "EXPIRED");
  assert.equal(loadLearningSessionState(storage, IDENTITY).view_state, "EXPIRED");
});

test("CEFR SRS creates from the pass, stores exact identity and resumes the same backend queue", async () => {
  const storage = memoryStorage();
  const identity = { ...IDENTITY, passId: PASS };
  const calls = [];
  const session = { ...projection(), cards: [card()], evaluated_at: "2026-10-18T00:00:00.000Z" };
  const dependencies = {
    storage, identity, passId: PASS,
    pathService: { async createNextSession(passId, operationId, mode) {
      calls.push(["create", passId, operationId, mode]);
      return { session: projection(), cards: [card()], evaluated_at: session.evaluated_at, replayed: false, resumed: false };
    } },
    sessionService: { async readSession(id) { calls.push(["read", id]); return session; } },
    runOperation: async ({ execute, randomUuid }) => execute(randomUuid()),
    randomUuid: () => OPERATION,
  };
  const created = await openPassLinkedSrsSession(dependencies);
  assert.equal(created.session_state.pass_id, PASS);
  assert.deepEqual(calls[0], ["create", PASS, OPERATION, "SRS"]);
  const resumed = await openPassLinkedSrsSession(dependencies);
  assert.equal(resumed.session_state.session_id, SESSION);
  assert.deepEqual(calls[1], ["read", SESSION]);
  assert.equal(resumed.cards[0].id, ITEM);
  clearLearningSessionState(storage, identity);
});

test("CEFR SRS keeps PASS_READY explicit and rejects cross-pass rating evidence", async () => {
  const storage = memoryStorage();
  const identity = { ...IDENTITY, passId: PASS };
  const ready = await openPassLinkedSrsSession({
    storage, identity, passId: PASS,
    pathService: { createNextSession: async () => ({ session: null, reason: "PASS_READY_TO_COMPLETE", replayed: false }) },
    sessionService: { readSession: async () => { throw new Error("must not read"); } },
    runOperation: async ({ execute, randomUuid }) => execute(randomUuid()),
    randomUuid: () => OPERATION,
  });
  assert.equal(ready.reason, "PASS_READY_TO_COMPLETE");
  assert.equal(ready.session_state, null);
  assert.throws(() => acceptSrsRatingProjection({
    storage, identity, state: null, backendSession: projection(),
    cefrPass: { id: SESSION },
  }), /does not match/);
});

test("CEFR SRS can restore a Backend-listed exact session without local storage", async () => {
  const storage = memoryStorage();
  const identity = { ...IDENTITY, passId: PASS };
  let created = false;
  const opened = await openPassLinkedSrsSession({
    storage, identity, passId: PASS, exactSessionId: SESSION,
    pathService: { createNextSession: async () => { created = true; } },
    sessionService: { readSession: async (id) => ({
      ...projection(), cards: [card()], evaluated_at: "2026-10-18T00:00:00.000Z",
      requested_id: id,
    }) },
    runOperation: async () => { throw new Error("must not create"); },
    randomUuid: () => OPERATION,
  });
  assert.equal(opened.session_state.session_id, SESSION);
  assert.equal(created, false);
  assert.equal(loadLearningSessionState(storage, identity).session_id, SESSION);
  clearLearningSessionState(storage, identity);
});

function projection(overrides = {}) {
  return {
    id: SESSION, set_id: IDENTITY.setId, mode: "SRS", state: "ACTIVE",
    created_at: "2026-10-18T00:00:00.000Z", expires_at: "2026-10-25T00:00:00.000Z",
    completed_at: null, snapshot_size: 1, completed_items: 0, items: [item(null)],
    ...overrides,
  };
}

function item(evidence) {
  return { vocabulary_id: ITEM, position: 0, evidence };
}

function card() {
  return {
    id: ITEM, word: "book", position: 0, meanings: [],
    progress: { effective_status: "NEW", stage: 0, interval_days: null, next_review_at: null, review_count: 0, revision: 0 },
    rating_previews: { AGAIN: { kind: "SESSION_REQUEUE", interval_days: null }, HARD: { kind: "SCHEDULED", interval_days: 1 }, GOOD: { kind: "SCHEDULED", interval_days: 3 }, EASY: { kind: "SCHEDULED", interval_days: 7 } },
  };
}

function memoryStorage() {
  const values = new Map();
  return {
    get length() { return values.size; },
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, String(value)),
  };
}
