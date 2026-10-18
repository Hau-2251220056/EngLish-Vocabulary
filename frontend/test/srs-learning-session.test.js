import assert from "node:assert/strict";
import test from "node:test";
import {
  acceptSrsRatingProjection,
  openSrsLearningSession,
  reconcileSrsLearningSession,
} from "../src/learning/srs-learning-session.js";
import { loadLearningSessionState } from "../src/session-storage/learning-session-state.js";

const IDENTITY = Object.freeze({
  userId: "user",
  setId: "22222222-2222-4222-8222-222222222222",
  mode: "SRS",
});
const SESSION = "33333333-3333-4333-8333-333333333333";
const ITEM = "44444444-4444-4444-8444-444444444444";
const OPERATION = "55555555-5555-4555-8555-555555555555";

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
