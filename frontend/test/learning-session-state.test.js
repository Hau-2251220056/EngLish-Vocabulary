import assert from "node:assert/strict";
import test from "node:test";
import {
  acceptLearningSessionCreation,
  clearLearningSessionState,
  clearPendingLearningSessionCreation,
  createLearningSessionWithPendingReplay,
  loadLearningSessionState,
  loadPendingLearningSessionCreation,
  prepareLearningSessionCreation,
  reconcileLearningSessionState,
  saveLearningSessionState,
  selectLearningSessionCursor,
} from "../src/session-storage/learning-session-state.js";

const IDENTITY = Object.freeze({ userId: "user", setId: "22222222-2222-4222-8222-222222222222", mode: "NORMAL" });
const SESSION_ID = "33333333-3333-4333-8333-333333333333";
const FIRST = "44444444-4444-4444-8444-444444444444";
const SECOND = "55555555-5555-4555-8555-555555555555";

test("storage persists only Backend identity, expiry and presentation cursor/state", () => {
  const storage = memoryStorage();
  let state = reconcileLearningSessionState(null, IDENTITY, session());
  state = selectLearningSessionCursor(state, SECOND);
  assert.equal(saveLearningSessionState(storage, state), true);
  const raw = [...storage.values()][0];
  assert.deepEqual(Object.keys(JSON.parse(raw)).sort(), [
    "creation_operation_id", "cursor_vocabulary_id", "expires_at", "mode", "session_id", "set_id", "user_id", "version", "view_state",
  ]);
  assert.equal(raw.includes("acknowledged_ids"), false);
  assert.equal(raw.includes("item_ids"), false);
  const loaded = loadLearningSessionState(storage, IDENTITY);
  assert.equal(loaded.cursor_vocabulary_id, SECOND);
  assert.equal(loaded.needs_reconciliation, true);
  assert.deepEqual(loaded.acknowledged_ids, []);
  assert.deepEqual(loaded.item_ids, []);
});

test("presentation cursor can only select an item from the Backend snapshot", () => {
  const state = reconcileLearningSessionState(null, IDENTITY, session());
  assert.equal(selectLearningSessionCursor(state, SECOND).cursor_vocabulary_id, SECOND);
  assert.equal(selectLearningSessionCursor(state, SESSION_ID), state);
});

test("Backend-ahead evidence wins after lost responses and local state never fabricates evidence", () => {
  const storage = memoryStorage();
  const initial = reconcileLearningSessionState(null, IDENTITY, session());
  saveLearningSessionState(storage, initial);
  const backendAhead = session({ completed_items: 1, items: [
    { vocabulary_id: FIRST, position: 0, evidence: "NORMAL_REVEALED" },
    { vocabulary_id: SECOND, position: 1, evidence: null },
  ] });
  const reconciled = reconcileLearningSessionState(loadLearningSessionState(storage, IDENTITY), IDENTITY, backendAhead);
  assert.deepEqual(reconciled.acknowledged_ids, [FIRST]);
  assert.equal(reconciled.cursor_vocabulary_id, FIRST);
  assert.equal(reconciled.needs_reconciliation, false);
});

test("expired, inaccessible and completed Backend states drive restart/read behavior", () => {
  const expired = reconcileLearningSessionState(null, IDENTITY, session({ state: "EXPIRED" }));
  assert.equal(expired.restart_required, true);
  assert.equal(expired.can_continue, false);
  const inaccessible = reconcileLearningSessionState(null, IDENTITY, {
    ...session(), can_continue: false, restart_reason: "SESSION_INACCESSIBLE",
  });
  assert.equal(inaccessible.view_state, "INACCESSIBLE");
  assert.equal(inaccessible.restart_required, true);
  const completed = reconcileLearningSessionState(null, IDENTITY, session({
    state: "COMPLETED", completed_at: "2026-10-18T00:02:00.000Z", completed_items: 2,
    items: [
      { vocabulary_id: FIRST, position: 0, evidence: "NORMAL_REVEALED" },
      { vocabulary_id: SECOND, position: 1, evidence: "NORMAL_REVEALED" },
    ],
  }));
  assert.equal(completed.view_state, "COMPLETED");
  assert.equal(completed.restart_required, false);
  assert.equal(completed.can_continue, false);
});

test("wrong identity/session and incompatible storage fail closed", () => {
  assert.throws(() => reconcileLearningSessionState(null, { ...IDENTITY, setId: "other" }, session()), TypeError);
  const storage = memoryStorage();
  const state = reconcileLearningSessionState(null, IDENTITY, session());
  saveLearningSessionState(storage, state);
  const key = storage.keys()[0];
  storage.setItem(key, JSON.stringify({ ...JSON.parse(storage.getItem(key)), version: 0 }));
  assert.equal(loadLearningSessionState(storage, IDENTITY), null);
  assert.equal(storage.getItem(key), null);
});

test("clear removes only the selected USER/Set/mode record", () => {
  const storage = memoryStorage();
  saveLearningSessionState(storage, reconcileLearningSessionState(null, IDENTITY, session()));
  const other = { ...IDENTITY, userId: "other" };
  saveLearningSessionState(storage, reconcileLearningSessionState(null, other, session()));
  clearLearningSessionState(storage, IDENTITY);
  assert.equal(loadLearningSessionState(storage, IDENTITY), null);
  assert.notEqual(loadLearningSessionState(storage, other), null);
});

test("unknown create result survives refresh and exact retry reuses the operation UUID", () => {
  const storage = memoryStorage();
  const firstOperation = "66666666-6666-4666-8666-666666666666";
  const replacementOperation = "77777777-7777-4777-8777-777777777777";
  assert.equal(prepareLearningSessionCreation(storage, IDENTITY, firstOperation).creation_operation_id, firstOperation);
  assert.equal(loadPendingLearningSessionCreation(storage, IDENTITY).creation_operation_id, firstOperation);
  assert.equal(prepareLearningSessionCreation(storage, IDENTITY, replacementOperation).creation_operation_id, firstOperation);

  const accepted = acceptLearningSessionCreation(storage, IDENTITY, firstOperation, session());
  assert.equal(accepted.session_id, SESSION_ID);
  assert.equal(loadPendingLearningSessionCreation(storage, IDENTITY), null);
  assert.equal(loadLearningSessionState(storage, IDENTITY).session_id, SESSION_ID);
  assert.equal(loadLearningSessionState(storage, IDENTITY).creation_operation_id, firstOperation);
});

test("create orchestration persists before request, retains unknown results and transitions on success", async () => {
  const storage = memoryStorage();
  const firstOperation = "66666666-6666-4666-8666-666666666666";
  const replacementOperation = "77777777-7777-4777-8777-777777777777";
  await assert.rejects(createLearningSessionWithPendingReplay({
    storage, identity: IDENTITY, operationId: firstOperation, vocabularyIds: [FIRST, SECOND],
    createSession: async (request) => {
      assert.equal(loadPendingLearningSessionCreation(storage, IDENTITY).creation_operation_id, firstOperation);
      assert.equal(request.operation_id, firstOperation);
      throw new Error("response lost");
    },
  }), /response lost/);
  assert.equal(loadPendingLearningSessionCreation(storage, IDENTITY).creation_operation_id, firstOperation);

  const result = await createLearningSessionWithPendingReplay({
    storage, identity: IDENTITY, operationId: replacementOperation, vocabularyIds: [FIRST, SECOND],
    createSession: async (request) => {
      assert.equal(request.operation_id, firstOperation);
      return { session: session(), replayed: true };
    },
  });
  assert.equal(result.session_state.session_id, SESSION_ID);
  assert.equal(result.session_state.creation_operation_id, firstOperation);
  assert.equal(loadPendingLearningSessionCreation(storage, IDENTITY), null);
});

test("initial durable storage failure fails closed before the Backend create callback", async () => {
  const storage = failingStorage(({ key }) => key.includes("backend-learning-session-create"));
  let backendCalls = 0;
  await assert.rejects(createLearningSessionWithPendingReplay({
    storage,
    identity: IDENTITY,
    operationId: "66666666-6666-4666-8666-666666666666",
    vocabularyIds: [FIRST, SECOND],
    createSession: async () => {
      backendCalls += 1;
      return { session: session(), replayed: false };
    },
  }), /could not be persisted/);
  assert.equal(backendCalls, 0);
  assert.equal(loadPendingLearningSessionCreation(storage, IDENTITY), null);
});

test("accepted-state storage failure retains pending identity for exact recovery retry", async () => {
  let failAcceptedWrite = true;
  const storage = failingStorage(({ key }) => (
    failAcceptedWrite && key.includes("backend-learning-session:v2")
  ));
  const firstOperation = "66666666-6666-4666-8666-666666666666";
  const replacementOperation = "77777777-7777-4777-8777-777777777777";
  let backendCalls = 0;
  await assert.rejects(createLearningSessionWithPendingReplay({
    storage, identity: IDENTITY, operationId: firstOperation, vocabularyIds: [FIRST, SECOND],
    createSession: async (request) => {
      backendCalls += 1;
      assert.equal(request.operation_id, firstOperation);
      return { session: session(), replayed: false };
    },
  }), /could not be persisted/);
  assert.equal(backendCalls, 1);
  assert.equal(loadPendingLearningSessionCreation(storage, IDENTITY).creation_operation_id, firstOperation);

  failAcceptedWrite = false;
  const recovered = await createLearningSessionWithPendingReplay({
    storage, identity: IDENTITY, operationId: replacementOperation, vocabularyIds: [FIRST, SECOND],
    createSession: async (request) => {
      backendCalls += 1;
      assert.equal(request.operation_id, firstOperation);
      return { session: session(), replayed: true };
    },
  });
  assert.equal(backendCalls, 2);
  assert.equal(recovered.session_state.creation_operation_id, firstOperation);
  assert.equal(loadLearningSessionState(storage, IDENTITY).session_id, SESSION_ID);
  assert.equal(loadPendingLearningSessionCreation(storage, IDENTITY), null);
});

test("pending create storage fails closed for malformed, old-version and cross-user records", () => {
  const storage = memoryStorage();
  const operationId = "66666666-6666-4666-8666-666666666666";
  prepareLearningSessionCreation(storage, IDENTITY, operationId);
  const key = storage.keys().find((candidate) => candidate.includes("backend-learning-session-create"));
  const valid = JSON.parse(storage.getItem(key));
  storage.setItem(key, JSON.stringify({ ...valid, version: 0 }));
  assert.equal(loadPendingLearningSessionCreation(storage, IDENTITY), null);

  prepareLearningSessionCreation(storage, IDENTITY, operationId);
  assert.equal(loadPendingLearningSessionCreation(storage, { ...IDENTITY, userId: "other" }), null);
  assert.throws(() => acceptLearningSessionCreation(
    storage, IDENTITY, "77777777-7777-4777-8777-777777777777", session(),
  ), TypeError);
  assert.equal(clearPendingLearningSessionCreation(storage, IDENTITY, "77777777-7777-4777-8777-777777777777"), false);
  assert.notEqual(loadPendingLearningSessionCreation(storage, IDENTITY), null);
});

function session(overrides = {}) {
  return { id: SESSION_ID, set_id: IDENTITY.setId, mode: IDENTITY.mode, state: "ACTIVE",
    created_at: "2026-10-18T00:00:00.000Z", expires_at: "2026-10-25T00:00:00.000Z",
    completed_at: null, snapshot_size: 2, completed_items: 0, items: [
      { vocabulary_id: FIRST, position: 0, evidence: null },
      { vocabulary_id: SECOND, position: 1, evidence: null },
    ], ...overrides };
}
function memoryStorage() {
  const values = new Map();
  return { get length() { return values.size; }, getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null, keys: () => [...values.keys()], values: () => [...values.values()],
    removeItem: (key) => values.delete(key), setItem: (key, value) => values.set(key, String(value)) };
}
function failingStorage(shouldFailSet) {
  const storage = memoryStorage();
  return { ...storage, setItem(key, value) {
    if (shouldFailSet({ key, value })) throw new Error("storage unavailable");
    storage.setItem(key, value);
  } };
}
