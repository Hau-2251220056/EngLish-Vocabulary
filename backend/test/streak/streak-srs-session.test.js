import assert from "node:assert/strict";
import test from "node:test";
import { createLearningService } from "../../src/services/learning-service.js";

const USER = "11111111-1111-4111-8111-111111111111";
const SET = "22222222-2222-4222-8222-222222222222";
const VOCABULARY = "33333333-3333-4333-8333-333333333333";
const SESSION = "44444444-4444-4444-8444-444444444444";
const EVENT = "55555555-5555-4555-8555-555555555555";
const OTHER_USER = "77777777-7777-4777-8777-777777777777";
const OTHER_SESSION = "88888888-8888-4888-8888-888888888888";
const NOW = new Date("2026-10-18T03:00:00.000Z");

test("session-aware AGAIN preserves unresolved item and existing zero-XP Progress semantics", async () => {
  const fixture = createFixture();
  const result = await fixture.service.recordMeaningfulEvent(USER, event("AGAIN"));
  assert.equal(result.session.state, "ACTIVE");
  assert.equal(result.session.completed_items, 0);
  assert.equal(result.session.items[0].evidence, null);
  assert.equal(result.reward.xp_earned, 0);
  assert.equal(result.revision, 1);
  assert.equal(fixture.session.status, "ACTIVE");
  assert.equal(fixture.streakDates.length, 0);
  assert.equal(fixture.receipts.length, 1);
  assert.equal(fixture.receipts[0].rating, "AGAIN");
});

test("multiple AGAIN operations create receipts and keep the item unresolved", async () => {
  const fixture = createFixture();
  await fixture.service.recordMeaningfulEvent(USER, event("AGAIN"));
  await fixture.service.recordMeaningfulEvent(USER, event("AGAIN", {
    event_id: "99999999-9999-4999-8999-999999999991",
    expected_revision: 1,
  }));
  assert.equal(fixture.receipts.length, 2);
  assert.equal(fixture.progress.revision, 2);
  assert.equal(fixture.item.evidence, null);
  assert.equal(fixture.session.status, "ACTIVE");
});

test("final passing rating atomically resolves evidence, completes and returns Streak", async () => {
  const fixture = createFixture();
  const result = await fixture.service.recordMeaningfulEvent(USER, event("GOOD"));
  assert.equal(result.session.state, "COMPLETED");
  assert.equal(result.session.items[0].evidence, "SRS_GOOD");
  assert.equal(result.reward.xp_earned, 3);
  assert.equal(result.streak.current_streak, 1);
  assert.equal(fixture.session.status, "COMPLETED");
  assert.deepEqual(fixture.streakDates, ["2026-10-18"]);

  fixture.accessible = false;
  const replay = await fixture.service.recordMeaningfulEvent(USER, event("GOOD"));
  assert.equal(replay.reward.replayed, true);
  assert.equal(replay.reward.xp_earned, 3);
  assert.equal(replay.session.state, "COMPLETED");
  assert.deepEqual(fixture.streakDates, ["2026-10-18"]);
});

test("session identity and inaccessible snapshots reject without Progress or evidence mutation", async () => {
  const wrongMode = createFixture({ mode: "NORMAL" });
  await assert.rejects(wrongMode.service.recordMeaningfulEvent(USER, event("GOOD")), {
    code: "LEARNING_SESSION_EVENT_CONFLICT",
  });
  const inaccessible = createFixture();
  inaccessible.accessible = false;
  await assert.rejects(inaccessible.service.recordMeaningfulEvent(USER, event("GOOD")), {
    code: "LEARNING_SESSION_INACCESSIBLE",
  });
  assert.equal(inaccessible.progress, null);
  assert.equal(inaccessible.item.evidence, null);

  const reused = createFixture();
  reused.foreignEvidence = {
    ...reused.item,
    session_id: "99999999-9999-4999-8999-999999999999",
    evidence: "SRS_GOOD",
    evidence_event_id: EVENT,
    session: { user_id: USER },
  };
  await assert.rejects(reused.service.recordMeaningfulEvent(USER, event("GOOD")), {
    code: "LEARNING_SESSION_EVENT_CONFLICT",
  });
  assert.equal(reused.progress, null);
});

test("receipt replay conceals foreign ownership and conflicts across same-owner sessions", async () => {
  const foreign = createFixture();
  foreign.receipts.push(receiptFor(foreign, {
    session_id: OTHER_SESSION,
    user_id: OTHER_USER,
  }));
  await assert.rejects(foreign.service.recordMeaningfulEvent(USER, event("AGAIN")), {
    code: "LEARNING_SESSION_NOT_FOUND",
  });

  const sameOwner = createFixture();
  sameOwner.receipts.push(receiptFor(sameOwner, { session_id: OTHER_SESSION }));
  await assert.rejects(sameOwner.service.recordMeaningfulEvent(USER, event("AGAIN")), {
    code: "LEARNING_SESSION_EVENT_CONFLICT",
  });
});

test("current receipt replays exactly while an older Progress event is stale", async () => {
  const fixture = createFixture();
  const accepted = await fixture.service.recordMeaningfulEvent(USER, event("AGAIN"));
  const replay = await fixture.service.recordMeaningfulEvent(USER, event("AGAIN"));
  assert.equal(replay.reward.replayed, true);
  assert.equal(replay.revision, accepted.revision);

  fixture.progress = {
    ...fixture.progress,
    revision: 2,
    last_event_id: "99999999-9999-4999-8999-999999999992",
  };
  await assert.rejects(fixture.service.recordMeaningfulEvent(USER, event("AGAIN")), {
    code: "LEARNING_PROGRESS_CHANGED",
  });
  assert.equal(fixture.receipts.length, 1);
});

test("receipt P2002 reconciles exact constraint metadata while unrelated P2002 fails closed", async () => {
  const collision = createFixture({ receiptCollision: "receipt" });
  const reconciled = await collision.service.recordMeaningfulEvent(USER, event("AGAIN"));
  assert.equal(reconciled.reward.replayed, true);
  assert.equal(collision.receipts.length, 1);

  const unrelated = createFixture({ receiptCollision: "unrelated" });
  await assert.rejects(
    unrelated.service.recordMeaningfulEvent(USER, event("AGAIN")),
    (error) => error?.code === "P2002" && error?.meta?.target === "unrelated_unique_key",
  );
});

test("sessionless SRS never calls session or Streak factories", async () => {
  const fixture = createFixture();
  let sessionCalls = 0;
  const service = createLearningService({
    learningRepository: fixture.learningRepository,
    createSessionRepository() { sessionCalls += 1; throw new Error("unexpected session call"); },
    createStreakRepository() { throw new Error("unexpected streak call"); },
    now: () => new Date(NOW),
  });
  const { session_id: _sessionId, ...legacy } = event("GOOD");
  const result = await service.recordMeaningfulEvent(USER, legacy);
  assert.equal(result.session, undefined);
  assert.equal(result.streak, undefined);
  assert.equal(sessionCalls, 0);
});

function event(rating, overrides = {}) {
  return {
    event_id: EVENT,
    session_id: SESSION,
    set_id: SET,
    vocabulary_id: VOCABULARY,
    expected_revision: 0,
    rating,
    ...overrides,
  };
}

function createFixture({ mode = "SRS", receiptCollision = null } = {}) {
  const fixture = {
    accessible: true,
    progress: null,
    rewards: [],
    receipts: [],
    totalXp: 0,
    streakDates: [],
    item: {
      id: "item-1", session_id: SESSION, vocabulary_id: VOCABULARY, position: 0,
      evidence: null, evidence_event_id: null, evidence_at: null,
    },
  };
  fixture.session = {
    id: SESSION, user_id: USER, vocabulary_set_id: SET, set_id_snapshot: SET,
    mode, status: "ACTIVE", create_operation_id: "66666666-6666-4666-8666-666666666666",
    snapshot_size: 1, created_at: new Date("2026-10-18T02:00:00.000Z"),
    expires_at: new Date("2026-10-25T02:00:00.000Z"), completed_at: null,
    completion_event_id: null, items: [fixture.item],
  };

  const learningMethods = {
    lockAccessibleSetForUser: async () => fixture.accessible ? { id: SET } : null,
    lockAccessibleSetForSessionSnapshot: async () => fixture.accessible ? { id: SET } : null,
    lockSetItem: async () => fixture.accessible ? { id: "set-item" } : null,
    lockProgressIdentity: async () => ({}),
    findProgress: async () => fixture.progress,
    findRewardByIdentity: async (_user, vocabularyId, type, cycle) => fixture.rewards.find(
      (reward) => reward.vocabulary_id === vocabularyId && reward.reward_type === type
        && reward.reward_cycle === cycle,
    ) ?? null,
    findRewardBySourceEvent: async (_user, sourceEventId) => fixture.rewards.find(
      (reward) => reward.source_event_id === sourceEventId,
    ) ?? null,
    readUserTotalXp: async () => fixture.totalXp,
    createProgress: async (data) => {
      fixture.progress = { id: "progress-1", ...data };
      return fixture.progress;
    },
    updateProgressAtRevision: async (_id, revision, data) => {
      if (!fixture.progress || fixture.progress.revision !== revision) return { count: 0 };
      fixture.progress = {
        ...fixture.progress,
        ...data,
        review_count: fixture.progress.review_count + (data.review_count?.increment ?? 0),
        revision: fixture.progress.revision + (data.revision?.increment ?? 0),
      };
      return { count: 1 };
    },
    insertRewardAndIncrementXp: async (data) => {
      fixture.rewards.push(data);
      fixture.totalXp += data.xp_amount;
      return { reward: data, total_xp: fixture.totalXp };
    },
  };
  fixture.learningRepository = {
    ...learningMethods,
    withTransaction: (callback) => callback(learningMethods, {}),
  };
  fixture.service = createLearningService({
    learningRepository: fixture.learningRepository,
    createSessionRepository: () => ({
      lockOwnedSession: async (sessionId, userId) => (
        sessionId === SESSION && userId === USER ? fixture.session : null
      ),
      lockSessionItems: async () => [fixture.item],
      findEvidenceReplay: async (eventId) => fixture.foreignEvidence
        ?? (fixture.item.evidence_event_id === eventId ? fixture.item : null),
      findSrsReceipt: async (eventId) => fixture.receipts.find(
        (receipt) => receipt.event_id === eventId,
      ) ?? null,
      recordSrsReceipt: async (input) => {
        const receipt = receiptFor(fixture, {
          event_id: input.eventId,
          rating: input.rating,
          expected_revision: input.expectedRevision,
          accepted_revision: input.acceptedRevision,
          accepted_at: input.acceptedAt,
        });
        if (receiptCollision === "receipt" && fixture.receipts.length === 0) {
          fixture.receipts.push(receipt);
          const error = Object.assign(new Error("receipt collision"), {
            code: "P2002", meta: {
              modelName: "LEARNING_SESSION_SRS_RECEIPT",
              target: ["event_id"],
            },
          });
          throw error;
        }
        if (receiptCollision === "unrelated") {
          throw Object.assign(new Error("unrelated collision"), {
            code: "P2002", meta: { target: "unrelated_unique_key" },
          });
        }
        fixture.receipts.push(receipt);
        return receipt;
      },
      findCompletionReplay: async (userId, eventId) => (
        fixture.session.user_id === userId && fixture.session.completion_event_id === eventId
          ? fixture.session : null
      ),
      recordEvidence: async ({ evidence, eventId, acceptedAt }) => {
        Object.assign(fixture.item, {
          evidence, evidence_event_id: eventId, evidence_at: new Date(acceptedAt),
        });
        return { count: 1 };
      },
      completeSession: async ({ completionEventId, acceptedAt }) => {
        Object.assign(fixture.session, {
          status: "COMPLETED", completed_at: new Date(acceptedAt),
          completion_event_id: completionEventId,
        });
        return { count: 1 };
      },
    }),
    createStreakRepository: () => ({
      insertDayForCompletedSession: async ({ activityDate }) => {
        const inserted = !fixture.streakDates.includes(activityDate);
        if (inserted) fixture.streakDates.push(activityDate);
        return { inserted };
      },
      listActivityDatesThrough: async () => [...fixture.streakDates].reverse(),
    }),
    now: () => new Date(NOW),
  });
  return fixture;
}

function receiptFor(fixture, overrides = {}) {
  const sessionId = overrides.session_id ?? SESSION;
  const userId = overrides.user_id ?? USER;
  return {
    event_id: EVENT,
    session_item_id: fixture.item.id,
    rating: "AGAIN",
    expected_revision: 0,
    accepted_revision: 1,
    accepted_at: new Date(NOW),
    session_item: {
      id: fixture.item.id,
      session_id: sessionId,
      vocabulary_id: VOCABULARY,
      session: { user_id: userId, mode: "SRS" },
    },
    ...overrides,
  };
}
