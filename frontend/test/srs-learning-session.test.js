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
  reconcileLearningSessionState,
  saveLearningSessionState,
} from "../src/session-storage/learning-session-state.js";
import {
  preserveOrdinarySrsRating,
  readOrdinarySrsRatingAttempts,
  recoverOrdinarySrsSession,
  settleOrdinarySrsRating,
} from "../src/learning/ordinary-srs-recovery.js";
import { createLearningRunState, reconcileSrsSessionRun } from "../src/learning/learning-run-state.js";

const IDENTITY = Object.freeze({
  userId: "user",
  setId: "22222222-2222-4222-8222-222222222222",
  mode: "SRS",
});
const SESSION = "33333333-3333-4333-8333-333333333333";
const ITEM = "44444444-4444-4444-8444-444444444444";
const OPERATION = "55555555-5555-4555-8555-555555555555";
const PASS = "66666666-6666-4666-8666-666666666666";
const FRESH_SESSION = "77777777-7777-4777-8777-777777777777";
const FRESH_OPERATION = "88888888-8888-4888-8888-888888888888";

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

test("due-only review creates a distinct persisted snapshot and resumes exact cards", async () => {
  const storage = memoryStorage();
  const dueIdentity = { ...IDENTITY, sessionIntent: "DUE_ONLY" };
  const standardBefore = loadLearningSessionState(storage, IDENTITY);
  let creates = 0;
  let reads = 0;
  const service = {
    async createSession(request) {
      creates += 1;
      assert.equal(request.session_intent, "DUE_ONLY");
      return { session: projection({ session_intent: "DUE_ONLY" }), replayed: false };
    },
    async readSession() {
      reads += 1;
      return { ...projection({ session_intent: "DUE_ONLY", can_continue: true }),
        cards: [card()], evaluated_at: "2026-10-18T00:00:00.000Z", set_name: "Authorized Set" };
    },
  };
  const first = await openSrsLearningSession({ storage, identity: dueIdentity, service, randomUuid: () => OPERATION });
  assert.equal(first.cards[0].id, ITEM);
  assert.equal(first.set_name, "Authorized Set");
  assert.deepEqual(loadLearningSessionState(storage, IDENTITY), standardBefore);
  assert.equal(loadLearningSessionState(storage, dueIdentity).session_id, SESSION);
  const second = await openSrsLearningSession({ storage, identity: dueIdentity, service, randomUuid: () => "unused" });
  assert.equal(second.session_state.session_id, SESSION);
  assert.equal(creates, 1);
  assert.equal(reads, 2);
  await assert.rejects(openSrsLearningSession({ storage, identity: dueIdentity,
    service: { ...service, readSession: async () => projection({ can_continue: true }) },
    randomUuid: () => OPERATION }), /does not match/);
});

test("explicit Review Center entry refreshes only an active zero-evidence due-only snapshot", async () => {
  const storage = memoryStorage();
  const identity = { ...IDENTITY, sessionIntent: "DUE_ONLY" };
  const standardBefore = loadLearningSessionState(storage, IDENTITY);
  const oldItems = sessionItems(3);
  const freshItems = sessionItems(5);
  let createCalls = 0;
  const readSession = async (id) => id === SESSION
    ? { ...projection({ session_intent: "DUE_ONLY", snapshot_size: 3, items: oldItems }),
      cards: sessionCards(3), evaluated_at: "2026-10-18T00:00:00.000Z" }
    : { ...projection({ id: FRESH_SESSION, session_intent: "DUE_ONLY", snapshot_size: 5, items: freshItems }),
      cards: sessionCards(5), evaluated_at: "2026-10-18T01:00:00.000Z" };

  await openSrsLearningSession({
    storage, identity,
    service: {
      createSession: async () => ({
        session: projection({ session_intent: "DUE_ONLY", snapshot_size: 3, items: oldItems }),
        replayed: false,
      }),
      readSession,
    },
    randomUuid: () => OPERATION,
  });
  const refreshed = await openSrsLearningSession({
    storage, identity,
    service: {
      async createSession(request) {
        createCalls += 1;
        assert.equal(request.session_intent, "DUE_ONLY");
        return { session: projection({
          id: FRESH_SESSION, session_intent: "DUE_ONLY", snapshot_size: 5, items: freshItems,
        }), replayed: false };
      },
      readSession,
    },
    randomUuid: () => FRESH_OPERATION,
    refreshUnanswered: true,
  });
  assert.equal(createCalls, 1);
  assert.equal(refreshed.session_state.session_id, FRESH_SESSION);
  assert.equal(refreshed.cards.length, 5);
  assert.equal(loadLearningSessionState(storage, identity).session_id, FRESH_SESSION);
  assert.deepEqual(loadLearningSessionState(storage, IDENTITY), standardBefore);
});

test("explicit refresh preserves partially answered, completed and expired due-only snapshots", async () => {
  for (const overrides of [
    { completed_items: 1, items: [item("SRS_GOOD")] },
    { state: "COMPLETED", completed_at: "2026-10-18T00:02:00.000Z", completed_items: 1, items: [item("SRS_GOOD")] },
    { state: "EXPIRED" },
  ]) {
    const storage = memoryStorage();
    const identity = { ...IDENTITY, sessionIntent: "DUE_ONLY" };
    const backend = {
      ...projection({ session_intent: "DUE_ONLY", ...overrides }),
      cards: [card()], evaluated_at: "2026-10-18T00:00:00.000Z",
    };
    await openSrsLearningSession({
      storage, identity,
      service: { createSession: async () => ({ session: backend, replayed: false }), readSession: async () => backend },
      randomUuid: () => OPERATION,
    });
    let creates = 0;
    const resumed = await openSrsLearningSession({
      storage, identity,
      service: { createSession: async () => { creates += 1; }, readSession: async () => backend },
      randomUuid: () => FRESH_OPERATION,
      refreshUnanswered: true,
    });
    assert.equal(creates, 0);
    assert.equal(resumed.session_state.session_id, SESSION);
  }
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

const RECOVERY_IDENTITY = { ...IDENTITY, userId: "recovery-user" };
const eligiblePayload = (ids) => ({
  id: IDENTITY.setId, mode: "SRS", eligible_count: ids.length, cards: ids.map((id) => ({ id })),
});

function recoveryFixture({ original = projection({ can_continue: true }), cards, create } = {}) {
  const storage = memoryStorage();
  const calls = [];
  const replacement = projection({
    id: FRESH_SESSION, items: [{ ...item(null), vocabulary_id: sessionItems(2)[1].vocabulary_id }],
  });
  assert.equal(saveLearningSessionState(storage, reconcileLearningSessionState(null, RECOVERY_IDENTITY, original)), true);
  return {
    storage, calls, replacement,
    input: {
      storage, identity: RECOVERY_IDENTITY, originalId: SESSION,
      randomUuid: () => OPERATION, isCurrent: () => true,
      readCards: cards ?? (async () => eligiblePayload([replacement.items[0].vocabulary_id])),
      sessionService: {
        async readSession(id) {
          calls.push(["read", id]);
          return id === SESSION ? original : { ...replacement, can_continue: true };
        },
        async createSession(request) {
          calls.push(["create", request]);
          return create ? create(request, replacement) : { session: replacement };
        },
      },
    },
  };
}

for (const scenario of [
  { name: "compatible", original: projection(), due: [ITEM], state: "ACTIVE" },
  { name: "empty", original: projection(), due: [], state: "ACTIVE_EMPTY_DUE" },
  { name: "expired", original: projection({ state: "EXPIRED" }), due: [ITEM], state: "EXPIRED" },
  { name: "completed", original: projection({
    state: "COMPLETED", items: [item("SRS_GOOD")], completed_items: 1,
    completed_at: "2026-10-18T01:00:00.000Z",
  }), due: [], state: "COMPLETED" },
  { name: "inaccessible", original: projection({
    can_continue: false, restart_reason: "SESSION_INACCESSIBLE",
  }), due: [ITEM], state: "INACCESSIBLE" },
]) {
  test(`recovery reads but does not create when the original becomes ${scenario.name}`, async () => {
    const { input, calls } = recoveryFixture({
      original: scenario.original, cards: async () => eligiblePayload(scenario.due),
    });
    const result = await recoverOrdinarySrsSession(input);
    assert.equal(result.presentation, scenario.state);
    assert.equal(result.session.session_id, SESSION);
    assert.deepEqual(calls, [["read", SESSION]]);
  });
}

test("recovery preserves original reference after lost response and failed durable successor write", async () => {
  let sends = 0;
  const { input, storage, calls } = recoveryFixture({
    create(_request, replacement) {
      if (++sends === 1) throw new Error("response lost after commit");
      return { session: replacement };
    },
  });
  await assert.rejects(recoverOrdinarySrsSession(input), /response lost/);
  const write = storage.setItem;
  storage.setItem = (key, value) => {
    if (key.includes("backend-learning-session")) throw new Error("storage denied");
    return write(key, value);
  };
  await assert.rejects(recoverOrdinarySrsSession(input), /Replacement SRS session could not be stored/);
  assert.equal(loadLearningSessionState(storage, RECOVERY_IDENTITY).session_id, SESSION);
  storage.setItem = write;
  const result = await recoverOrdinarySrsSession({ ...input, randomUuid: () => FRESH_OPERATION });
  assert.equal(result.session.session_id, FRESH_SESSION);
  assert.equal(result.presentation, "ACTIVE");
  assert.equal(loadLearningSessionState(storage, RECOVERY_IDENTITY).recovered_from_session_id, SESSION);
  assert.deepEqual(calls.filter(([kind]) => kind === "create").map(([, request]) => request),
    Array(3).fill({ operation_id: OPERATION, set_id: IDENTITY.setId, mode: "SRS" }));
});

test("recovery does not send create if UUID storage fails and ignores a response after navigation", async () => {
  const { input, storage, calls } = recoveryFixture();
  const write = storage.setItem;
  storage.setItem = () => { throw new Error("storage unavailable"); };
  await assert.rejects(recoverOrdinarySrsSession(input), /storage unavailable/);
  assert.deepEqual(calls, [["read", SESSION]]);
  storage.setItem = write;
  let current = true;
  const result = await recoverOrdinarySrsSession({
    ...input, isCurrent: () => current,
    sessionService: {
      ...input.sessionService,
      async createSession(...args) {
        const result = await input.sessionService.createSession(...args);
        current = false;
        return result;
      },
    },
  });
  assert.equal(result, null);
  assert.equal(loadLearningSessionState(storage, RECOVERY_IDENTITY).session_id, SESSION);
});

test("an empty create response rereads eligibility and preserves the original session", async () => {
  let due = true;
  const { input, storage, calls } = recoveryFixture({
    cards: async () => eligiblePayload(due ? [sessionItems(2)[1].vocabulary_id] : []),
    create() {
      due = false;
      return { session: null, reason: "SRS_UP_TO_DATE" };
    },
  });
  const result = await recoverOrdinarySrsSession(input);
  assert.equal(result.presentation, "ACTIVE_EMPTY_DUE");
  assert.equal(loadLearningSessionState(storage, RECOVERY_IDENTITY).session_id, SESSION);
  assert.deepEqual(calls.map(([kind]) => kind), ["read", "create", "read"]);
});

test("pending ratings retain the original request even when a replacement contains the same vocabulary", () => {
  const storage = memoryStorage();
  const request = { session_id: SESSION, set_id: IDENTITY.setId, event_id: OPERATION,
    vocabulary_id: ITEM, rating: "AGAIN", expected_revision: 3 };
  assert.deepEqual(preserveOrdinarySrsRating(storage, RECOVERY_IDENTITY, request), [{ request, superseded: false }]);
  assert.deepEqual(readOrdinarySrsRatingAttempts(storage, IDENTITY), []);
  assert.deepEqual(readOrdinarySrsRatingAttempts(storage, { ...RECOVERY_IDENTITY, setId: ITEM }), []);
  for (const identity of [
    { ...RECOVERY_IDENTITY, sessionIntent: "DUE_ONLY" },
    { ...RECOVERY_IDENTITY, passId: PASS },
  ]) {
    assert.throws(() => readOrdinarySrsRatingAttempts(storage, identity), /ordinary STANDARD/);
  }
  const run = createLearningRunState(RECOVERY_IDENTITY.userId, IDENTITY.setId, eligiblePayload([ITEM]));
  run.srs.retry_context = request;
  const replacement = reconcileSrsSessionRun(run, {
    mode: "SRS", session_id: FRESH_SESSION, recovered_from_session_id: SESSION,
    view_state: "ACTIVE", item_ids: [ITEM], acknowledged_ids: [],
  });
  assert.equal(replacement.srs.retry_context, null);
  assert.deepEqual(readOrdinarySrsRatingAttempts(storage, RECOVERY_IDENTITY), [{ request, superseded: false }]);
  assert.deepEqual(settleOrdinarySrsRating(storage, RECOVERY_IDENTITY, request.event_id, { superseded: true }),
    [{ request, superseded: true }]);
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

function sessionItems(count) {
  return Array.from({ length: count }, (_, index) => ({
    vocabulary_id: `${String(index + 4).padStart(8, "0")}-4444-4444-8444-444444444444`,
    position: index,
    evidence: null,
  }));
}

function sessionCards(count) {
  return sessionItems(count).map(({ vocabulary_id: id, position }) => ({ ...card(), id, position }));
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
