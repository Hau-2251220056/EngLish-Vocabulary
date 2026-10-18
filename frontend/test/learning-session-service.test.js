import assert from "node:assert/strict";
import test from "node:test";
import {
  createLearningSessionService,
  LearningSessionApiError,
} from "../src/services/learning-session-service.js";

const IDS = Object.freeze({
  operation: "11111111-1111-4111-8111-111111111111",
  set: "22222222-2222-4222-8222-222222222222",
  session: "33333333-3333-4333-8333-333333333333",
  vocabulary: "44444444-4444-4444-8444-444444444444",
  vocabularyTwo: "55555555-5555-4555-8555-555555555555",
});

test("session API sends exact create/read/reveal/complete and Streak contracts", async () => {
  const calls = [];
  const service = createLearningSessionService(client(calls));
  await service.createSession({ operation_id: IDS.operation, set_id: IDS.set, mode: "NORMAL", vocabulary_ids: [IDS.vocabulary] });
  await service.readSession(IDS.session);
  await service.acknowledgeNormalReveal(IDS.session, IDS.vocabulary, IDS.operation);
  await service.completeNormalSession(IDS.session, IDS.operation);
  await service.getCurrentStreak();
  assert.deepEqual(calls, [
    ["POST", "/api/learning-sessions", { operation_id: IDS.operation, set_id: IDS.set, mode: "NORMAL", vocabulary_ids: [IDS.vocabulary] }],
    ["GET", `/api/learning-sessions/${IDS.session}`],
    ["PUT", `/api/learning-sessions/${IDS.session}/items/${IDS.vocabulary}/reveal`, { operation_id: IDS.operation }],
    ["POST", `/api/learning-sessions/${IDS.session}/complete`, { operation_id: IDS.operation }],
    ["GET", "/api/users/me/streak"],
  ]);
});

test("create validation keeps mode-specific payloads bounded and rejects unknown fields", async () => {
  let calls = 0;
  const service = createLearningSessionService({ async post() { calls += 1; } });
  for (const input of [
    { operation_id: IDS.operation, set_id: IDS.set, mode: "SRS", vocabulary_ids: [IDS.vocabulary] },
    { operation_id: IDS.operation, set_id: IDS.set, mode: "NORMAL" },
    { operation_id: IDS.operation, set_id: IDS.set, mode: "NORMAL", vocabulary_ids: [IDS.vocabulary, IDS.vocabulary] },
    { operation_id: IDS.operation, set_id: IDS.set, mode: "NORMAL", vocabulary_ids: [IDS.vocabulary], owner_id: IDS.session },
  ]) await assert.rejects(service.createSession(input), { code: "INVALID_LEARNING_SESSION_REQUEST" });
  assert.equal(calls, 0);
});

test("an empty NORMAL proposal reaches the Backend so it can authoritatively report EMPTY_SET", async () => {
  const service = createLearningSessionService({
    async post(_url, body) {
      assert.deepEqual(body.vocabulary_ids, []);
      return envelope({ session: null, reason: "EMPTY_SET", replayed: false });
    },
  });
  assert.equal((await service.createSession({
    operation_id: IDS.operation, set_id: IDS.set, mode: "NORMAL", vocabulary_ids: [],
  })).reason, "EMPTY_SET");
});

test("response validation rejects malformed snapshots, completion and timezone projections", async () => {
  for (const value of [
    { ...session(), completed_items: 1 },
    { ...session(), items: [{ ...session().items[0], position: 1 }] },
    { ...session(), state: "COMPLETED", completed_at: null },
    { ...session(), items: [{ ...session().items[0], evidence: "QUIZ_CORRECT" }] },
    { ...session(), expires_at: "2026-10-24T23:59:59.999Z" },
  ]) {
    const service = createLearningSessionService({ async post() { return envelope({ session: value, replayed: false }); } });
    await assert.rejects(service.createSession({ operation_id: IDS.operation, set_id: IDS.set, mode: "NORMAL", vocabulary_ids: [IDS.vocabulary] }), { code: "INVALID_LEARNING_SESSION_RESPONSE" });
  }
  const service = createLearningSessionService({ async get() { return envelope({ ...streak(), timezone: "UTC" }); } });
  await assert.rejects(service.getCurrentStreak(), { code: "INVALID_LEARNING_SESSION_RESPONSE" });
  const invalidDate = createLearningSessionService({ async get() { return envelope({ ...streak(), last_qualified_date: "9999-99-99" }); } });
  await assert.rejects(invalidDate.getCurrentStreak(), { code: "INVALID_LEARNING_SESSION_RESPONSE" });
});

test("empty/up-to-date, replay and inaccessible reads remain explicit", async () => {
  const empty = createLearningSessionService({ async post() { return envelope({ session: null, reason: "SRS_UP_TO_DATE", replayed: false }); } });
  assert.deepEqual(await empty.createSession({ operation_id: IDS.operation, set_id: IDS.set, mode: "SRS" }), { session: null, reason: "SRS_UP_TO_DATE", replayed: false });
  const inaccessible = createLearningSessionService({ async get() { return envelope({ ...session(), can_continue: false, restart_reason: "SESSION_INACCESSIBLE" }); } });
  assert.equal((await inaccessible.readSession(IDS.session)).restart_reason, "SESSION_INACCESSIBLE");
});

test("HTTP failures retain not-found/conflict distinctions", async () => {
  for (const [status, code, kind] of [[404, "LEARNING_SESSION_NOT_FOUND", "not-found"], [409, "LEARNING_SESSION_INACCESSIBLE", "conflict"]]) {
    const service = createLearningSessionService({ async get() { throw { response: { status, data: { error: { code, message: code } } } }; } });
    await assert.rejects(service.readSession(IDS.session), (error) => error instanceof LearningSessionApiError && error.kind === kind && error.code === code);
  }
});

test("structurally valid responses fail closed when request identity differs", async () => {
  const createInput = { operation_id: IDS.operation, set_id: IDS.set, mode: "NORMAL", vocabulary_ids: [IDS.vocabulary] };
  for (const wrongSession of [
    { ...session(), set_id: IDS.operation },
    { ...session(), mode: "QUIZ", items: [{ ...session().items[0], evidence: null }] },
    { ...session(), items: [{ ...session().items[0], vocabulary_id: IDS.operation }] },
  ]) {
    const service = createLearningSessionService({ async post() { return envelope({ session: wrongSession, replayed: false }); } });
    await assert.rejects(service.createSession(createInput), { code: "INVALID_LEARNING_SESSION_RESPONSE" });
  }
  const wrongOrder = createLearningSessionService({ async post() {
    return envelope({ session: session({ snapshot_size: 2, items: [
      { vocabulary_id: IDS.vocabularyTwo, position: 0, evidence: null },
      { vocabulary_id: IDS.vocabulary, position: 1, evidence: null },
    ] }), replayed: false });
  } });
  await assert.rejects(wrongOrder.createSession({
    ...createInput, vocabulary_ids: [IDS.vocabulary, IDS.vocabularyTwo],
  }), { code: "INVALID_LEARNING_SESSION_RESPONSE" });

  const wrongRead = createLearningSessionService({ async get() {
    return envelope({ ...session(), id: IDS.operation, can_continue: true });
  } });
  await assert.rejects(wrongRead.readSession(IDS.session), { code: "INVALID_LEARNING_SESSION_RESPONSE" });

  const wrongReveal = createLearningSessionService({ async put() {
    return envelope({ item: { vocabulary_id: IDS.vocabulary, evidence: "NORMAL_REVEALED", evidence_at: "2026-10-18T00:01:00.000Z" },
      session: { ...session(), id: IDS.operation, completed_items: 1, items: [{ ...session().items[0], evidence: "NORMAL_REVEALED" }] },
      replayed: false, already_acknowledged: false });
  } });
  await assert.rejects(wrongReveal.acknowledgeNormalReveal(IDS.session, IDS.vocabulary, IDS.operation), { code: "INVALID_LEARNING_SESSION_RESPONSE" });
  const wrongRevealMembership = createLearningSessionService({ async put() {
    return envelope({ item: { vocabulary_id: IDS.vocabulary, evidence: "NORMAL_REVEALED", evidence_at: "2026-10-18T00:01:00.000Z" },
      session: session({ items: [{ ...session().items[0], vocabulary_id: IDS.vocabularyTwo }] }),
      replayed: false, already_acknowledged: false });
  } });
  await assert.rejects(wrongRevealMembership.acknowledgeNormalReveal(IDS.session, IDS.vocabulary, IDS.operation), { code: "INVALID_LEARNING_SESSION_RESPONSE" });

  const wrongComplete = createLearningSessionService({ async post() {
    return envelope({ session: { ...completedSession(), id: IDS.operation }, streak: streak(), replayed: false });
  } });
  await assert.rejects(wrongComplete.completeNormalSession(IDS.session, IDS.operation), { code: "INVALID_LEARNING_SESSION_RESPONSE" });
  const wrongCompleteMode = createLearningSessionService({ async post() {
    return envelope({ session: { ...completedSession(), mode: "QUIZ", items: [{ ...completedSession().items[0], evidence: "QUIZ_CORRECT" }] }, streak: streak(), replayed: false });
  } });
  await assert.rejects(wrongCompleteMode.completeNormalSession(IDS.session, IDS.operation), { code: "INVALID_LEARNING_SESSION_RESPONSE" });
});

function client(calls) {
  return {
    async get(url) { calls.push(["GET", url]); return envelope(url.endsWith("streak") ? streak() : { ...session(), can_continue: true }); },
    async post(url, body) {
      calls.push(["POST", url, body]);
      return url.endsWith("complete") ? envelope({ session: completedSession(), streak: streak(), replayed: false }) : envelope({ session: session(), replayed: false });
    },
    async put(url, body) { calls.push(["PUT", url, body]); return envelope({ item: { vocabulary_id: IDS.vocabulary, evidence: "NORMAL_REVEALED", evidence_at: "2026-10-18T00:01:00.000Z" }, session: { ...session(), completed_items: 1, items: [{ ...session().items[0], evidence: "NORMAL_REVEALED" }] }, replayed: false, already_acknowledged: false }); },
  };
}
function envelope(data) { return { data: { data } }; }
function session(overrides = {}) { return { id: IDS.session, set_id: IDS.set, mode: "NORMAL", state: "ACTIVE", created_at: "2026-10-18T00:00:00.000Z", expires_at: "2026-10-25T00:00:00.000Z", completed_at: null, snapshot_size: 1, completed_items: 0, items: [{ vocabulary_id: IDS.vocabulary, position: 0, evidence: null }], ...overrides }; }
function completedSession() { return { ...session(), state: "COMPLETED", completed_at: "2026-10-18T00:02:00.000Z", completed_items: 1, items: [{ ...session().items[0], evidence: "NORMAL_REVEALED" }] }; }
function streak() { return { current_streak: 1, completed_today: true, last_qualified_date: "2026-10-18", timezone: "Asia/Ho_Chi_Minh", evaluated_at: "2026-10-18T00:02:00.000Z" }; }
