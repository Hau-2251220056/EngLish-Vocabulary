import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createLearningSessionController } from "../../src/controllers/learning-session-controller.js";
import { assertCompleteGroup } from "../../src/repositories/learning-session-repository.js";
import {
  createLearningSessionService,
  createStreakService,
} from "../../src/services/learning-session-service.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_USER_ID = "22222222-2222-4222-8222-222222222222";
const SET_ID = "33333333-3333-4333-8333-333333333333";
const SESSION_ID = "44444444-4444-4444-8444-444444444444";
const VOCABULARY_IDS = [
  "55555555-5555-4555-8555-555555555555",
  "66666666-6666-4666-8666-666666666666",
];
const CREATE_ID = "77777777-7777-4777-8777-777777777777";
const EVENT_IDS = [
  "88888888-8888-4888-8888-888888888888",
  "99999999-9999-4999-8999-999999999999",
  "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
];
const NOW = new Date("2026-10-18T16:59:59.999Z");

test("create validates strict mode-specific fields before opening a transaction", async () => {
  let transactions = 0;
  const service = createService(createState(), {
    withTransaction: async () => { transactions += 1; },
  });
  await assert.rejects(
    service.createSession(USER_ID, { operation_id: CREATE_ID, set_id: SET_ID, mode: "SRS", vocabulary_ids: [] }),
    hasCode("LEARNING_SESSION_VALIDATION_ERROR"),
  );
  await assert.rejects(
    service.createSession(USER_ID, { operation_id: CREATE_ID, set_id: SET_ID, mode: "NORMAL", vocabulary_ids: VOCABULARY_IDS, owner_id: USER_ID }),
    hasCode("LEARNING_SESSION_VALIDATION_ERROR"),
  );
  assert.equal(transactions, 0);
});

test("each operation captures one authoritative instant only after transaction entry", async () => {
  const state = createState();
  let insideTransaction = false;
  let clockCalls = 0;
  const service = createLearningSessionService({
    withTransaction: async (callback) => {
      insideTransaction = true;
      try { return await callback(state); } finally { insideTransaction = false; }
    },
    createSessionRepository: () => fakeSessionRepository(state),
    createStreakRepository: () => fakeStreakRepository(state),
    createLearningRepository: () => fakeLearningRepository(state),
    now: () => {
      assert.equal(insideTransaction, true);
      clockCalls += 1;
      return NOW;
    },
    uuid: () => SESSION_ID,
  });
  await service.createSession(USER_ID, {
    operation_id: CREATE_ID,
    set_id: SET_ID,
    mode: "NORMAL",
    vocabulary_ids: VOCABULARY_IDS,
  });
  assert.equal(clockCalls, 1);
});

test("reveal captures its instant after session, item and snapshot locks", async () => {
  const state = createState();
  const events = [];
  let instant = NOW;
  const service = createLearningSessionService({
    withTransaction: (callback) => callback(state),
    createSessionRepository: () => {
      const repository = fakeSessionRepository(state);
      return {
        ...repository,
        lockOwnedSession: async (...args) => {
          events.push("session-lock");
          return repository.lockOwnedSession(...args);
        },
        lockSessionItem: async (...args) => {
          events.push("item-lock");
          return repository.lockSessionItem(...args);
        },
      };
    },
    createStreakRepository: () => fakeStreakRepository(state),
    createLearningRepository: () => {
      const repository = fakeLearningRepository(state);
      return {
        ...repository,
        lockAccessibleSetForUser: async (...args) => {
          events.push("set-lock");
          return repository.lockAccessibleSetForUser(...args);
        },
        lockSetItem: async (...args) => {
          events.push("set-item-lock");
          const result = await repository.lockSetItem(...args);
          instant = new Date("2026-10-25T16:59:59.999Z");
          return result;
        },
      };
    },
    now: () => {
      events.push("clock");
      return instant;
    },
    uuid: () => SESSION_ID,
  });
  await service.createSession(USER_ID, {
    operation_id: CREATE_ID,
    set_id: SET_ID,
    mode: "NORMAL",
    vocabulary_ids: VOCABULARY_IDS,
  });
  events.length = 0;
  await assert.rejects(
    service.acknowledgeNormalReveal(
      USER_ID,
      SESSION_ID,
      VOCABULARY_IDS[0],
      { operation_id: EVENT_IDS[0] },
    ),
    hasCode("LEARNING_SESSION_EXPIRED"),
  );
  assert.deepEqual(events, [
    "session-lock",
    "item-lock",
    "set-lock",
    "set-item-lock",
    "set-item-lock",
    "clock",
  ]);
  assert.equal(state.sessions[0].items[0].evidence, null);
});

test("NORMAL creation normalizes an immutable bounded ordered snapshot and exact replay", async () => {
  const state = createState();
  const service = createService(state);
  const request = { operation_id: CREATE_ID, set_id: SET_ID, mode: "NORMAL", vocabulary_ids: VOCABULARY_IDS };
  const created = await service.createSession(USER_ID, request);
  assert.equal(created.replayed, false);
  assert.equal(created.session.id, SESSION_ID);
  assert.deepEqual(created.session.items.map(({ vocabulary_id, position }) => ({ vocabulary_id, position })), [
    { vocabulary_id: VOCABULARY_IDS[0], position: 0 },
    { vocabulary_id: VOCABULARY_IDS[1], position: 1 },
  ]);
  assert.equal(created.session.expires_at.toISOString(), "2026-10-25T16:59:59.999Z");
  const replay = await service.createSession(USER_ID, request);
  assert.equal(replay.replayed, true);
  assert.equal(state.sessions.length, 1);
});

test("creation replay rejects mismatched payload and remains scoped to the authenticated USER", async () => {
  const state = createState();
  const service = createService(state);
  await service.createSession(USER_ID, {
    operation_id: CREATE_ID,
    set_id: SET_ID,
    mode: "NORMAL",
    vocabulary_ids: VOCABULARY_IDS,
  });
  await assert.rejects(
    service.createSession(USER_ID, {
      operation_id: CREATE_ID,
      set_id: SET_ID,
      mode: "NORMAL",
      vocabulary_ids: [VOCABULARY_IDS[0]],
    }),
    hasCode("LEARNING_SESSION_OPERATION_CONFLICT"),
  );

  const otherSessionId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const otherService = createService(state, { uuid: () => otherSessionId });
  const otherUserResult = await otherService.createSession(OTHER_USER_ID, {
    operation_id: CREATE_ID,
    set_id: SET_ID,
    mode: "NORMAL",
    vocabulary_ids: VOCABULARY_IDS,
  });
  assert.equal(otherUserResult.replayed, false);
  assert.equal(otherUserResult.session.id, otherSessionId);
  assert.equal(state.sessions.find((session) => session.id === otherSessionId).user_id, OTHER_USER_ID);
});

test("creation rejects duplicates, invalid order and empty proposed group for a non-empty Set", async () => {
  const service = createService(createState());
  for (const vocabulary_ids of [
    [VOCABULARY_IDS[0], VOCABULARY_IDS[0]],
    [VOCABULARY_IDS[1], VOCABULARY_IDS[0]],
    [],
  ]) {
    await assert.rejects(
      service.createSession(USER_ID, { operation_id: CREATE_ID, set_id: SET_ID, mode: "QUIZ", vocabulary_ids }),
      hasCode("LEARNING_SESSION_VALIDATION_ERROR"),
    );
  }
});

test("SRS snapshot is Backend-authored from current eligibility/order and up-to-date creates no session", async () => {
  const state = createState();
  state.setItems[0].vocabulary.learning_progress = [{ status: "LEARNED", interval_days: 1, next_review_at: new Date("2026-10-18T00:00:00Z") }];
  state.setItems[1].vocabulary.learning_progress = [];
  const service = createService(state);
  const result = await service.createSession(USER_ID, { operation_id: CREATE_ID, set_id: SET_ID, mode: "SRS" });
  assert.deepEqual(result.session.items.map((item) => item.vocabulary_id), [VOCABULARY_IDS[0], VOCABULARY_IDS[1]]);

  const upToDate = createState();
  for (const item of upToDate.setItems) {
    item.vocabulary.learning_progress = [{ status: "LEARNED", interval_days: 1, next_review_at: new Date("2026-10-19T00:00:00Z") }];
  }
  const emptyResult = await createService(upToDate).createSession(USER_ID, { operation_id: CREATE_ID, set_id: SET_ID, mode: "SRS" });
  assert.deepEqual(emptyResult, { session: null, reason: "SRS_UP_TO_DATE", replayed: false });
});

test("exact SRS creation replay does not recompute mutable eligibility", async () => {
  const state = createState();
  const service = createService(state);
  const request = { operation_id: CREATE_ID, set_id: SET_ID, mode: "SRS" };
  const created = await service.createSession(USER_ID, request);
  for (const item of state.setItems) {
    item.vocabulary.learning_progress = [{
      status: "LEARNED",
      interval_days: 1,
      next_review_at: new Date("2026-10-19T00:00:00Z"),
    }];
  }
  state.accessible = false;
  const replay = await service.createSession(USER_ID, request);
  assert.equal(replay.replayed, true);
  assert.equal(replay.session.id, created.session.id);
  assert.deepEqual(replay.session.items, created.session.items);
});

test("new creation locks and rechecks every selected Set member before persistence", async () => {
  const state = createState();
  state.recheckedSetItems = [state.setItems[0]];
  await assert.rejects(
    createService(state).createSession(USER_ID, {
      operation_id: CREATE_ID,
      set_id: SET_ID,
      mode: "NORMAL",
      vocabulary_ids: VOCABULARY_IDS,
    }),
    hasCode("LEARNING_SESSION_INACCESSIBLE"),
  );
  assert.deepEqual(state.lockedVocabularyIds, VOCABULARY_IDS);
  assert.equal(state.sessions.length, 0);
});

test("SRS creation protects every Set member Progress identity before eligibility recheck", async () => {
  const state = createState();
  await createService(state).createSession(USER_ID, {
    operation_id: CREATE_ID,
    set_id: SET_ID,
    mode: "SRS",
  });
  assert.deepEqual(state.progressIdentityLocks, [...VOCABULARY_IDS].sort());
  assert.equal(state.setReadCount, 2);
});

test("concurrent same-operation create collision reconciles the committed exact session", async () => {
  for (const target of [
    ["user_id", "create_operation_id"],
    "LEARNING_SESSION_user_id_create_operation_id_key",
  ]) {
    const state = createState();
    state.createCollisionOnce = true;
    state.createCollisionTarget = target;
    const result = await createService(state).createSession(USER_ID, {
      operation_id: CREATE_ID,
      set_id: SET_ID,
      mode: "NORMAL",
      vocabulary_ids: VOCABULARY_IDS,
    });
    assert.equal(result.replayed, true);
    assert.equal(result.session.id, SESSION_ID);
    assert.equal(state.sessions.length, 1);
    assert.equal(state.transactionCount, 2);
  }
});

test("unrelated or unidentified P2002 creation failures are not reconciled as replay", async () => {
  for (const target of [undefined, ["id"], "LEARNING_SESSION_pkey"]) {
    const state = createState();
    state.createCollisionOnce = true;
    state.createCollisionTarget = target;
    await assert.rejects(
      createService(state).createSession(USER_ID, {
        operation_id: CREATE_ID,
        set_id: SET_ID,
        mode: "NORMAL",
        vocabulary_ids: VOCABULARY_IDS,
      }),
      (error) => error?.code === "P2002" && error.meta?.target === target,
    );
    assert.equal(state.transactionCount, 1);
  }
});

test("owner-scoped read conceals foreign sessions and reports inaccessible snapshots without shrinking", async () => {
  const state = createState();
  const service = createService(state);
  await service.createSession(USER_ID, { operation_id: CREATE_ID, set_id: SET_ID, mode: "NORMAL", vocabulary_ids: VOCABULARY_IDS });
  await assert.rejects(service.readSession(OTHER_USER_ID, SESSION_ID), hasCode("LEARNING_SESSION_NOT_FOUND"));
  state.accessible = false;
  const read = await service.readSession(USER_ID, SESSION_ID);
  assert.equal(read.can_continue, false);
  assert.equal(read.restart_reason, "SESSION_INACCESSIBLE");
  assert.equal(read.snapshot_size, 2);
});

test("NORMAL reveal uses one operation instant, rechecks access and is idempotent", async () => {
  const state = createState();
  const service = createService(state);
  await service.createSession(USER_ID, { operation_id: CREATE_ID, set_id: SET_ID, mode: "NORMAL", vocabulary_ids: VOCABULARY_IDS });
  const first = await service.acknowledgeNormalReveal(USER_ID, SESSION_ID, VOCABULARY_IDS[0], { operation_id: EVENT_IDS[0] });
  assert.equal(first.item.evidence, "NORMAL_REVEALED");
  assert.equal(first.replayed, false);
  assert.equal(state.sessions[0].items[0].evidence_at.toISOString(), NOW.toISOString());
  const replay = await service.acknowledgeNormalReveal(USER_ID, SESSION_ID, VOCABULARY_IDS[0], { operation_id: EVENT_IDS[0] });
  assert.equal(replay.replayed, true);
  const duplicate = await service.acknowledgeNormalReveal(USER_ID, SESSION_ID, VOCABULARY_IDS[0], { operation_id: EVENT_IDS[1] });
  assert.equal(duplicate.already_acknowledged, true);

  state.accessible = false;
  await assert.rejects(
    service.acknowledgeNormalReveal(USER_ID, SESSION_ID, VOCABULARY_IDS[1], { operation_id: EVENT_IDS[1] }),
    hasCode("LEARNING_SESSION_INACCESSIBLE"),
  );
});

test("NORMAL reveal rechecks the entire snapshot, not only the target item", async () => {
  const state = createState();
  const service = createService(state);
  await service.createSession(USER_ID, { operation_id: CREATE_ID, set_id: SET_ID, mode: "NORMAL", vocabulary_ids: VOCABULARY_IDS });
  state.setItems = [state.setItems[0]];
  await assert.rejects(
    service.acknowledgeNormalReveal(USER_ID, SESSION_ID, VOCABULARY_IDS[0], { operation_id: EVENT_IDS[0] }),
    hasCode("LEARNING_SESSION_INACCESSIBLE"),
  );
  assert.equal(state.sessions[0].items[0].evidence, null);
});

test("exact reveal replay succeeds after expiry/completion while new evidence fails at equality", async () => {
  const state = createState();
  let instant = NOW;
  const service = createService(state, { now: () => instant });
  await service.createSession(USER_ID, { operation_id: CREATE_ID, set_id: SET_ID, mode: "NORMAL", vocabulary_ids: VOCABULARY_IDS });
  await service.acknowledgeNormalReveal(USER_ID, SESSION_ID, VOCABULARY_IDS[0], { operation_id: EVENT_IDS[0] });
  instant = new Date("2026-10-25T16:59:59.999Z");
  const expiredReplay = await service.acknowledgeNormalReveal(USER_ID, SESSION_ID, VOCABULARY_IDS[0], { operation_id: EVENT_IDS[0] });
  assert.equal(expiredReplay.replayed, true);
  assert.equal(expiredReplay.session.state, "EXPIRED");
  await assert.rejects(
    service.acknowledgeNormalReveal(USER_ID, SESSION_ID, VOCABULARY_IDS[1], { operation_id: EVENT_IDS[1] }),
    hasCode("LEARNING_SESSION_EXPIRED"),
  );

  state.sessions[0].status = "COMPLETED";
  state.sessions[0].completed_at = new Date("2026-10-18T17:00:00.000Z");
  state.sessions[0].completion_event_id = EVENT_IDS[2];
  const completedReplay = await service.acknowledgeNormalReveal(USER_ID, SESSION_ID, VOCABULARY_IDS[0], { operation_id: EVENT_IDS[0] });
  assert.equal(completedReplay.replayed, true);
  assert.equal(completedReplay.session.state, "COMPLETED");
});

test("cross-user evidence replay is rejected without returning the foreign session", async () => {
  const state = createState();
  const service = createService(state);
  await service.createSession(USER_ID, { operation_id: CREATE_ID, set_id: SET_ID, mode: "NORMAL", vocabulary_ids: VOCABULARY_IDS });
  await service.acknowledgeNormalReveal(USER_ID, SESSION_ID, VOCABULARY_IDS[0], { operation_id: EVENT_IDS[0] });
  const foreignSession = structuredClone(state.sessions[0]);
  foreignSession.id = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  foreignSession.user_id = OTHER_USER_ID;
  foreignSession.create_operation_id = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  foreignSession.items = foreignSession.items.map((item, index) => ({
    ...item,
    id: `foreign-item-${index}`,
    session_id: foreignSession.id,
    evidence: null,
    evidence_event_id: null,
    evidence_at: null,
  }));
  state.sessions.push(foreignSession);
  await assert.rejects(
    service.acknowledgeNormalReveal(OTHER_USER_ID, foreignSession.id, VOCABULARY_IDS[0], { operation_id: EVENT_IDS[0] }),
    hasCode("LEARNING_SESSION_EVENT_CONFLICT"),
  );
  assert.equal(foreignSession.items[0].evidence, null);
});

test("NORMAL completion rejects incomplete groups then atomically returns authoritative Streak", async () => {
  const state = createState();
  const service = createService(state);
  await service.createSession(USER_ID, { operation_id: CREATE_ID, set_id: SET_ID, mode: "NORMAL", vocabulary_ids: VOCABULARY_IDS });
  await service.acknowledgeNormalReveal(USER_ID, SESSION_ID, VOCABULARY_IDS[0], { operation_id: EVENT_IDS[0] });
  await assert.rejects(
    service.completeNormalSession(USER_ID, SESSION_ID, { operation_id: EVENT_IDS[2] }),
    hasCode("LEARNING_SESSION_INCOMPLETE"),
  );
  assert.equal(state.streakDates.length, 0);
  await service.acknowledgeNormalReveal(USER_ID, SESSION_ID, VOCABULARY_IDS[1], { operation_id: EVENT_IDS[1] });
  const completed = await service.completeNormalSession(USER_ID, SESSION_ID, { operation_id: EVENT_IDS[2] });
  assert.equal(completed.session.state, "COMPLETED");
  assert.equal(completed.streak.current_streak, 1);
  assert.equal(completed.streak.last_qualified_date, "2026-10-18");
  assert.equal(state.progressWrites, 0);
  assert.equal(state.xpWrites, 0);
  const replay = await service.completeNormalSession(USER_ID, SESSION_ID, { operation_id: EVENT_IDS[2] });
  assert.equal(replay.replayed, true);
  assert.equal(state.streakDates.length, 1);
});

test("Streak read is side-effect free and controller preserves the response envelope", async () => {
  const state = createState();
  state.streakDates.push("2026-10-17");
  const streakService = createStreakService({
    withTransaction: (callback) => callback(state),
    createStreakRepository: () => fakeStreakRepository(state),
    now: () => NOW,
  });
  const projection = await streakService.getCurrentStreak(USER_ID);
  assert.equal(projection.current_streak, 1);
  assert.equal(projection.completed_today, false);
  assert.equal(state.streakWrites, 0);

  const calls = [];
  const controller = createLearningSessionController({
    learningSessionService: {
      createSession: async () => ({ session: null, reason: "EMPTY_SET", replayed: false }),
      readSession: async () => ({ id: SESSION_ID }),
      acknowledgeNormalReveal: async () => ({ replayed: false }),
      completeNormalSession: async () => ({ replayed: false }),
    },
    streakService: { getCurrentStreak: async (userId) => { calls.push(userId); return projection; } },
  });
  const response = fakeResponse();
  await controller.readStreak({ user: { id: USER_ID } }, response, assertNoNext);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, { success: true, data: projection });
  assert.deepEqual(calls, [USER_ID]);
});

test("route declarations expose only the approved session and Streak paths", async () => {
  const source = await readFile(new URL("../../src/routes/learning-session-routes.js", import.meta.url), "utf8");
  assert.match(source, /router\.post\("\/", controller\.create\)/);
  assert.match(source, /router\.get\("\/:sessionId", controller\.read\)/);
  assert.match(source, /items\/:vocabularyId\/reveal/);
  assert.match(source, /router\.post\("\/:sessionId\/complete", controller\.complete\)/);
  assert.match(source, /router\.get\("\/streak", controller\.readStreak\)/);
  assert.doesNotMatch(source, /"\/api\/streak"/);
});

function createService(state, overrides = {}) {
  return createLearningSessionService({
    withTransaction: (callback) => {
      state.transactionCount += 1;
      return callback(state);
    },
    createSessionRepository: () => fakeSessionRepository(state),
    createStreakRepository: () => fakeStreakRepository(state),
    createLearningRepository: () => fakeLearningRepository(state),
    now: () => NOW,
    uuid: () => SESSION_ID,
    ...overrides,
  });
}

function createState() {
  return {
    accessible: true,
    sessions: [],
    streakDates: [],
    progressWrites: 0,
    xpWrites: 0,
    streakWrites: 0,
    transactionCount: 0,
    setReadCount: 0,
    lockedVocabularyIds: [],
    progressIdentityLocks: [],
    setItems: VOCABULARY_IDS.map((id, position) => ({
      position,
      vocabulary: { id, learning_progress: [] },
    })),
  };
}

function fakeLearningRepository(state) {
  return {
    findAccessibleSetForUser: async () => {
      state.setReadCount += 1;
      if (!state.accessible) return null;
      const items = state.setReadCount > 1 && state.recheckedSetItems
        ? state.recheckedSetItems
        : state.setItems;
      return { id: SET_ID, items };
    },
    lockAccessibleSetForUser: async () => state.accessible ? { id: SET_ID } : null,
    lockAccessibleSetForSessionSnapshot: async () => state.accessible ? { id: SET_ID } : null,
    lockSetItem: async (_setId, vocabularyId) => {
      state.lockedVocabularyIds.push(vocabularyId);
      return state.setItems.some((item) => item.vocabulary.id === vocabularyId) ? { id: vocabularyId } : null;
    },
    lockProgressIdentity: async (_userId, vocabularyId) => {
      state.progressIdentityLocks.push(vocabularyId);
      return { lock_result: "" };
    },
  };
}

function fakeSessionRepository(state) {
  const find = (id, userId) => state.sessions.find((session) => session.id === id && session.user_id === userId) ?? null;
  return {
    findCreationReplay: async (userId, operationId) => state.sessions.find((session) => session.user_id === userId && session.create_operation_id === operationId) ?? null,
    createSessionWithItems: async (input) => {
      const session = {
        ...input,
        status: "ACTIVE",
        completed_at: null,
        completion_event_id: null,
        items: input.items.map((item, index) => ({ id: `item-${index}`, session_id: input.id, ...item, evidence: null, evidence_event_id: null, evidence_at: null })),
      };
      state.sessions.push(session);
      if (state.createCollisionOnce) {
        state.createCollisionOnce = false;
        const error = new Error("simulated concurrent create operation collision");
        error.code = "P2002";
        error.meta = {
          target: Object.hasOwn(state, "createCollisionTarget")
            ? state.createCollisionTarget
            : ["user_id", "create_operation_id"],
        };
        throw error;
      }
      return session;
    },
    findOwnedSession: async (id, userId) => find(id, userId),
    lockOwnedSession: async (id, userId) => find(id, userId),
    lockSessionItem: async (sessionId, vocabularyId) => state.sessions.find((session) => session.id === sessionId)?.items.find((item) => item.vocabulary_id === vocabularyId) ?? null,
    lockSessionItems: async (sessionId) => state.sessions.find((session) => session.id === sessionId).items,
    findEvidenceReplay: async (eventId) => state.sessions.flatMap((session) => session.items).find((item) => item.evidence_event_id === eventId) ?? null,
    recordEvidence: async ({ item, evidence, eventId, acceptedAt }) => {
      Object.assign(item, { evidence, evidence_event_id: eventId, evidence_at: new Date(acceptedAt) });
      return { count: 1 };
    },
    findCompletionReplay: async (userId, eventId) => state.sessions.find((session) => session.user_id === userId && session.completion_event_id === eventId) ?? null,
    completeSession: async ({ session, items, completionEventId, acceptedAt }) => {
      assertCompleteGroup(session, items);
      Object.assign(session, { status: "COMPLETED", completion_event_id: completionEventId, completed_at: new Date(acceptedAt) });
      return { count: 1 };
    },
  };
}

function fakeStreakRepository(state) {
  return {
    insertDayForCompletedSession: async ({ activityDate }) => {
      const inserted = !state.streakDates.includes(activityDate);
      if (inserted) state.streakDates.push(activityDate);
      state.streakWrites += inserted ? 1 : 0;
      return { inserted };
    },
    listActivityDatesThrough: async (_userId, throughDate) => state.streakDates.filter((date) => date <= throughDate).sort().reverse(),
  };
}

function hasCode(code) {
  return (error) => error?.code === code;
}

function fakeResponse() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function assertNoNext(error) {
  assert.fail(`Unexpected next(error): ${error?.message ?? error}`);
}
