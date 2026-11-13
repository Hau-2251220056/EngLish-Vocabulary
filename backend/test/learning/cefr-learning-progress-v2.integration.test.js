import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createLearningPathRepository } from "../../src/repositories/learning-path-repository.js";
import { createLearningRepository } from "../../src/repositories/learning-repository.js";
import { createLearningSessionRepository } from "../../src/repositories/learning-session-repository.js";
import { createStreakRepository } from "../../src/repositories/streak-repository.js";
import {
  createLearningPathActivityAuthorizer,
  createLearningPathFirstCreditRecorder,
  createLearningPathService,
} from "../../src/services/learning-path-service.js";
import { createLearningService } from "../../src/services/learning-service.js";
import { createLearningSessionService } from "../../src/services/learning-session-service.js";
import { createCefrHarness } from "./cefr-learning-path-migration-harness.js";

const enabled = process.env.CEFR_TEST_DATABASE_ALLOW_OPERATION === "true";
const NOW = new Date("2026-11-13T08:00:00.000Z");
const SESSION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

test("NORMAL/SRS first credit is atomic, replay-safe, concurrent, and user-isolated", {
  skip: !enabled,
  timeout: 180_000,
}, async () => withSchema("v2_atomic", async (prisma) => {
  const user = await createUser(prisma, "atomic");
  const outsider = await createUser(prisma, "outsider");
  const set = await createPublicSet(prisma, user.id, "atomic", 2, "A1");
  const runtime = createRuntime(prisma);
  const started = await runtime.path.startPass(user.id, set.id, operation());
  const normal = await runtime.path.createNextSession(user.id, started.pass.id, {
    ...operation(), mode: "NORMAL",
  });
  const srs = await runtime.path.createNextSession(user.id, started.pass.id, {
    ...operation(), mode: "SRS",
  });
  const [first, second] = normal.session.items;

  const failedNormal = createRuntime(prisma, { failFirstCredit: true });
  await assert.rejects(
    failedNormal.sessions.acknowledgeNormalReveal(
      user.id, normal.session.id, second.vocabulary_id, operation(),
    ),
    /forced first-credit rollback/,
  );
  assert.equal(await sessionEvidence(prisma, normal.session.id, second.vocabulary_id), null);
  assert.equal(await passCredit(prisma, started.pass.id, second.vocabulary_id), null);

  const failedSrs = createRuntime(prisma, { failFirstCredit: true });
  await assert.rejects(
    failedSrs.learning.recordMeaningfulEvent(user.id, srsEvent({
      sessionId: srs.session.id,
      setId: set.id,
      vocabularyId: second.vocabulary_id,
      rating: "AGAIN",
    })),
    /forced first-credit rollback/,
  );
  assert.equal(await prisma.lEARNING_PROGRESS.count({
    where: { user_id: user.id, vocabulary_id: second.vocabulary_id },
  }), 0);
  assert.equal(await prisma.lEARNING_SESSION_SRS_RECEIPT.count({
    where: { session_item: { session_id: srs.session.id, vocabulary_id: second.vocabulary_id } },
  }), 0);
  assert.equal(await passCredit(prisma, started.pass.id, second.vocabulary_id), null);

  const normalEvent = randomUUID();
  const srsIdentity = srsEvent({
    sessionId: srs.session.id,
    setId: set.id,
    vocabularyId: first.vocabulary_id,
    rating: "GOOD",
  });
  const [normalResult, srsResult] = await Promise.all([
    runtime.sessions.acknowledgeNormalReveal(
      user.id, normal.session.id, first.vocabulary_id, { operation_id: normalEvent },
    ),
    runtime.learning.recordMeaningfulEvent(user.id, srsIdentity),
  ]);
  assert.equal(normalResult.cefr_pass.id, started.pass.id);
  assert.equal(srsResult.cefr_pass.id, started.pass.id);
  const winner = await passCredit(prisma, started.pass.id, first.vocabulary_id);
  assert.ok([normalEvent, srsIdentity.event_id].includes(winner.first_credit_event_id));
  assert.equal(await prisma.cEFR_LEARNING_PASS_ITEM.count({
    where: { pass_id: started.pass.id, vocabulary_id: first.vocabulary_id,
      first_credit_event_id: { not: null } },
  }), 1);
  const srsProgress = await prisma.lEARNING_PROGRESS.findUniqueOrThrow({
    where: { user_id_vocabulary_id: {
      user_id: user.id,
      vocabulary_id: first.vocabulary_id,
    } },
  });
  const srsRewardCount = await prisma.xP_REWARD.count({
    where: { user_id: user.id, source_event_id: srsIdentity.event_id },
  });

  const normalReplay = await runtime.sessions.acknowledgeNormalReveal(
    user.id, normal.session.id, first.vocabulary_id, { operation_id: normalEvent },
  );
  const srsReplay = await runtime.learning.recordMeaningfulEvent(user.id, srsIdentity);
  assert.equal(normalReplay.replayed, true);
  assert.equal(srsReplay.reward.replayed, true);
  assert.equal(srsReplay.reward.source_event_id, srsIdentity.event_id);
  assert.equal(srsReplay.revision, srsProgress.revision);
  assert.equal(srsReplay.review_count, srsProgress.review_count);
  assert.equal(await prisma.lEARNING_SESSION_SRS_RECEIPT.count({
    where: { event_id: srsIdentity.event_id },
  }), 1);
  assert.equal(await prisma.lEARNING_PROGRESS.count({
    where: {
      user_id: user.id,
      vocabulary_id: first.vocabulary_id,
      revision: srsProgress.revision,
      review_count: srsProgress.review_count,
      last_event_id: srsIdentity.event_id,
    },
  }), 1);
  assert.equal(await prisma.xP_REWARD.count({
    where: { user_id: user.id, source_event_id: srsIdentity.event_id },
  }), srsRewardCount);

  const again = srsEvent({
    sessionId: srs.session.id,
    setId: set.id,
    vocabularyId: second.vocabulary_id,
    rating: "AGAIN",
  });
  const againResult = await runtime.learning.recordMeaningfulEvent(user.id, again);
  assert.equal(againResult.cefr_pass.id, started.pass.id);
  const againCredit = await passCredit(prisma, started.pass.id, second.vocabulary_id);
  assert.equal(againCredit.first_credit_source, "SRS_AGAIN");
  assert.equal(againCredit.first_credit_event_id, again.event_id);
  assert.equal(await sessionEvidence(prisma, srs.session.id, second.vocabulary_id), null);
  assert.equal((await runtime.path.readPass(user.id, started.pass.id)).ready_to_complete, true);
  const againProgress = await prisma.lEARNING_PROGRESS.findUniqueOrThrow({
    where: { user_id_vocabulary_id: {
      user_id: user.id,
      vocabulary_id: second.vocabulary_id,
    } },
  });
  const againRewardCount = await prisma.xP_REWARD.count({
    where: { user_id: user.id, source_event_id: again.event_id },
  });
  const againReplay = await runtime.learning.recordMeaningfulEvent(user.id, again);
  assert.equal(againReplay.reward.replayed, true);
  assert.equal(againReplay.reward.source_event_id, again.event_id);
  assert.equal(againReplay.revision, againProgress.revision);
  assert.equal(againReplay.review_count, againProgress.review_count);
  assert.equal(await prisma.lEARNING_SESSION_SRS_RECEIPT.count({
    where: { event_id: again.event_id },
  }), 1);
  assert.equal(await prisma.lEARNING_PROGRESS.count({
    where: {
      user_id: user.id,
      vocabulary_id: second.vocabulary_id,
      revision: againProgress.revision,
      review_count: againProgress.review_count,
      last_event_id: again.event_id,
    },
  }), 1);
  assert.equal(await prisma.xP_REWARD.count({
    where: { user_id: user.id, source_event_id: again.event_id },
  }), againRewardCount);
  assert.equal(
    (await passCredit(prisma, started.pass.id, second.vocabulary_id)).first_credit_event_id,
    again.event_id,
  );
  assert.equal(await sessionEvidence(prisma, srs.session.id, second.vocabulary_id), null);

  await assert.rejects(runtime.path.readPass(outsider.id, started.pass.id), hasCode("CEFR_PASS_NOT_FOUND"));
  await assert.rejects(
    runtime.sessions.acknowledgeNormalReveal(
      outsider.id, normal.session.id, second.vocabulary_id, operation(),
    ),
    hasCode("LEARNING_SESSION_NOT_FOUND"),
  );
}));

test("expired sessions and invalidated passes cannot gain first credit", {
  skip: !enabled,
  timeout: 180_000,
}, async () => withSchema("v2_expiry", async (prisma) => {
  const user = await createUser(prisma, "expiry");
  const set = await createPublicSet(prisma, user.id, "expiry", 2, "A1");
  const runtime = createRuntime(prisma);
  const started = await runtime.path.startPass(user.id, set.id, operation());
  const normal = await runtime.path.createNextSession(user.id, started.pass.id, {
    ...operation(), mode: "NORMAL",
  });
  const expiredAt = new Date(NOW.getTime() - 1);
  await prisma.lEARNING_SESSION.update({
    where: { id: normal.session.id },
    data: {
      created_at: new Date(expiredAt.getTime() - SESSION_LIFETIME_MS),
      expires_at: expiredAt,
    },
  });
  await assert.rejects(
    runtime.sessions.acknowledgeNormalReveal(
      user.id, normal.session.id, normal.session.items[0].vocabulary_id, operation(),
    ),
    hasCode("LEARNING_SESSION_EXPIRED"),
  );
  assert.equal(await passCredit(
    prisma, started.pass.id, normal.session.items[0].vocabulary_id,
  ), null);

  const fresh = await runtime.path.createNextSession(user.id, started.pass.id, {
    ...operation(), mode: "NORMAL",
  });
  assert.notEqual(fresh.session.id, normal.session.id);
  assert.equal(fresh.session.state, "ACTIVE");
  await prisma.cEFR_LEARNING_PASS.update({
    where: { id: started.pass.id },
    data: { status: "INVALIDATED", invalidated_at: NOW },
  });
  const activeItem = fresh.session.items[1];
  const result = await runtime.sessions.acknowledgeNormalReveal(
    user.id, fresh.session.id, activeItem.vocabulary_id, operation(),
  );
  assert.equal(result.cefr_pass.state, "INVALIDATED");
  assert.equal(await passCredit(prisma, started.pass.id, activeItem.vocabulary_id), null);
}));

test("10/11/15/20 item passes support NORMAL-only, SRS-only, and mixed completion", {
  skip: !enabled,
  timeout: 300_000,
}, async () => withSchema("v2_bounds", async (prisma) => {
  const user = await createUser(prisma, "boundaries");
  const runtime = createRuntime(prisma);
  const cases = [
    { size: 10, modes: ["NORMAL"], batches: [10] },
    { size: 11, modes: ["SRS", "SRS"], batches: [10, 1] },
    { size: 15, modes: ["NORMAL", "SRS"], batches: [10, 5] },
    { size: 20, modes: ["NORMAL", "SRS"], batches: [10, 10] },
  ];
  const sets = [];
  for (const entry of cases) {
    sets.push(await createPublicSet(prisma, user.id, `boundary-${entry.size}`, entry.size, "A1"));
  }
  await createPublicSet(prisma, user.id, "next-level", 1, "A2");

  for (const [caseIndex, entry] of cases.entries()) {
    const started = await runtime.path.startPass(user.id, sets[caseIndex].id, operation());
    const observed = [];
    for (const mode of entry.modes) {
      const batch = await runtime.path.createNextSession(user.id, started.pass.id, {
        ...operation(), mode,
      });
      observed.push(batch.session.items.length);
      if (mode === "NORMAL") {
        for (const item of batch.session.items) {
          await runtime.sessions.acknowledgeNormalReveal(
            user.id, batch.session.id, item.vocabulary_id, operation(),
          );
        }
        await runtime.sessions.completeNormalSession(user.id, batch.session.id, operation());
      } else {
        for (const item of batch.session.items) {
          await runtime.learning.recordMeaningfulEvent(user.id, srsEvent({
            sessionId: batch.session.id,
            setId: sets[caseIndex].id,
            vocabularyId: item.vocabulary_id,
            rating: "GOOD",
          }));
        }
      }
    }
    assert.deepEqual(observed, entry.batches);
    const ready = await runtime.path.readPass(user.id, started.pass.id);
    assert.equal(ready.credited_items, entry.size);
    assert.equal(ready.ready_to_complete, true);
    const completed = await runtime.path.completePass(user.id, started.pass.id, operation());
    assert.equal(completed.pass.state, "COMPLETED");
  }

  const unlocked = await runtime.path.getPath(user.id);
  assert.equal(unlocked.highest_unlocked_level, "A2");
  await createPublicSet(prisma, user.id, "late-a1", 1, "A1");
  const afterCurriculumAddition = await runtime.path.getPath(user.id);
  assert.equal(afterCurriculumAddition.highest_unlocked_level, "A2");
  assert.equal(afterCurriculumAddition.path_completed_at, null);
}));

async function withSchema(scenario, action) {
  const harness = await createCefrHarness();
  try {
    const target = await harness.createSchema(scenario);
    await harness.deployMigrations(target);
    return await harness.withClient(target, action);
  } finally {
    await harness.cleanup();
  }
}

function createRuntime(prisma, { failFirstCredit = false } = {}) {
  const learningPathRepository = createLearningPathRepository(prisma);
  const learningRepository = createLearningRepository(prisma);
  const authoritativeRecorder = createLearningPathFirstCreditRecorder({
    createLearningPathRepository,
  });
  const recordLearningPathFirstCredit = failFirstCredit
    ? async () => { throw new Error("forced first-credit rollback"); }
    : authoritativeRecorder;
  const authorizeSetActivity = createLearningPathActivityAuthorizer({
    createLearningPathRepository,
  });
  const withTransaction = (callback) => prisma.$transaction(
    (transaction) => callback(transaction),
    { maxWait: 10_000, timeout: 30_000 },
  );
  return {
    path: createLearningPathService({
      learningPathRepository,
      createSessionRepository: createLearningSessionRepository,
      now: () => NOW,
    }),
    sessions: createLearningSessionService({
      withTransaction,
      createSessionRepository: createLearningSessionRepository,
      createStreakRepository,
      createLearningRepository,
      recordLearningPathFirstCredit,
      authorizeSetActivity,
      now: () => NOW,
    }),
    learning: createLearningService({
      learningRepository,
      createSessionRepository: createLearningSessionRepository,
      createStreakRepository,
      createLearningPathRepository,
      recordLearningPathFirstCredit,
      authorizeSetActivity,
      now: () => NOW,
    }),
  };
}

async function createUser(prisma, suffix) {
  return prisma.uSER.create({ data: {
    email: `${suffix}-${randomUUID()}@cefr-v2.integration.test`,
    password_hash: "test-only",
    display_name: `CEFR V2 ${suffix}`,
  } });
}

async function createPublicSet(prisma, ownerId, suffix, size, cefrLevel) {
  const topic = await prisma.tOPIC.create({ data: {
    name: `CEFR V2 ${suffix} ${randomUUID()}`,
  } });
  const words = [];
  for (let index = 0; index < size; index += 1) {
    words.push(await prisma.vOCABULARY.create({ data: {
      word: `cefr-v2-${suffix}-${index}-${randomUUID()}`,
    } }));
  }
  return prisma.vOCABULARY_SET.create({ data: {
    owner_id: ownerId,
    topic_id: topic.id,
    name: `CEFR V2 ${suffix}`,
    is_public: true,
    cefr_level: cefrLevel,
    items: { create: words.map(({ id }, index) => ({
      vocabulary_id: id,
      position: index + 1,
    })) },
  } });
}

function operation() {
  return { operation_id: randomUUID() };
}

function srsEvent({ sessionId, setId, vocabularyId, rating }) {
  return {
    event_id: randomUUID(),
    session_id: sessionId,
    set_id: setId,
    vocabulary_id: vocabularyId,
    expected_revision: 0,
    rating,
  };
}

async function passCredit(prisma, passId, vocabularyId) {
  return prisma.cEFR_LEARNING_PASS_ITEM.findUnique({
    where: { pass_id_vocabulary_id: { pass_id: passId, vocabulary_id: vocabularyId } },
    select: {
      first_credit_source: true,
      first_credit_event_id: true,
      first_credit_session_id: true,
      first_credit_accepted_at: true,
    },
  }).then((item) => item?.first_credit_event_id ? item : null);
}

async function sessionEvidence(prisma, sessionId, vocabularyId) {
  const item = await prisma.lEARNING_SESSION_ITEM.findUnique({
    where: { session_id_vocabulary_id: {
      session_id: sessionId,
      vocabulary_id: vocabularyId,
    } },
    select: { evidence: true },
  });
  return item?.evidence ?? null;
}

function hasCode(code) {
  return (error) => error?.code === code;
}
