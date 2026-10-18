import assert from "node:assert/strict";
import test from "node:test";
import {
  assertCompleteGroup,
  assertCompletionReplayMatches,
  assertCreationReplayMatches,
  assertEvidenceReplayMatches,
  assertSnapshotIntegrity,
  createLearningSessionRepository,
} from "../../src/repositories/learning-session-repository.js";
import { createStreakRepository } from "../../src/repositories/streak-repository.js";
import { captureOperationTime } from "../../src/services/learning-session-domain.js";
import { completeLearningSessionAtomically } from "../../src/services/learning-session-persistence.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const SESSION_ID = "22222222-2222-4222-8222-222222222222";
const SET_ID = "33333333-3333-4333-8333-333333333333";
const ITEM_IDS = [
  "44444444-4444-4444-8444-444444444444",
  "55555555-5555-4555-8555-555555555555",
];

test("snapshot integrity requires exact count, distinct identities and contiguous positions", () => {
  const valid = snapshotItems();
  assert.deepEqual(assertSnapshotIntegrity(2, valid), valid);
  assert.throws(() => assertSnapshotIntegrity(1, valid), hasCode("LEARNING_SESSION_SNAPSHOT_INVALID"));
  assert.throws(
    () => assertSnapshotIntegrity(2, [valid[0], { ...valid[1], position: 2 }]),
    hasCode("LEARNING_SESSION_SNAPSHOT_INVALID"),
  );
  assert.throws(
    () => assertSnapshotIntegrity(2, [valid[0], { vocabulary_id: ITEM_IDS[0], position: 1 }]),
    hasCode("LEARNING_SESSION_SNAPSHOT_INVALID"),
  );
});

test("session creation writes an immutable nested snapshot through the caller transaction", async () => {
  const calls = [];
  const transaction = fakeTransaction(calls);
  const repository = createLearningSessionRepository(transaction);
  const input = {
    id: SESSION_ID,
    user_id: USER_ID,
    vocabulary_set_id: SET_ID,
    set_id_snapshot: SET_ID,
    mode: "NORMAL",
    create_operation_id: "66666666-6666-4666-8666-666666666666",
    snapshot_size: 2,
    created_at: new Date("2026-10-18T03:00:00.000Z"),
    expires_at: new Date("2026-10-25T03:00:00.000Z"),
    items: snapshotItems(),
  };

  await repository.createSessionWithItems(input);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, "session.create");
  assert.deepEqual(calls[0].args.data.items.create, snapshotItems());
  assert.equal("updateSession" in repository, false);
  assert.equal("deleteSession" in repository, false);
  input.created_at.setUTCFullYear(2030);
  assert.equal(calls[0].args.data.created_at.toISOString(), "2026-10-18T03:00:00.000Z");
});

test("repository scopes reads by owner and exposes session-before-item lock order", async () => {
  const calls = [];
  const repository = createLearningSessionRepository(fakeTransaction(calls));

  await repository.findOwnedSession(SESSION_ID, USER_ID);
  assert.deepEqual(calls.at(-1).args.where, { id: SESSION_ID, user_id: USER_ID });

  calls.length = 0;
  await repository.lockOwnedSession(SESSION_ID, USER_ID);
  await repository.lockSessionItems(SESSION_ID);
  assert.deepEqual(calls.map(({ name }) => name), [
    "queryRaw",
    "session.findFirst",
    "queryRaw",
  ]);
  assert.match(calls[0].sql, /LEARNING_SESSION[\s\S]*FOR UPDATE/);
  assert.match(calls[2].sql, /LEARNING_SESSION_ITEM[\s\S]*ORDER BY "position" ASC[\s\S]*FOR UPDATE/);
});

test("SRS receipts use global event identity and the caller transaction", async () => {
  const calls = [];
  const repository = createLearningSessionRepository(fakeTransaction(calls));
  const acceptedAt = new Date("2026-10-18T03:00:00.000Z");
  const eventId = "77777777-7777-4777-8777-777777777777";

  await repository.findSrsReceipt(eventId);
  assert.deepEqual(calls.at(-1).args.where, { event_id: eventId });

  await repository.recordSrsReceipt({
    item: { id: "item-1" },
    eventId,
    rating: "AGAIN",
    expectedRevision: 0,
    acceptedRevision: 1,
    acceptedAt,
  });
  assert.equal(calls.at(-1).name, "receipt.create");
  assert.deepEqual(calls.at(-1).args.data, {
    event_id: eventId,
    session_item_id: "item-1",
    rating: "AGAIN",
    expected_revision: 0,
    accepted_revision: 1,
    accepted_at: acceptedAt,
  });
});

test("creation and evidence identities replay only the exact original payload", () => {
  const existing = activeSession();
  assert.equal(
    assertCreationReplayMatches(existing, {
      user_id: USER_ID,
      set_id_snapshot: SET_ID,
      mode: "NORMAL",
      snapshot_size: 2,
      items: snapshotItems(),
    }),
    existing,
  );
  assert.throws(
    () => assertCreationReplayMatches(existing, {
      user_id: USER_ID,
      set_id_snapshot: SET_ID,
      mode: "QUIZ",
      snapshot_size: 2,
      items: snapshotItems(),
    }),
    hasCode("LEARNING_SESSION_OPERATION_CONFLICT"),
  );

  const evidence = resolvedItems("NORMAL_REVEALED")[0];
  assert.equal(assertEvidenceReplayMatches(evidence, evidence), evidence);
  assert.throws(
    () => assertEvidenceReplayMatches(evidence, { ...evidence, session_id: "different" }),
    hasCode("LEARNING_SESSION_EVENT_CONFLICT"),
  );

  const completed = {
    ...existing,
    status: "COMPLETED",
    completion_event_id: "88888888-8888-4888-8888-888888888888",
  };
  assert.equal(
    assertCompletionReplayMatches(completed, {
      user_id: USER_ID,
      session_id: SESSION_ID,
      completion_event_id: completed.completion_event_id,
    }),
    completed,
  );
  assert.throws(
    () => assertCompletionReplayMatches(completed, {
      user_id: USER_ID,
      session_id: "different",
      completion_event_id: completed.completion_event_id,
    }),
    hasCode("LEARNING_SESSION_EVENT_CONFLICT"),
  );
});

test("evidence write rejects wrong mode, wrong session, expiry equality and resolved items", async () => {
  const calls = [];
  const repository = createLearningSessionRepository(fakeTransaction(calls));
  const session = activeSession();
  const item = session.items[0];
  const acceptedAt = new Date("2026-10-18T03:00:00.000Z");

  await repository.recordEvidence({
    session,
    item,
    evidence: "NORMAL_REVEALED",
    eventId: "77777777-7777-4777-8777-777777777777",
    acceptedAt,
  });
  assert.equal(calls.at(-1).name, "item.updateMany");
  assert.throws(
    () => repository.recordEvidence({ session, item, evidence: "QUIZ_CORRECT", eventId: "x", acceptedAt }),
    hasCode("LEARNING_SESSION_EVIDENCE_MISMATCH"),
  );
  assert.throws(
    () => repository.recordEvidence({ session, item: { ...item, session_id: "other" }, evidence: "NORMAL_REVEALED", eventId: "x", acceptedAt }),
    hasCode("LEARNING_SESSION_ITEM_MISMATCH"),
  );
  assert.throws(
    () => repository.recordEvidence({ session, item, evidence: "NORMAL_REVEALED", eventId: "x", acceptedAt: session.expires_at }),
    hasCode("LEARNING_SESSION_EXPIRED"),
  );
  assert.throws(
    () => repository.recordEvidence({ session, item: resolvedItems("NORMAL_REVEALED")[0], evidence: "NORMAL_REVEALED", eventId: "x", acceptedAt }),
    hasCode("LEARNING_SESSION_ITEM_ALREADY_RESOLVED"),
  );
});

test("terminal completion uses one instant and derives Streak ownership from locked session", async () => {
  const events = [];
  let clockCalls = 0;
  const sourceInstant = new Date("2026-10-18T17:00:00.000Z");
  const completed = await completeLearningSessionAtomically({
    sessionRepository: {
      async lockOwnedSession() {
        events.push("session-lock");
        return { ...activeSession(), items: resolvedItems("NORMAL_REVEALED") };
      },
      async lockSessionItems() {
        events.push("item-lock");
        return resolvedItems("NORMAL_REVEALED");
      },
      async findCompletionReplay() {
        events.push("completion-replay-read");
        return null;
      },
      async completeSession(input) {
        events.push("session-complete");
        assert.equal(input.acceptedAt.getTime(), sourceInstant.getTime());
        return { count: 1 };
      },
    },
    streakRepository: {
      async insertDayForCompletedSession(input) {
        events.push("streak-insert");
        assert.equal(input.session.user_id, USER_ID);
        assert.equal(input.activityDate, "2026-10-19");
        assert.equal(input.createdAt.getTime(), sourceInstant.getTime());
        return { inserted: true };
      },
    },
    sessionId: SESSION_ID,
    userId: USER_ID,
    completionEventId: "88888888-8888-4888-8888-888888888888",
    captureTime: () => {
      events.push("clock");
      clockCalls += 1;
      return captureOperationTime(() => sourceInstant);
    },
    validateLockedSession: async () => { events.push("snapshot-locks"); },
  });

  assert.equal(clockCalls, 1);
  assert.deepEqual(events, [
    "session-lock",
    "item-lock",
    "snapshot-locks",
    "clock",
    "completion-replay-read",
    "session-complete",
    "streak-insert",
  ]);
  assert.equal(completed.streak_day_inserted, true);
  assert.equal(completed.replayed, false);
  assert.equal(completed.operation_time.instant.toISOString(), "2026-10-18T17:00:00.000Z");
});

test("completion lock wait cannot reuse a pre-lock instant across the expiry boundary", async () => {
  const session = activeSession();
  let instant = new Date(session.expires_at.getTime() - 1);
  let completionWrites = 0;
  await assert.rejects(
    completeLearningSessionAtomically({
      sessionRepository: {
        async lockOwnedSession() { return session; },
        async lockSessionItems() {
          instant = new Date(session.expires_at);
          return resolvedItems("NORMAL_REVEALED");
        },
        async findCompletionReplay() { return null; },
        async completeSession({ acceptedAt }) {
          if (acceptedAt >= session.expires_at) {
            throw Object.assign(new Error("expired after lock wait"), {
              code: "LEARNING_SESSION_EXPIRED",
            });
          }
          completionWrites += 1;
          return { count: 1 };
        },
      },
      streakRepository: {
        async insertDayForCompletedSession() {
          assert.fail("expired completion must not insert a Streak day");
        },
      },
      sessionId: SESSION_ID,
      userId: USER_ID,
      completionEventId: "88888888-8888-4888-8888-888888888888",
      captureTime: () => captureOperationTime(() => instant),
    }),
    hasCode("LEARNING_SESSION_EXPIRED"),
  );
  assert.equal(completionWrites, 0);
});

test("complete-group validation rejects missing and mode-incompatible evidence", () => {
  const session = activeSession();
  assert.throws(
    () => assertCompleteGroup(session, session.items),
    hasCode("LEARNING_SESSION_INCOMPLETE"),
  );
  assert.throws(
    () => assertCompleteGroup(session, resolvedItems("QUIZ_CORRECT")),
    hasCode("LEARNING_SESSION_EVIDENCE_MISMATCH"),
  );
  assert.equal(assertCompleteGroup(session, resolvedItems("NORMAL_REVEALED")), true);
});

test("terminal replay is immutable and does not insert another Streak day", async () => {
  let completionWrites = 0;
  let streakWrites = 0;
  const completionEventId = "88888888-8888-4888-8888-888888888888";
  const session = {
    ...activeSession(),
    status: "COMPLETED",
    completed_at: new Date("2026-10-18T03:00:00.000Z"),
    completion_event_id: completionEventId,
    items: resolvedItems("NORMAL_REVEALED"),
  };
  const result = await completeLearningSessionAtomically({
    sessionRepository: {
      async lockOwnedSession() { return session; },
      async completeSession() { completionWrites += 1; },
    },
    streakRepository: {
      async insertDayForCompletedSession() { streakWrites += 1; },
    },
    sessionId: SESSION_ID,
    userId: USER_ID,
    completionEventId,
    captureTime: () => captureOperationTime(() => new Date("2026-10-19T03:00:00.000Z")),
  });

  assert.equal(result.replayed, true);
  assert.equal(completionWrites, 0);
  assert.equal(streakWrites, 0);
  assert.equal(result.session.completed_at.toISOString(), "2026-10-18T03:00:00.000Z");
});

test("daily insert is concurrency-safe SQL and descending read uses the approved boundary", async () => {
  const calls = [];
  const repository = createStreakRepository(fakeTransaction(calls));
  const result = await repository.insertDayForCompletedSession({
    session: {
      ...activeSession(),
      status: "COMPLETED",
      completed_at: new Date("2026-10-18T03:00:00.000Z"),
      completion_event_id: "88888888-8888-4888-8888-888888888888",
    },
    activityDate: "2026-10-18",
    createdAt: new Date("2026-10-18T03:00:00.000Z"),
  });
  assert.equal(result.inserted, true);
  assert.equal(calls[0].name, "streak.insert");
  assert.match(calls[0].sql, /ON CONFLICT \("user_id", "activity_date"\) DO NOTHING/);
  assert.equal(calls[0].values[0], USER_ID);
  assert.equal(calls[0].values[1], "2026-10-18");

  const dates = await repository.listActivityDatesThrough(USER_ID, "2026-10-18");
  assert.deepEqual(dates, ["2026-10-18", "2026-10-17"]);
  assert.deepEqual(calls.at(-1).args.orderBy, { activity_date: "desc" });
});

test("terminal persistence propagates failure so the caller transaction can roll back", async () => {
  const failure = new Error("forced Streak insert failure");
  await assert.rejects(
    completeLearningSessionAtomically({
      sessionRepository: {
        async lockOwnedSession() {
          return { ...activeSession(), items: resolvedItems("NORMAL_REVEALED") };
        },
        async lockSessionItems() { return resolvedItems("NORMAL_REVEALED"); },
        async findCompletionReplay() { return null; },
        async completeSession() { return { count: 1 }; },
      },
      streakRepository: {
        async insertDayForCompletedSession() { throw failure; },
      },
      sessionId: SESSION_ID,
      userId: USER_ID,
      completionEventId: "88888888-8888-4888-8888-888888888888",
      captureTime: () => captureOperationTime(() => new Date("2026-10-18T03:00:00.000Z")),
    }),
    (error) => error === failure,
  );
});

function activeSession() {
  return {
    id: SESSION_ID,
    user_id: USER_ID,
    vocabulary_set_id: SET_ID,
    set_id_snapshot: SET_ID,
    mode: "NORMAL",
    status: "ACTIVE",
    create_operation_id: "66666666-6666-4666-8666-666666666666",
    snapshot_size: 2,
    created_at: new Date("2026-10-18T03:00:00.000Z"),
    expires_at: new Date("2026-10-25T03:00:00.000Z"),
    completed_at: null,
    completion_event_id: null,
    items: snapshotItems().map((item, index) => ({
      id: `item-${index}`,
      session_id: SESSION_ID,
      ...item,
      evidence: null,
      evidence_event_id: null,
      evidence_at: null,
    })),
  };
}

function snapshotItems() {
  return ITEM_IDS.map((vocabulary_id, position) => ({ vocabulary_id, position }));
}

function resolvedItems(evidence) {
  return activeSession().items.map((item, index) => ({
    ...item,
    evidence,
    evidence_event_id: `99999999-9999-4999-8999-99999999999${index}`,
    evidence_at: new Date("2026-10-18T03:00:00.000Z"),
  }));
}

function fakeTransaction(calls) {
  return {
    lEARNING_SESSION: {
      async create(args) {
        calls.push({ name: "session.create", args });
        return args.data;
      },
      async findFirst(args) {
        calls.push({ name: "session.findFirst", args });
        return null;
      },
      async findUnique(args) {
        calls.push({ name: "session.findUnique", args });
        return null;
      },
      async updateMany(args) {
        calls.push({ name: "session.updateMany", args });
        return { count: 1 };
      },
    },
    lEARNING_SESSION_ITEM: {
      async findUnique(args) {
        calls.push({ name: "item.findUnique", args });
        return null;
      },
      async updateMany(args) {
        calls.push({ name: "item.updateMany", args });
        return { count: 1 };
      },
    },
    lEARNING_SESSION_SRS_RECEIPT: {
      async findUnique(args) {
        calls.push({ name: "receipt.findUnique", args });
        return null;
      },
      async create(args) {
        calls.push({ name: "receipt.create", args });
        return args.data;
      },
    },
    sTREAK_DAY: {
      async findMany(args) {
        calls.push({ name: "streak.findMany", args });
        return [
          { activity_date: new Date("2026-10-18T00:00:00.000Z") },
          { activity_date: new Date("2026-10-17T00:00:00.000Z") },
        ];
      },
    },
    async $queryRaw(strings, ...values) {
      calls.push({ name: "queryRaw", sql: strings.join("?"), values });
      return [{ id: SESSION_ID }];
    },
    async $executeRaw(strings, ...values) {
      calls.push({ name: "streak.insert", sql: strings.join("?"), values });
      return 1;
    },
  };
}

function hasCode(code) {
  return (error) => error?.code === code;
}
