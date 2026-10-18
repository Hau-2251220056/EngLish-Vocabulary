import assert from "node:assert/strict";
import test from "node:test";
import {
  acknowledgeNormalReveal,
  canCompleteNormalLearningSession,
  completeNormalLearningSession,
  openNormalLearningSession,
  persistNormalLearningCursor,
  reconcileNormalLearningSession,
} from "../src/learning/normal-learning-session.js";

const IDS = Object.freeze({
  set: "11111111-1111-4111-8111-111111111111",
  session: "22222222-2222-4222-8222-222222222222",
  first: "33333333-3333-4333-8333-333333333333",
  second: "44444444-4444-4444-8444-444444444444",
  create: "55555555-5555-4555-8555-555555555555",
  reveal: "66666666-6666-4666-8666-666666666666",
  secondReveal: "77777777-7777-4777-8777-777777777777",
  complete: "88888888-8888-4888-8888-888888888888",
});
const identity = Object.freeze({ userId: "user-a", setId: IDS.set, mode: "NORMAL" });

test("NORMAL opens the exact backend-authored ordered snapshot and resumes it by read", async () => {
  const storage = memoryStorage();
  const calls = [];
  const service = serviceFake(calls);
  const first = await openNormalLearningSession({ storage, identity, vocabularyIds: [IDS.first, IDS.second], service, randomUuid: () => IDS.create });
  assert.deepEqual(first.item_ids, [IDS.first, IDS.second]);
  const resumed = await openNormalLearningSession({ storage, identity, vocabularyIds: [IDS.first, IDS.second], service, randomUuid: () => { throw new Error("must not create"); } });
  assert.equal(resumed.session_id, IDS.session);
  assert.deepEqual(calls.map((call) => call[0]), ["create", "read"]);
});

test("reveal persists an operation before the request and exact retry reuses it", async () => {
  const storage = memoryStorage();
  const calls = [];
  const service = serviceFake(calls, { failRevealOnce: true });
  const state = await openNormalLearningSession({ storage, identity, vocabularyIds: [IDS.first, IDS.second], service, randomUuid: () => IDS.create });
  await assert.rejects(acknowledgeNormalReveal({ storage, identity, state, vocabularyId: IDS.first, service, randomUuid: () => IDS.reveal }));
  const accepted = await acknowledgeNormalReveal({ storage, identity, state, vocabularyId: IDS.first, service, randomUuid: () => { throw new Error("must reuse"); } });
  assert.deepEqual(accepted.acknowledged_ids, [IDS.first]);
  assert.deepEqual(calls.filter(([kind]) => kind === "reveal").map((call) => call[3]), [IDS.reveal, IDS.reveal]);
});

test("completion remains disabled until all backend evidence exists and returns authoritative Streak", async () => {
  const storage = memoryStorage();
  const calls = [];
  const service = serviceFake(calls);
  let state = await openNormalLearningSession({ storage, identity, vocabularyIds: [IDS.first, IDS.second], service, randomUuid: () => IDS.create });
  state = await acknowledgeNormalReveal({ storage, identity, state, vocabularyId: IDS.first, service, randomUuid: () => IDS.reveal });
  assert.equal(canCompleteNormalLearningSession(state), false);
  await assert.rejects(completeNormalLearningSession({ storage, identity, state, service, randomUuid: () => IDS.complete }), /not ready/);
  state = await acknowledgeNormalReveal({ storage, identity, state, vocabularyId: IDS.second, service, randomUuid: () => IDS.secondReveal });
  assert.equal(canCompleteNormalLearningSession(state), true);
  const result = await completeNormalLearningSession({ storage, identity, state, service, randomUuid: () => IDS.complete });
  assert.equal(result.session_state.view_state, "COMPLETED");
  assert.equal(result.streak.current_streak, 1);
  assert.equal(calls.some(([kind]) => kind === "progress" || kind === "xp"), false);
});

test("lost completion response preserves and reuses the completion operation identity", async () => {
  const storage = memoryStorage();
  const calls = [];
  const service = serviceFake(calls, { failCompleteOnce: true });
  let state = await openNormalLearningSession({ storage, identity, vocabularyIds: [IDS.first, IDS.second], service, randomUuid: () => IDS.create });
  state = await acknowledgeNormalReveal({ storage, identity, state, vocabularyId: IDS.first, service, randomUuid: () => IDS.reveal });
  state = await acknowledgeNormalReveal({ storage, identity, state, vocabularyId: IDS.second, service, randomUuid: () => IDS.secondReveal });
  await assert.rejects(completeNormalLearningSession({ storage, identity, state, service, randomUuid: () => IDS.complete }));
  await completeNormalLearningSession({ storage, identity, state, service, randomUuid: () => { throw new Error("must reuse"); } });
  assert.deepEqual(calls.filter(([kind]) => kind === "complete").map((call) => call[2]), [IDS.complete, IDS.complete]);
});

test("failed durable operation write makes no backend reveal call", async () => {
  const storage = memoryStorage();
  const calls = [];
  const service = serviceFake(calls);
  const state = await openNormalLearningSession({ storage, identity, vocabularyIds: [IDS.first, IDS.second], service, randomUuid: () => IDS.create });
  storage.failWrites = true;
  await assert.rejects(acknowledgeNormalReveal({ storage, identity, state, vocabularyId: IDS.first, service, randomUuid: () => IDS.reveal }), /could not be persisted/);
  assert.equal(calls.filter(([kind]) => kind === "reveal").length, 0);
});

test("NORMAL cursor persists independently from evidence and resumes the second card", async () => {
  const storage = memoryStorage();
  const calls = [];
  const service = serviceFake(calls);
  const state = await openNormalLearningSession({ storage, identity, vocabularyIds: [IDS.first, IDS.second], service, randomUuid: () => IDS.create });
  const moved = persistNormalLearningCursor({ storage, state, vocabularyId: IDS.second });
  assert.equal(moved.cursor_vocabulary_id, IDS.second);
  assert.deepEqual(moved.acknowledged_ids, []);
  const resumed = await openNormalLearningSession({ storage, identity, vocabularyIds: [IDS.first, IDS.second], service, randomUuid: () => { throw new Error("must not create"); } });
  assert.equal(resumed.cursor_vocabulary_id, IDS.second);
  assert.deepEqual(resumed.acknowledged_ids, []);
});

test("terminal mutation reconciliation keeps pending operation identity and accepts backend state", async () => {
  const storage = memoryStorage();
  const calls = [];
  const service = serviceFake(calls, { failRevealOnce: true });
  const state = await openNormalLearningSession({ storage, identity, vocabularyIds: [IDS.first, IDS.second], service, randomUuid: () => IDS.create });
  await assert.rejects(acknowledgeNormalReveal({ storage, identity, state, vocabularyId: IDS.first, service, randomUuid: () => IDS.reveal }));
  service.setState("EXPIRED");
  const reconciled = await reconcileNormalLearningSession({ storage, identity, state, service });
  assert.equal(reconciled.view_state, "EXPIRED");
  service.setState("ACTIVE");
  await acknowledgeNormalReveal({ storage, identity, state, vocabularyId: IDS.first, service, randomUuid: () => { throw new Error("must reuse"); } });
  assert.deepEqual(calls.filter(([kind]) => kind === "reveal").map((call) => call[3]), [IDS.reveal, IDS.reveal]);
});

function serviceFake(calls, options = {}) {
  let projection = session();
  let revealFailures = options.failRevealOnce ? 1 : 0;
  let completeFailures = options.failCompleteOnce ? 1 : 0;
  return {
    setState(state) {
      projection = { ...projection, state, completed_at: state === "COMPLETED" ? "2026-10-18T00:05:00.000Z" : null };
    },
    async createSession(request) { calls.push(["create", request]); return { session: projection, replayed: false }; },
    async readSession(id) { calls.push(["read", id]); return projection; },
    async acknowledgeNormalReveal(sessionId, vocabularyId, operationId) {
      calls.push(["reveal", sessionId, vocabularyId, operationId]);
      if (revealFailures-- > 0) throw new Error("lost response");
      projection = { ...projection, completed_items: projection.items.filter((item) => item.evidence || item.vocabulary_id === vocabularyId).length,
        items: projection.items.map((item) => item.vocabulary_id === vocabularyId ? { ...item, evidence: "NORMAL_REVEALED" } : item) };
      return { session: projection, replayed: false, already_acknowledged: false };
    },
    async completeNormalSession(sessionId, operationId) {
      calls.push(["complete", sessionId, operationId]);
      if (completeFailures-- > 0) throw new Error("lost response");
      projection = { ...projection, state: "COMPLETED", completed_at: "2026-10-18T00:05:00.000Z" };
      return { session: projection, streak: { current_streak: 1, completed_today: true, last_qualified_date: "2026-10-18", timezone: "Asia/Ho_Chi_Minh", evaluated_at: "2026-10-18T00:05:00.000Z" }, replayed: false };
    },
  };
}

function session() {
  return { id: IDS.session, set_id: IDS.set, mode: "NORMAL", state: "ACTIVE", created_at: "2026-10-18T00:00:00.000Z", expires_at: "2026-10-25T00:00:00.000Z", completed_at: null, snapshot_size: 2, completed_items: 0,
    items: [{ vocabulary_id: IDS.first, position: 0, evidence: null }, { vocabulary_id: IDS.second, position: 1, evidence: null }] };
}

function memoryStorage() {
  const values = new Map();
  return { failWrites: false, getItem: (key) => values.get(key) ?? null,
    setItem(key, value) { if (this.failWrites) throw new Error("quota"); values.set(key, value); },
    removeItem: (key) => values.delete(key), key: (index) => [...values.keys()][index] ?? null,
    get length() { return values.size; } };
}
