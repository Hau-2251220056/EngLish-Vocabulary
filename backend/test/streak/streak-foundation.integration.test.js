import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, afterEach, before, test } from "node:test";
import { createApp } from "../../src/create-app.js";
import { createLearningRepository } from "../../src/repositories/learning-repository.js";
import { createLearningSessionRepository } from "../../src/repositories/learning-session-repository.js";
import { createQuizRepository } from "../../src/repositories/quiz-repository.js";
import { createStreakRepository } from "../../src/repositories/streak-repository.js";
import { captureOperationTime } from "../../src/services/learning-session-domain.js";
import { completeLearningSessionAtomically } from "../../src/services/learning-session-persistence.js";
import { createLearningService } from "../../src/services/learning-service.js";
import { createQuizService } from "../../src/services/quiz-service.js";
import { createSessionFixture, createUserFixture } from "../helpers/auth-fixtures.js";
import { startHttpTestServer } from "../helpers/http-test-server.js";
import {
  assertFoundationAuthorization,
  buildFoundationObserverDatabaseUrl,
  CONTENTION_OBSERVER_MIN_LIFECYCLE_BUDGET_MS,
  connectFoundationObserver,
  contentionObserverTransactionPolicy,
  describeContentionWaitStates,
} from "./streak-foundation-safety.js";
import {
  observeBoundedContention,
  runFoundationCleanup,
  runSanitizedContentionObserver,
  runWithGuaranteedRelease,
} from "./streak-foundation-safety.js";

let database;
let prisma;
let peer;
let observer;
let http;
let prismaObserverErrorTypes;
let now = new Date("2026-10-18T16:59:59.999Z");
const CONCURRENCY_TIMEOUT_MS = 30_000;
const CONTROLLED_CONTENTION_TIMEOUT_MS = 60_000;

before(async () => {
  assertFoundationAuthorization(process.env);
  const [{ createTestDatabase }, { Prisma, PrismaClient }] = await Promise.all([
    import("../helpers/test-database.js"),
    import("../../src/generated/prisma/client.ts"),
  ]);
  prismaObserverErrorTypes = {
    PrismaClientKnownRequestError: Prisma.PrismaClientKnownRequestError,
    PrismaClientUnknownRequestError: Prisma.PrismaClientUnknownRequestError,
    PrismaClientRustPanicError: Prisma.PrismaClientRustPanicError,
    PrismaClientInitializationError: Prisma.PrismaClientInitializationError,
  };
  const expectedSchema = process.env.STREAK_FOUNDATION_SCHEMA_NAME;
  const expectedSchemaMarker = process.env.STREAK_FOUNDATION_SCHEMA_MARKER;
  assert.equal(typeof expectedSchema, "string");
  assert.equal(typeof expectedSchemaMarker, "string");
  const observerDatabaseUrl = buildFoundationObserverDatabaseUrl(process.env);
  observer = new PrismaClient({ datasourceUrl: observerDatabaseUrl });
  await connectFoundationObserver(observer, {
    onDisconnected: () => { observer = undefined; },
  });
  database = await createTestDatabase({ expectedSchema, expectedSchemaMarker });
  prisma = database.prisma;
  peer = new PrismaClient();
  await peer.$connect();
  assert.ok(prisma.lEARNING_SESSION);
  assert.ok(prisma.lEARNING_SESSION_ITEM);
  assert.ok(prisma.sTREAK_DAY);
  const requiredTables = await prisma.$queryRaw`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = current_schema()
      AND table_name IN ('LEARNING_SESSION', 'LEARNING_SESSION_ITEM', 'STREAK_DAY')
    ORDER BY table_name
  `;
  assert.deepEqual(requiredTables.map(({ table_name: name }) => name), [
    "LEARNING_SESSION",
    "LEARNING_SESSION_ITEM",
    "STREAK_DAY",
  ]);
  await database.reset();
  http = await startHttpTestServer(createApp({ prisma, learningNow: () => now }));
});

afterEach(async () => {
  now = new Date("2026-10-18T16:59:59.999Z");
  if (database) await database.reset();
});

after(async () => {
  await runFoundationCleanup({
    operations: [
      database ? () => database.reset() : null,
      http ? () => http.close() : null,
      observer ? () => observer.$disconnect() : null,
      peer ? () => peer.$disconnect() : null,
      database ? () => database.disconnect() : null,
    ],
  });
});

test("full HTTP auth matrix and Set authorization remain USER-only", async () => {
  const fixture = await createFixture();
  const body = normalCreateBody(fixture);
  assert.equal((await request("/api/learning-sessions", { method: "POST", json: body })).status, 401);
  assert.equal((await request("/api/learning-sessions", {
    method: "POST", json: body, cookie: fixture.adminCookie,
  })).status, 403);
  assert.equal((await request("/api/learning-sessions", {
    method: "POST", json: body, cookie: fixture.otherCookie,
  })).status, 404);

  const owner = await request("/api/learning-sessions", {
    method: "POST", json: body, cookie: fixture.userCookie,
  });
  assert.equal(owner.status, 201);
  assert.deepEqual(owner.json.data.session.items.map((item) => item.vocabulary_id), fixture.vocabularyIds);
  const foreignRead = await request(`/api/learning-sessions/${owner.json.data.session.id}`, {
    cookie: fixture.otherCookie,
  });
  assert.equal(foreignRead.status, 404);

  const topic = await createTopicFixture();
  await prisma.vOCABULARY_SET.update({
    where: { id: fixture.set.id },
    data: { is_public: true, topic_id: topic.id },
  });
  const publicResult = await request("/api/learning-sessions", {
    method: "POST",
    cookie: fixture.otherCookie,
    json: { ...body, operation_id: randomUUID() },
  });
  assert.equal(publicResult.status, 201);
});

test("database-backed snapshot validation rejects duplicates and returns SRS up-to-date without a session", async () => {
  const fixture = await createFixture();
  const duplicate = await request("/api/learning-sessions", {
    method: "POST",
    cookie: fixture.userCookie,
    json: {
      operation_id: randomUUID(),
      set_id: fixture.set.id,
      mode: "NORMAL",
      vocabulary_ids: [fixture.vocabularyIds[0], fixture.vocabularyIds[0]],
    },
  });
  assert.equal(duplicate.status, 400);

  const extraVocabulary = await Promise.all(Array.from({ length: 9 }, (_, index) =>
    prisma.vOCABULARY.create({
      data: { word: `streak-foundation-bound-${index}-${randomUUID()}` },
    })));
  await prisma.vOCABULARY_SET_ITEM.createMany({
    data: extraVocabulary.map(({ id }, index) => ({
      vocabulary_set_id: fixture.set.id,
      vocabulary_id: id,
      position: index + 3,
    })),
  });
  const oversized = await request("/api/learning-sessions", {
    method: "POST",
    cookie: fixture.userCookie,
    json: {
      operation_id: randomUUID(),
      set_id: fixture.set.id,
      mode: "NORMAL",
      vocabulary_ids: [...fixture.vocabularyIds, ...extraVocabulary.map(({ id }) => id)],
    },
  });
  assert.equal(oversized.status, 400);

  const upToDateFixture = await createFixture();
  await prisma.lEARNING_PROGRESS.createMany({
    data: upToDateFixture.vocabularyIds.map((vocabularyId) => ({
      user_id: upToDateFixture.user.id,
      vocabulary_id: vocabularyId,
      status: "LEARNED",
      interval_days: 1,
      revision: 1,
      review_count: 1,
      last_reviewed_at: now,
      next_review_at: new Date(now.getTime() + 86_400_000),
    })),
  });
  const upToDate = await request("/api/learning-sessions", {
    method: "POST",
    cookie: upToDateFixture.userCookie,
    json: {
      operation_id: randomUUID(),
      set_id: upToDateFixture.set.id,
      mode: "SRS",
    },
  });
  assert.equal(upToDate.status, 200);
  assert.deepEqual(upToDate.json.data, {
    session: null,
    reason: "SRS_UP_TO_DATE",
    replayed: false,
  });
  assert.equal(await prisma.lEARNING_SESSION.count({
    where: { user_id: upToDateFixture.user.id },
  }), 0);
});

test("concurrent exact create reconciles Prisma P2002 metadata and unrelated targets stay observable", async () => {
  const fixture = await createFixture();
  const body = normalCreateBody(fixture);
  const responses = await Promise.all([
    request("/api/learning-sessions", { method: "POST", json: body, cookie: fixture.userCookie }),
    request("/api/learning-sessions", { method: "POST", json: body, cookie: fixture.userCookie }),
  ]);
  assert.deepEqual(responses.map(({ status }) => status).sort(), [200, 201]);
  assert.equal(responses[0].json.data.session.id, responses[1].json.data.session.id);
  assert.equal(await prisma.lEARNING_SESSION.count({
    where: { user_id: fixture.user.id, create_operation_id: body.operation_id },
  }), 1);

  let collision;
  try {
    await prisma.lEARNING_SESSION.create({
      data: {
        user_id: fixture.user.id,
        vocabulary_set_id: fixture.set.id,
        set_id_snapshot: fixture.set.id,
        mode: "NORMAL",
        create_operation_id: body.operation_id,
        snapshot_size: 1,
        created_at: now,
        expires_at: new Date(now.getTime() + 7 * 86_400_000),
      },
    });
  } catch (error) { collision = error; }
  assert.equal(collision?.code, "P2002");
  const target = collision?.meta?.target;
  assert.equal(
    (Array.isArray(target) && target.join(",") === "user_id,create_operation_id")
      || target === "LEARNING_SESSION_user_id_create_operation_id_key",
    true,
    `Unexpected Prisma create-operation collision target: ${String(target)}`,
  );
});

test("one advisory namespace serializes missing Progress identities and releases on commit and rollback", {
  timeout: CONCURRENCY_TIMEOUT_MS,
}, async () => {
  const fixture = await createFixture();
  const vocabularyId = fixture.vocabularyIds[0];
  let releaseCommit;
  let lockedCommit;
  const commitGate = new Promise((resolve) => { releaseCommit = resolve; });
  const commitLocked = new Promise((resolve) => { lockedCommit = resolve; });
  const holder = prisma.$transaction(async (transaction) => {
    await createLearningRepository(transaction).lockProgressIdentity(fixture.user.id, vocabularyId);
    assert.equal(await transaction.lEARNING_PROGRESS.count({
      where: { user_id: fixture.user.id, vocabulary_id: vocabularyId },
    }), 0);
    lockedCommit();
    await commitGate;
    await transaction.lEARNING_PROGRESS.create({
      data: { user_id: fixture.user.id, vocabulary_id: vocabularyId, status: "LEARNING" },
    });
  });
  await runWithGuaranteedRelease({
    action: async () => {
      await withTimeout(commitLocked, "Timed out waiting for advisory lock holder.");
      await assertLockTimeout(peer, (transaction) =>
        createQuizRepository(transaction).lockProgressIdentity(fixture.user.id, vocabularyId));
    },
    release: releaseCommit,
    held: [holder],
  });
  await peer.$transaction(async (transaction) => {
    await createQuizRepository(transaction).lockProgressIdentity(fixture.user.id, vocabularyId);
    assert.equal(await transaction.lEARNING_PROGRESS.count({
      where: { user_id: fixture.user.id, vocabulary_id: vocabularyId },
    }), 1);
  });

  await assert.rejects(prisma.$transaction(async (transaction) => {
    await createLearningRepository(transaction).lockProgressIdentity(fixture.user.id, fixture.vocabularyIds[1]);
    throw new Error("intentional advisory-lock rollback");
  }), /intentional advisory-lock rollback/);
  await peer.$transaction((transaction) =>
    createQuizRepository(transaction).lockProgressIdentity(fixture.user.id, fixture.vocabularyIds[1]));
});

test("Set membership revalidation never shrinks an immutable NORMAL snapshot", async () => {
  const fixture = await createFixture();
  const created = await createNormalSession(fixture);
  await prisma.vOCABULARY_SET_ITEM.delete({
    where: {
      vocabulary_set_id_vocabulary_id: {
        vocabulary_set_id: fixture.set.id,
        vocabulary_id: fixture.vocabularyIds[1],
      },
    },
  });
  const response = await reveal(fixture, created.id, fixture.vocabularyIds[0], randomUUID());
  assert.equal(response.status, 409);
  assert.equal(response.json.error.code, "LEARNING_SESSION_INACCESSIBLE");
  assert.equal(await prisma.lEARNING_SESSION_ITEM.count({
    where: { session_id: created.id, evidence: { not: null } },
  }), 0);
  assert.equal((await prisma.lEARNING_SESSION.findUnique({ where: { id: created.id } })).snapshot_size, 2);
});

test("Set deletion and revoked public access preserve snapshots but reject new evidence", async () => {
  const deletedFixture = await createFixture();
  const deletedSession = await createNormalSession(deletedFixture);
  await prisma.vOCABULARY_SET.delete({ where: { id: deletedFixture.set.id } });
  const afterDeletion = await reveal(
    deletedFixture,
    deletedSession.id,
    deletedFixture.vocabularyIds[0],
    randomUUID(),
  );
  assert.equal(afterDeletion.status, 409);
  assert.equal(afterDeletion.json.error.code, "LEARNING_SESSION_INACCESSIBLE");
  const retained = await prisma.lEARNING_SESSION.findUnique({
    where: { id: deletedSession.id },
    include: { items: { orderBy: { position: "asc" } } },
  });
  assert.equal(retained.vocabulary_set_id, null);
  assert.equal(retained.set_id_snapshot, deletedFixture.set.id);
  assert.deepEqual(retained.items.map(({ vocabulary_id: id }) => id), deletedFixture.vocabularyIds);

  const revokedFixture = await createPublicSystemSetFixture();
  const createdByOther = await request("/api/learning-sessions", {
    method: "POST",
    cookie: revokedFixture.otherCookie,
    json: normalCreateBody(revokedFixture),
  });
  assert.equal(createdByOther.status, 201);
  const sessionId = createdByOther.json.data.session.id;
  const persistedBeforeRevocation = await readPersistedSession(sessionId);
  assert.equal(persistedBeforeRevocation.user_id, revokedFixture.other.id);
  assert.equal(persistedBeforeRevocation.set_id_snapshot, revokedFixture.set.id);
  assert.deepEqual(
    persistedBeforeRevocation.items.map(({ vocabulary_id: id }) => id),
    revokedFixture.vocabularyIds,
  );

  await prisma.vOCABULARY_SET.update({
    where: { id: revokedFixture.set.id },
    data: { is_public: false },
  });
  const persistedAfterRevocation = await readPersistedSession(sessionId);
  assert.equal(persistedAfterRevocation.user_id, revokedFixture.other.id);
  assert.equal(persistedAfterRevocation.snapshot_size, revokedFixture.vocabularyIds.length);
  assert.deepEqual(
    persistedAfterRevocation.items.map(({ vocabulary_id: id }) => id),
    revokedFixture.vocabularyIds,
  );

  const afterRevocation = await revealWithCookie({
    cookie: revokedFixture.otherCookie,
    sessionId,
    vocabularyId: revokedFixture.vocabularyIds[0],
    operationId: randomUUID(),
  });
  assert.equal(afterRevocation.status, 409);
  assert.equal(afterRevocation.json.error.code, "LEARNING_SESSION_INACCESSIBLE");

  const foreignReveal = await revealWithCookie({
    cookie: revokedFixture.userCookie,
    sessionId,
    vocabularyId: revokedFixture.vocabularyIds[0],
    operationId: randomUUID(),
  });
  assert.equal(foreignReveal.status, 404);
  assert.equal(foreignReveal.json.error.code, "LEARNING_SESSION_NOT_FOUND");

  const rejectedSession = await readPersistedSession(sessionId);
  assert.equal(rejectedSession.status, "ACTIVE");
  assert.equal(rejectedSession.completed_at, null);
  assert.equal(rejectedSession.completion_event_id, null);
  assert.equal(rejectedSession.items.every((item) => item.evidence === null), true);
});

test("parallel completed sessions create one Streak day without deadlock", {
  timeout: CONCURRENCY_TIMEOUT_MS,
}, async () => {
  const fixture = await createFixture();
  const sessions = await Promise.all([
    createCompletionReadyNormalSession(fixture),
    createCompletionReadyNormalSession(fixture),
  ]);
  const completions = await withTimeout(Promise.all(sessions.map((session) => request(
    `/api/learning-sessions/${session.id}/complete`,
    { method: "POST", cookie: fixture.userCookie, json: { operation_id: randomUUID() } },
  ))), "Timed out waiting for parallel completion requests.", 10_000);
  assert.deepEqual(completions.map(({ status }) => status), [200, 200]);
  assert.equal(await prisma.sTREAK_DAY.count({ where: { user_id: fixture.user.id } }), 1);
  assert.equal(await prisma.lEARNING_SESSION.count({
    where: { user_id: fixture.user.id, status: "COMPLETED" },
  }), 2);
});

test("successful NORMAL completion creates Streak evidence without changing Progress or XP", async () => {
  const fixture = await createFixture();
  const progressEventId = randomUUID();
  const rewardEventId = randomUUID();
  await prisma.uSER.update({
    where: { id: fixture.user.id },
    data: { total_xp: 3 },
  });
  await prisma.lEARNING_PROGRESS.create({
    data: {
      user_id: fixture.user.id,
      vocabulary_id: fixture.vocabularyIds[0],
      status: "LEARNED",
      review_count: 1,
      revision: 1,
      last_reviewed_at: new Date("2026-10-17T08:00:00.000Z"),
      last_event_id: progressEventId,
      next_review_at: new Date("2026-10-20T08:00:00.000Z"),
      interval_days: 3,
      ease_factor: "2.50",
    },
  });
  await prisma.xP_REWARD.create({
    data: {
      user_id: fixture.user.id,
      vocabulary_id: fixture.vocabularyIds[0],
      reward_type: "SRS_INITIAL",
      reward_cycle: 0,
      source_event_id: rewardEventId,
      xp_amount: 3,
    },
  });
  const before = await legacyState(fixture.user.id);
  assert.equal(before.user.total_xp, 3);
  assert.equal(before.progress.length, 1);
  assert.equal(before.rewards.length, 1);

  const createResponse = await request("/api/learning-sessions", {
    method: "POST",
    cookie: fixture.userCookie,
    json: normalCreateBody(fixture),
  });
  assert.equal(createResponse.status, 201);
  const session = createResponse.json.data.session;
  assert.equal(session.set_id, fixture.set.id);
  assert.equal(session.mode, "NORMAL");
  assert.deepEqual(
    session.items.map(({ vocabulary_id: vocabularyId }) => vocabularyId),
    fixture.vocabularyIds,
  );

  for (const item of session.items) {
    const revealResponse = await reveal(fixture, session.id, item.vocabulary_id, randomUUID());
    assert.equal(revealResponse.status, 200);
    assert.equal(revealResponse.json.data.item.vocabulary_id, item.vocabulary_id);
    assert.equal(revealResponse.json.data.item.evidence, "NORMAL_REVEALED");
  }

  const completionEventId = randomUUID();
  const completionResponse = await request(`/api/learning-sessions/${session.id}/complete`, {
    method: "POST",
    cookie: fixture.userCookie,
    json: { operation_id: completionEventId },
  });
  assert.equal(completionResponse.status, 200);
  assert.equal(completionResponse.json.data.session.id, session.id);
  assert.equal(completionResponse.json.data.session.mode, "NORMAL");
  assert.equal(completionResponse.json.data.session.state, "COMPLETED");
  assert.equal(completionResponse.json.data.streak.current_streak, 1);
  assert.equal(completionResponse.json.data.streak.completed_today, true);
  assert.equal(completionResponse.json.data.streak.last_qualified_date, "2026-10-18");

  const persisted = await readPersistedSession(session.id);
  assert.equal(persisted.status, "COMPLETED");
  assert.equal(persisted.completion_event_id, completionEventId);
  assert.equal(persisted.items.length, fixture.vocabularyIds.length);
  assert.equal(persisted.items.every((item) => item.evidence === "NORMAL_REVEALED"), true);
  const streakDays = await prisma.sTREAK_DAY.findMany({
    where: { user_id: fixture.user.id },
    orderBy: { activity_date: "asc" },
  });
  assert.equal(streakDays.length, 1);
  assert.equal(streakDays[0].first_session_id, session.id);
  assert.equal(streakDays[0].activity_date.toISOString().slice(0, 10), "2026-10-18");

  const after = await legacyState(fixture.user.id);
  assert.equal(after.progress.length, before.progress.length);
  assert.equal(after.rewards.length, before.rewards.length);
  assert.deepEqual(after, before);
});

test("terminal failure rolls session and Streak back without changing Progress or XP", async () => {
  const fixture = await createFixture();
  const session = await createNormalSession(fixture);
  for (const vocabularyId of fixture.vocabularyIds) {
    assert.equal((await reveal(fixture, session.id, vocabularyId, randomUUID())).status, 200);
  }
  await prisma.lEARNING_PROGRESS.create({
    data: { user_id: fixture.user.id, vocabulary_id: fixture.vocabularyIds[0], status: "LEARNING" },
  });
  const before = await legacyState(fixture.user.id);
  await assert.rejects(prisma.$transaction(async (transaction) => {
    await completeLearningSessionAtomically({
      sessionRepository: createLearningSessionRepository(transaction),
      streakRepository: createStreakRepository(transaction),
      sessionId: session.id,
      userId: fixture.user.id,
      completionEventId: randomUUID(),
      captureTime: () => captureOperationTime(() => now),
    });
    throw new Error("intentional terminal rollback");
  }), /intentional terminal rollback/);
  assert.deepEqual(await legacyState(fixture.user.id), before);
  assert.equal((await prisma.lEARNING_SESSION.findUnique({ where: { id: session.id } })).status, "ACTIVE");
  assert.equal(await prisma.sTREAK_DAY.count({ where: { user_id: fixture.user.id } }), 0);
});

test("completion at UTC+7 midnight uses the new Asia/Ho_Chi_Minh day", async () => {
  const fixture = await createFixture();
  const midnightSession = await createNormalSession(fixture);
  for (const vocabularyId of fixture.vocabularyIds) {
    const response = await withTimeout(
      reveal(fixture, midnightSession.id, vocabularyId, randomUUID()),
      "Timed out preparing the midnight completion session.",
      5_000,
    );
    assert.equal(response.status, 200);
  }
  now = new Date("2026-10-18T17:00:00.000Z");
  const completionOperationId = randomUUID();
  const completed = await withTimeout(request(`/api/learning-sessions/${midnightSession.id}/complete`, {
    method: "POST", cookie: fixture.userCookie, json: { operation_id: completionOperationId },
  }), "Timed out waiting for midnight completion response.", 5_000);
  assert.equal(completed.status, 200);
  assert.equal(completed.json.data.streak.last_qualified_date, "2026-10-19");
  const replay = await withTimeout(request(`/api/learning-sessions/${midnightSession.id}/complete`, {
    method: "POST",
    cookie: fixture.userCookie,
    json: { operation_id: completionOperationId },
  }), "Timed out waiting for midnight completion replay.", 5_000);
  assert.equal(replay.status, 200);
  assert.equal(replay.json.data.replayed, true);
  assert.equal(await prisma.sTREAK_DAY.count({ where: { user_id: fixture.user.id } }), 1);
  const postCompletionReveal = await reveal(
    fixture,
    midnightSession.id,
    fixture.vocabularyIds[0],
    randomUUID(),
  );
  assert.equal(postCompletionReveal.status, 409);
});

test("post-lock authoritative instant rejects a session that expires while waiting", {
  timeout: CONCURRENCY_TIMEOUT_MS,
}, async () => {
  const fixture = await createFixture();
  now = new Date("2026-10-20T00:00:00.000Z");
  const expiring = await createNormalSession(fixture);
  const expiresAt = new Date(expiring.expires_at);
  now = new Date(expiresAt.getTime() - 1);
  let release;
  let locked;
  const releaseGate = new Promise((resolve) => { release = resolve; });
  const lockReady = new Promise((resolve) => { locked = resolve; });
  const blocker = prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT "id" FROM "LEARNING_SESSION" WHERE "id" = ${expiring.id}::uuid FOR UPDATE`;
    locked();
    await releaseGate;
  });
  let pendingReveal;
  let expired;
  try {
    await withTimeout(lockReady, "Timed out waiting for session row lock holder.", 5_000);
  } catch (error) {
    release();
    await withTimeout(
      Promise.allSettled([blocker]),
      "Timed out settling the session row lock holder.",
      5_000,
    );
    throw error;
  }
  pendingReveal = reveal(fixture, expiring.id, fixture.vocabularyIds[0], randomUUID());
  await runWithGuaranteedRelease({
    action: async () => {
      assert.equal(await remainsPending(pendingReveal), true);
      now = expiresAt;
    },
    release,
    held: [blocker, pendingReveal.then((response) => { expired = response; })],
    settleTimeoutMs: 5_000,
  });
  assert.equal(expired.status, 409);
  assert.equal(expired.json.error.code, "LEARNING_SESSION_EXPIRED");
});

test("sessionless SRS preserves legacy Progress and XP without session artifacts", async () => {
  const fixture = await createFixture();
  const response = await postSrsEvent(fixture.userCookie, srsEvent({
    setId: fixture.set.id,
    vocabularyId: fixture.vocabularyIds[0],
    rating: "GOOD",
  }));
  assert.equal(response.status, 200, response.text);
  assert.equal(response.json.data.reward.xp_earned, 3);
  assert.equal(await prisma.lEARNING_PROGRESS.count({ where: { user_id: fixture.user.id } }), 1);
  assert.equal(await prisma.xP_REWARD.count({ where: { user_id: fixture.user.id } }), 1);
  assert.equal(await prisma.lEARNING_SESSION.count({ where: { user_id: fixture.user.id } }), 0);
  assert.equal(await prisma.lEARNING_SESSION_SRS_RECEIPT.count(), 0);
  assert.equal(await prisma.sTREAK_DAY.count({ where: { user_id: fixture.user.id } }), 0);
});

test("sessionless Quiz preserves legacy grading Progress and XP without Streak artifacts", async () => {
  const fixture = await createQuizFixture();
  const runId = randomUUID();
  const vocabularyIds = fixture.quizVocabulary.slice(0, 2).map(({ id }) => id);
  const response = await request(
    `/api/quiz/sets/${fixture.set.id}/questions?type=MULTIPLE_CHOICE&run_id=${runId}&vocabulary_ids=${vocabularyIds.join("%2C")}`,
    { cookie: fixture.userCookie },
  );
  assert.equal(response.status, 200, response.text);
  const [question] = response.json.data.questions;
  const answer = await postQuizAnswer(fixture.userCookie, {
    event_id: randomUUID(),
    set_id: fixture.set.id,
    vocabulary_id: question.vocabulary_id,
    run_id: runId,
    question_revision: question.question_revision,
    quiz_type: "MULTIPLE_CHOICE",
    expected_revision: question.progress.revision,
    selected_choice_id: correctChoice(question, fixture),
  });
  assert.equal(answer.status, 200, answer.text);
  assert.equal(answer.json.data.is_correct, true);
  assert.equal(answer.json.data.reward.xp_earned, 3);
  assert.equal(await prisma.lEARNING_PROGRESS.count({ where: { user_id: fixture.user.id } }), 1);
  assert.equal(await prisma.xP_REWARD.count({ where: { user_id: fixture.user.id } }), 1);
  assert.equal(await prisma.lEARNING_SESSION.count({ where: { user_id: fixture.user.id } }), 0);
  assert.equal(await prisma.sTREAK_DAY.count({ where: { user_id: fixture.user.id } }), 0);
});

test("SRS snapshot is authoritatively ordered, unique and bounded to ten eligible items", async () => {
  const fixture = await createFixture();
  const extraVocabulary = await Promise.all(Array.from({ length: 10 }, (_, index) =>
    prisma.vOCABULARY.create({
      data: { word: `streak-srs-bound-${index}-${randomUUID()}` },
    })));
  await prisma.vOCABULARY_SET_ITEM.createMany({
    data: extraVocabulary.map(({ id }, index) => ({
      vocabulary_set_id: fixture.set.id,
      vocabulary_id: id,
      position: index + 3,
    })),
  });
  const allVocabularyIds = [...fixture.vocabularyIds, ...extraVocabulary.map(({ id }) => id)];
  const dueVocabularyIds = [allVocabularyIds[4], allVocabularyIds[11]];
  await prisma.lEARNING_PROGRESS.createMany({
    data: dueVocabularyIds.map((vocabularyId) => ({
      user_id: fixture.user.id,
      vocabulary_id: vocabularyId,
      status: "LEARNED",
      review_count: 1,
      revision: 1,
      last_reviewed_at: new Date(now.getTime() - 86_400_000),
      next_review_at: new Date(now.getTime() - 1),
      interval_days: 1,
    })),
  });

  const session = await createSrsSession(fixture);
  const snapshotIds = session.items.map(({ vocabulary_id: vocabularyId }) => vocabularyId);
  assert.equal(session.snapshot_size, 10);
  assert.equal(session.items.length, 10);
  assert.equal(new Set(snapshotIds).size, 10);
  assert.deepEqual(session.items.map(({ position }) => position), Array.from({ length: 10 }, (_, index) => index));
  assert.deepEqual(snapshotIds, [
    ...dueVocabularyIds,
    ...allVocabularyIds.filter((vocabularyId) => !dueVocabularyIds.includes(vocabularyId)).slice(0, 8),
  ]);
});

test("Prisma exposes exact unique-constraint metadata for SRS transaction identities", async () => {
  const fixture = await createFixture();
  const [firstSession, secondSession] = await Promise.all([
    createSrsSession(fixture),
    createSrsSession(fixture),
  ]);
  const [persistedFirstSession, persistedSecondSession] = await Promise.all([
    readPersistedSession(firstSession.id),
    readPersistedSession(secondSession.id),
  ]);

  await prisma.lEARNING_PROGRESS.create({
    data: {
      user_id: fixture.user.id,
      vocabulary_id: fixture.vocabularyIds[0],
      status: "LEARNING",
    },
  });
  await assertPrismaUniqueViolation(
    () => prisma.lEARNING_PROGRESS.create({
      data: {
        user_id: fixture.user.id,
        vocabulary_id: fixture.vocabularyIds[0],
        status: "LEARNING",
      },
    }),
    {
      model: "LEARNING_PROGRESS",
      constraint: "LEARNING_PROGRESS_user_id_vocabulary_id_key",
      columns: ["user_id", "vocabulary_id"],
    },
  );

  const receiptEventId = randomUUID();
  await prisma.lEARNING_SESSION_SRS_RECEIPT.create({
    data: {
      event_id: receiptEventId,
      session_item_id: persistedFirstSession.items[0].id,
      rating: "AGAIN",
      expected_revision: 0,
      accepted_revision: 1,
      accepted_at: now,
    },
  });
  await assertPrismaUniqueViolation(
    () => prisma.lEARNING_SESSION_SRS_RECEIPT.create({
      data: {
        event_id: receiptEventId,
        session_item_id: persistedSecondSession.items[0].id,
        rating: "GOOD",
        expected_revision: 0,
        accepted_revision: 1,
        accepted_at: now,
      },
    }),
    {
      model: "LEARNING_SESSION_SRS_RECEIPT",
      constraint: "LEARNING_SESSION_SRS_RECEIPT_pkey",
      columns: ["event_id"],
    },
  );

  const evidenceEventId = randomUUID();
  await prisma.lEARNING_SESSION_ITEM.update({
    where: { id: persistedFirstSession.items[0].id },
    data: { evidence: "SRS_GOOD", evidence_event_id: evidenceEventId, evidence_at: now },
  });
  await assertPrismaUniqueViolation(
    () => prisma.lEARNING_SESSION_ITEM.update({
      where: { id: persistedSecondSession.items[0].id },
      data: { evidence: "SRS_HARD", evidence_event_id: evidenceEventId, evidence_at: now },
    }),
    {
      model: "LEARNING_SESSION_ITEM",
      constraint: "LEARNING_SESSION_ITEM_evidence_event_id_key",
      columns: ["evidence_event_id"],
    },
  );

  const completionEventId = randomUUID();
  await markSessionCompleted(firstSession.id, completionEventId);
  await assertPrismaUniqueViolation(
    () => markSessionCompleted(secondSession.id, completionEventId),
    {
      model: "LEARNING_SESSION",
      constraint: "LEARNING_SESSION_user_id_completion_event_id_key",
      columns: ["user_id", "completion_event_id"],
    },
  );

  const unrelatedSession = await createSrsSession(await createFixture());
  const unrelatedEvent = srsEvent({
    sessionId: unrelatedSession.id,
    setId: unrelatedSession.set_id,
    vocabularyId: unrelatedSession.items[0].vocabulary_id,
    rating: "AGAIN",
  });
  const unrelatedFixture = await prisma.lEARNING_SESSION.findUniqueOrThrow({
    where: { id: unrelatedSession.id },
    select: { user_id: true, vocabulary_set_id: true },
  });
  const service = createLearningService({
    learningRepository: createLearningRepository(prisma),
    createSessionRepository: (transaction) => {
      const repository = createLearningSessionRepository(transaction);
      return Object.freeze({
        ...repository,
        async recordSrsReceipt(input) {
          await transaction.vOCABULARY_SET_ITEM.create({
            data: {
              vocabulary_set_id: unrelatedFixture.vocabulary_set_id,
              vocabulary_id: unrelatedSession.items[0].vocabulary_id,
              position: 99,
            },
          });
          return repository.recordSrsReceipt(input);
        },
      });
    },
    createStreakRepository: (transaction) => createStreakRepository(transaction),
    now: () => now,
  });
  const unrelatedCollision = await captureRejection(() =>
    service.recordMeaningfulEvent(unrelatedFixture.user_id, unrelatedEvent));
  assert.equal(unrelatedCollision.code, "P2002");
  assertUniqueTarget(unrelatedCollision, {
    model: "VOCABULARY_SET_ITEM",
    constraint: "VOCABULARY_SET_ITEM_vocabulary_set_id_vocabulary_id_key",
    columns: ["vocabulary_set_id", "vocabulary_id"],
  });
  assert.notEqual(unrelatedCollision.code, "LEARNING_PROGRESS_CHANGED");
});

test("AGAIN receipts stay unresolved and passing ratings complete atomically without duplicate replay", async () => {
  const fixture = await createFixture();
  const session = await createSrsSession(fixture);
  const [first, final] = session.items;

  const again = srsEvent({
    sessionId: session.id, setId: fixture.set.id,
    vocabularyId: first.vocabulary_id, rating: "AGAIN",
  });
  const againResponse = await postSrsEvent(fixture.userCookie, again);
  assert.equal(againResponse.status, 200, againResponse.text);
  assert.equal(againResponse.json.data.reward.xp_earned, 0);
  assert.equal(await receiptCount(session.id), 1);
  const afterAgain = await srsState(fixture.user.id, session.id);
  assert.equal(afterAgain.user.total_xp, 0);
  assert.equal(afterAgain.rewards.length, 0);
  assert.equal(afterAgain.session.status, "ACTIVE");
  assert.equal((await readSessionItem(session.id, first.vocabulary_id)).evidence, null);
  assert.equal(await prisma.sTREAK_DAY.count({ where: { user_id: fixture.user.id } }), 0);

  const firstPass = srsEvent({
    sessionId: session.id, setId: fixture.set.id,
    vocabularyId: first.vocabulary_id, expectedRevision: 1, rating: "GOOD",
  });
  assert.equal((await postSrsEvent(fixture.userCookie, firstPass)).status, 200);
  assert.equal((await readSessionItem(session.id, first.vocabulary_id)).evidence, "SRS_GOOD");

  const finalPass = srsEvent({
    sessionId: session.id, setId: fixture.set.id,
    vocabularyId: final.vocabulary_id, rating: "EASY",
  });
  const completed = await postSrsEvent(fixture.userCookie, finalPass);
  assert.equal(completed.status, 200, completed.text);
  assert.equal(completed.json.data.session.state, "COMPLETED");
  assert.equal(completed.json.data.streak.completed_today, true);
  const beforeReplay = await srsState(fixture.user.id, session.id);
  assert.equal(beforeReplay.receipts.length, 3);
  assert.equal(beforeReplay.rewards.length, 2);
  assert.equal(beforeReplay.progress.length, 2);
  assert.equal(beforeReplay.days.length, 1);
  assert.equal(beforeReplay.session.completion_event_id, finalPass.event_id);
  assert.deepEqual(
    beforeReplay.session.items.map(({ evidence }) => evidence),
    ["SRS_GOOD", "SRS_EASY"],
  );

  const replay = await postSrsEvent(fixture.userCookie, finalPass);
  assert.equal(replay.status, 200, replay.text);
  assert.equal(replay.json.data.reward.replayed, true);
  assert.deepEqual(await srsState(fixture.user.id, session.id), beforeReplay);
});

test("receipt replay conceals foreign ownership, conflicts across sessions and rejects stale events", async () => {
  const fixture = await createFixture();
  const firstSession = await createSrsSession(fixture);
  const secondSession = await createSrsSession(fixture);
  const vocabularyId = firstSession.items[0].vocabulary_id;
  const firstEvent = srsEvent({
    sessionId: firstSession.id, setId: fixture.set.id,
    vocabularyId, rating: "AGAIN",
  });
  assert.equal((await postSrsEvent(fixture.userCookie, firstEvent)).status, 200);

  const beforeForeign = await rejectedOperationState(fixture);
  const foreign = await postSrsEvent(fixture.otherCookie, firstEvent);
  assert.equal(foreign.status, 404);
  assert.equal(foreign.json.error.code, "LEARNING_SESSION_NOT_FOUND");
  assert.deepEqual(await rejectedOperationState(fixture), beforeForeign);

  const beforeCrossSession = await rejectedOperationState(fixture);
  const crossSession = await postSrsEvent(fixture.userCookie, {
    ...firstEvent,
    session_id: secondSession.id,
  });
  assert.equal(crossSession.status, 409);
  assert.equal(crossSession.json.error.code, "LEARNING_SESSION_EVENT_CONFLICT");
  assert.deepEqual(await rejectedOperationState(fixture), beforeCrossSession);

  const laterEvent = srsEvent({
    sessionId: firstSession.id, setId: fixture.set.id,
    vocabularyId, expectedRevision: 1, rating: "AGAIN",
  });
  assert.equal((await postSrsEvent(fixture.userCookie, laterEvent)).status, 200);
  const beforeStale = await rejectedOperationState(fixture);
  const stale = await postSrsEvent(fixture.userCookie, firstEvent);
  assert.equal(stale.status, 409);
  assert.equal(stale.json.error.code, "LEARNING_PROGRESS_CHANGED");
  assert.deepEqual(await rejectedOperationState(fixture), beforeStale);
  assert.equal(await receiptCount(firstSession.id), 2);
});

test("immutable SRS snapshot excludes an item that becomes due after creation", async () => {
  const fixture = await createFixture();
  const futureVocabulary = await prisma.vOCABULARY.create({
    data: { word: `streak-future-${randomUUID()}` },
  });
  await prisma.vOCABULARY_SET_ITEM.create({
    data: {
      vocabulary_set_id: fixture.set.id,
      vocabulary_id: futureVocabulary.id,
      position: 3,
    },
  });
  await prisma.lEARNING_PROGRESS.create({
    data: {
      user_id: fixture.user.id,
      vocabulary_id: futureVocabulary.id,
      status: "LEARNED",
      review_count: 1,
      revision: 1,
      last_reviewed_at: now,
      next_review_at: new Date(now.getTime() + 86_400_000),
      interval_days: 1,
    },
  });
  const session = await createSrsSession(fixture);
  assert.equal(session.items.some(({ vocabulary_id: id }) => id === futureVocabulary.id), false);
  await prisma.lEARNING_PROGRESS.update({
    where: {
      user_id_vocabulary_id: {
        user_id: fixture.user.id,
        vocabulary_id: futureVocabulary.id,
      },
    },
    data: { next_review_at: new Date(now.getTime() - 1) },
  });
  const excluded = await postSrsEvent(fixture.userCookie, srsEvent({
    sessionId: session.id, setId: fixture.set.id,
    vocabularyId: futureVocabulary.id, expectedRevision: 1, rating: "GOOD",
  }));
  assert.equal(excluded.status, 409);
  assert.equal(excluded.json.error.code, "LEARNING_SESSION_EVENT_CONFLICT");
  assert.equal(await receiptCount(session.id), 0);
});

test("concurrent exact final SRS ratings serialize as original plus replay", {
  timeout: CONTROLLED_CONTENTION_TIMEOUT_MS,
}, async () => {
  const exactFixture = await createFixture();
  const exactSession = await createSrsSession(exactFixture);
  await acceptFirstSrsItem(exactFixture, exactSession);
  const exactFinal = srsEvent({
    sessionId: exactSession.id, setId: exactFixture.set.id,
    vocabularyId: exactSession.items[1].vocabulary_id, rating: "HARD",
  });
  const exactResponses = await runContendedSrsRequests({
    fixture: exactFixture,
    session: exactSession,
    vocabularyId: exactSession.items[1].vocabulary_id,
    requests: [exactFinal, exactFinal],
    label: "exact concurrent SRS replay",
  });
  assert.deepEqual(exactResponses.map(({ status }) => status), [200, 200]);
  assert.deepEqual(exactResponses.map(({ json }) => json.data.reward.replayed).sort(), [false, true]);
  const exactState = await srsState(exactFixture.user.id, exactSession.id);
  assert.equal(exactState.receipts.length, 2);
  assert.equal(exactState.rewards.length, 2);
  assert.equal(exactState.progress.length, 2);
  assert.equal(exactState.days.length, 1);
  assert.equal(exactState.user.total_xp, 6);
  assert.equal(exactState.session.status, "COMPLETED");
  assert.equal(exactState.session.items[1].evidence, "SRS_HARD");
  assert.equal(exactState.receipts.filter(({ event_id: eventId }) => eventId === exactFinal.event_id).length, 1);
});

test("concurrent competing final SRS ratings accept once and reject the conflict", {
  timeout: CONTROLLED_CONTENTION_TIMEOUT_MS,
}, async () => {
  const competingFixture = await createFixture();
  const competingSession = await createSrsSession(competingFixture);
  await acceptFirstSrsItem(competingFixture, competingSession);
  const competingBase = {
    sessionId: competingSession.id,
    setId: competingFixture.set.id,
    vocabularyId: competingSession.items[1].vocabulary_id,
    rating: "GOOD",
  };
  const competingEvents = [srsEvent(competingBase), srsEvent(competingBase)];
  const competingResponses = await runContendedSrsRequests({
    fixture: competingFixture,
    session: competingSession,
    vocabularyId: competingSession.items[1].vocabulary_id,
    requests: competingEvents,
    label: "competing concurrent SRS events",
  });
  assert.deepEqual(competingResponses.map(({ status }) => status).sort(), [200, 409]);
  const rejected = competingResponses.find(({ status }) => status === 409);
  assert.equal(rejected.json.error.code, "LEARNING_SESSION_EVENT_CONFLICT");
  const competingState = await srsState(competingFixture.user.id, competingSession.id);
  assert.equal(competingState.receipts.length, 2);
  assert.equal(competingState.rewards.length, 2);
  assert.equal(competingState.progress.length, 2);
  assert.equal(competingState.days.length, 1);
  assert.equal(competingState.user.total_xp, 6);
  assert.equal(competingState.session.status, "COMPLETED");
  assert.equal(competingState.session.items[1].evidence, "SRS_GOOD");
  assert.equal(
    competingState.receipts.filter(({ event_id: eventId }) => (
      competingEvents.some(({ event_id: candidate }) => candidate === eventId)
    )).length,
    1,
  );
});

test("session-aware SRS waits for the shared advisory lock and releases after commit", {
  timeout: CONCURRENCY_TIMEOUT_MS,
}, async () => {
  const fixture = await createFixture();
  const session = await createSrsSession(fixture);
  const vocabularyId = session.items[0].vocabulary_id;
  let release;
  let locked;
  const releaseGate = new Promise((resolve) => { release = resolve; });
  const lockReady = new Promise((resolve) => { locked = resolve; });
  let holderPid;
  const holder = peer.$transaction(async (transaction) => {
    const [backend] = await transaction.$queryRaw`SELECT pg_backend_pid()::integer AS pid`;
    holderPid = backend.pid;
    await createLearningRepository(transaction).lockProgressIdentity(fixture.user.id, vocabularyId);
    locked();
    await releaseGate;
  });
  try {
    await withTimeout(lockReady, "Timed out waiting for SRS advisory-lock holder.", 5_000);
  } catch (error) {
    release();
    await withTimeout(
      Promise.allSettled([holder]),
      "Timed out settling the SRS advisory-lock holder.",
      5_000,
    );
    throw error;
  }
  const pending = postSrsEvent(fixture.userCookie, srsEvent({
    sessionId: session.id, setId: fixture.set.id, vocabularyId, rating: "AGAIN",
  }));
  let accepted;
  await runWithGuaranteedRelease({
    action: async () => {
      await waitForBlockingChain(
        holderPid,
        1,
        "Timed out establishing session-aware SRS advisory-lock contention.",
      );
      assert.equal(await remainsPending(pending), true);
    },
    release,
    held: [
      { label: "holder", promise: holder },
      { label: "request-1", promise: pending.then((response) => { accepted = response; }) },
    ],
    settleTimeoutMs: 5_000,
  });
  assert.equal(accepted.status, 200, accepted.text);
  await peer.$transaction((transaction) =>
    createLearningRepository(transaction).lockProgressIdentity(fixture.user.id, vocabularyId));
});

test("injected terminal Streak failure rolls Progress XP receipt evidence and completion back", async () => {
  const fixture = await createFixture();
  const session = await createSrsSession(fixture);
  await acceptFirstSrsItem(fixture, session);
  const before = await srsState(fixture.user.id, session.id);
  const service = createLearningService({
    learningRepository: createLearningRepository(prisma),
    createSessionRepository: (transaction) => createLearningSessionRepository(transaction),
    createStreakRepository: (transaction) => {
      const repository = createStreakRepository(transaction);
      return Object.freeze({
        ...repository,
        async insertDayForCompletedSession() {
          throw new Error("injected terminal Streak persistence failure");
        },
      });
    },
    now: () => now,
  });
  const finalEvent = srsEvent({
    sessionId: session.id, setId: fixture.set.id,
    vocabularyId: session.items[1].vocabulary_id, rating: "GOOD",
  });
  await assert.rejects(
    service.recordMeaningfulEvent(fixture.user.id, finalEvent),
    /injected terminal Streak persistence failure/,
  );
  assert.deepEqual(await srsState(fixture.user.id, session.id), before);
});

test("zero-correct multi-item Quiz completes once and exact final replay is immutable", async () => {
  const fixture = await createQuizFixture();
  const session = await createQuizSession(fixture, fixture.userCookie);
  const questions = await readSessionQuiz(fixture, session, fixture.userCookie);
  const first = quizAnswer(fixture, session, questions[0], wrongChoice(questions[0], fixture), randomUUID());
  const firstResult = await postQuizAnswer(fixture.userCookie, first);
  assert.equal(firstResult.status, 200, firstResult.text);
  assert.equal(firstResult.json.data.is_correct, false);
  assert.equal(firstResult.json.data.session.state, "ACTIVE");
  assert.equal(firstResult.json.data.session.completed_items, 1);
  assert.equal(Object.hasOwn(firstResult.json.data, "streak"), false);

  const final = quizAnswer(fixture, session, questions[1], wrongChoice(questions[1], fixture), randomUUID());
  const completed = await postQuizAnswer(fixture.userCookie, final);
  assert.equal(completed.status, 200, completed.text);
  assert.equal(completed.json.data.is_correct, false);
  assert.equal(completed.json.data.reward.xp_earned, 0);
  assert.equal(completed.json.data.session.state, "COMPLETED");
  assert.equal(completed.json.data.streak.current_streak, 1);
  const beforeReplay = await quizState(fixture.user.id, session.id);
  assert.equal(beforeReplay.user.total_xp, 0);
  assert.equal(beforeReplay.rewards.length, 0);
  assert.equal(beforeReplay.session.status, "COMPLETED");
  assert.deepEqual(beforeReplay.session.items.map(({ evidence }) => evidence),
    ["QUIZ_INCORRECT", "QUIZ_INCORRECT"]);
  assert.deepEqual(beforeReplay.session.items.map(({ evidence_event_id: eventId }) => eventId),
    [first.event_id, final.event_id]);
  assert.equal(beforeReplay.days.length, 1);
  const progressByVocabulary = new Map(beforeReplay.progress.map((row) => [row.vocabulary_id, row]));
  for (const accepted of [first, final]) {
    const progress = progressByVocabulary.get(accepted.vocabulary_id);
    assert.ok(progress);
    assert.equal(progress.status, "LEARNING");
    assert.equal(progress.revision, 1);
    assert.equal(progress.review_count, 1);
    assert.equal(progress.last_event_id, accepted.event_id);
  }
  const replay = await postQuizAnswer(fixture.userCookie, final);
  assert.equal(replay.status, 200, replay.text);
  assert.equal(replay.json.data.reward.replayed, true);
  assert.deepEqual(await quizState(fixture.user.id, session.id), beforeReplay);
  assertQuizError(await postQuizAnswer(fixture.userCookie, {
    ...final, event_id: randomUUID(), expected_revision: 1,
  }), 409, "LEARNING_SESSION_EVENT_CONFLICT");
  assert.deepEqual(await quizState(fixture.user.id, session.id), beforeReplay);

  const retake = await createQuizSession(fixture, fixture.userCookie);
  assert.notEqual(retake.id, session.id);
  assert.equal(retake.state, "ACTIVE");
  assert.equal(await prisma.sTREAK_DAY.count({ where: { user_id: fixture.user.id } }), 1);
});

test("Quiz event identity is session-bound, foreign-concealed, and terminal sessions reject mutation", async () => {
  const fixture = await createQuizFixture();
  const firstSession = await createQuizSession(fixture, fixture.userCookie);
  const secondSession = await createQuizSession(fixture, fixture.userCookie);
  const otherSession = await createQuizSession(fixture, fixture.otherCookie);
  const firstQuestions = await readSessionQuiz(fixture, firstSession, fixture.userCookie);
  const secondQuestions = await readSessionQuiz(fixture, secondSession, fixture.userCookie);
  const otherQuestions = await readSessionQuiz(fixture, otherSession, fixture.otherCookie);
  const eventId = randomUUID();
  const accepted = quizAnswer(fixture, firstSession, firstQuestions[0], correctChoice(firstQuestions[0], fixture), eventId);
  assertQuizError(await postQuizAnswer(fixture.userCookie, {
    ...accepted, run_id: randomUUID(), event_id: randomUUID(),
  }), 409, "LEARNING_SESSION_EVENT_CONFLICT");
  assert.equal((await postQuizAnswer(fixture.userCookie, accepted)).status, 200);

  const crossSession = quizAnswer(fixture, secondSession, secondQuestions[0], correctChoice(secondQuestions[0], fixture), eventId);
  assertQuizError(await postQuizAnswer(fixture.userCookie, crossSession), 409, "LEARNING_SESSION_EVENT_CONFLICT");
  const foreign = quizAnswer(fixture, otherSession, otherQuestions[0], correctChoice(otherQuestions[0], fixture), eventId);
  assertQuizError(await postQuizAnswer(fixture.otherCookie, foreign), 404, "LEARNING_SESSION_NOT_FOUND");

  const authoritativeExpiry = await prisma.lEARNING_SESSION.findUniqueOrThrow({
    where: { id: secondSession.id },
    select: { expires_at: true },
  });
  const beforeExpiryRejection = await quizState(fixture.user.id, secondSession.id);
  now = new Date(authoritativeExpiry.expires_at);
  assertQuizError(await postQuizAnswer(fixture.userCookie, {
    ...crossSession, event_id: randomUUID(),
  }), 409, "LEARNING_SESSION_EXPIRED");
  assert.deepEqual(await quizState(fixture.user.id, secondSession.id), beforeExpiryRejection);
});

test("concurrent exact final Quiz submissions award XP and Streak exactly once", {
  timeout: CONTROLLED_CONTENTION_TIMEOUT_MS,
}, async () => {
  const fixture = await createQuizFixture();
  const session = await createQuizSession(fixture, fixture.userCookie);
  const questions = await readSessionQuiz(fixture, session, fixture.userCookie);
  const first = quizAnswer(fixture, session, questions[0], correctChoice(questions[0], fixture), randomUUID());
  assert.equal((await postQuizAnswer(fixture.userCookie, first)).status, 200);
  const final = quizAnswer(fixture, session, questions[1], correctChoice(questions[1], fixture), randomUUID());
  const responses = await runContendedQuizRequests({
    fixture,
    vocabularyId: final.vocabulary_id,
    requests: [final, final],
    label: "exact concurrent Quiz replay",
  });
  assert.deepEqual(responses.map(({ status }) => status), [200, 200]);
  assert.equal(responses.filter(({ json }) => json.data.reward.replayed === false).length, 1);
  assert.equal(responses.filter(({ json }) => json.data.reward.replayed === true).length, 1);
  const state = await quizState(fixture.user.id, session.id);
  assert.equal(state.session.status, "COMPLETED");
  assert.equal(state.days.length, 1);
  assert.equal(state.rewards.length, 2);
  assert.equal(state.user.total_xp, 6);
  assert.equal(state.progress.length, 2);
  assert.deepEqual(state.session.items.map(({ evidence }) => evidence),
    ["QUIZ_CORRECT", "QUIZ_CORRECT"]);
  assert.deepEqual(state.session.items.map(({ evidence_event_id: eventId }) => eventId),
    [first.event_id, final.event_id]);
  const exactProgress = new Map(state.progress.map((row) => [row.vocabulary_id, row]));
  for (const accepted of [first, final]) {
    assert.equal(exactProgress.get(accepted.vocabulary_id).revision, 1);
    assert.equal(exactProgress.get(accepted.vocabulary_id).review_count, 1);
    assert.equal(exactProgress.get(accepted.vocabulary_id).last_event_id, accepted.event_id);
  }
});

test("concurrent competing final Quiz submissions accept once and reject the conflict", {
  timeout: CONTROLLED_CONTENTION_TIMEOUT_MS,
}, async () => {
  const fixture = await createQuizFixture();
  const competingSession = await createQuizSession(fixture, fixture.userCookie);
  const competingQuestions = await readSessionQuiz(fixture, competingSession, fixture.userCookie);
  const competingFirst = quizAnswer(fixture, competingSession,
    competingQuestions[0], correctChoice(competingQuestions[0], fixture), randomUUID());
  assert.equal((await postQuizAnswer(fixture.userCookie, competingFirst)).status, 200);
  const competingFinal = quizAnswer(fixture, competingSession, competingQuestions[1],
    correctChoice(competingQuestions[1], fixture), randomUUID());
  const competingEvents = [competingFinal, { ...competingFinal, event_id: randomUUID() }];
  const competingResponses = await runContendedQuizRequests({
    fixture,
    vocabularyId: competingFinal.vocabulary_id,
    requests: competingEvents,
    label: "competing concurrent Quiz events",
  });
  assert.deepEqual(competingResponses.map(({ status }) => status).sort(), [200, 409]);
  const competingState = await quizState(fixture.user.id, competingSession.id);
  assert.equal(competingState.session.status, "COMPLETED");
  assert.equal(competingState.days.length, 1);
  assert.equal(competingState.rewards.length, 2);
  assert.equal(competingState.user.total_xp, 6);
  assert.equal(competingState.progress.length, 2);
  assert.deepEqual(competingState.session.items.map(({ evidence }) => evidence),
    ["QUIZ_CORRECT", "QUIZ_CORRECT"]);
  const acceptedFinal = competingResponses.find(({ status }) => status === 200);
  assert.deepEqual(competingState.session.items.map(({ evidence_event_id: eventId }) => eventId), [
    competingFirst.event_id,
    acceptedFinal.json.data.reward.source_event_id,
  ]);
  const competingProgress = new Map(competingState.progress.map((row) => [row.vocabulary_id, row]));
  assert.equal(competingProgress.get(competingFirst.vocabulary_id).revision, 1);
  assert.equal(competingProgress.get(competingFirst.vocabulary_id).review_count, 1);
  assert.equal(competingProgress.get(competingFirst.vocabulary_id).last_event_id, competingFirst.event_id);
  assert.equal(competingProgress.get(competingFinal.vocabulary_id).revision, 1);
  assert.equal(competingProgress.get(competingFinal.vocabulary_id).review_count, 1);
  assert.equal(competingProgress.get(competingFinal.vocabulary_id).last_event_id,
    acceptedFinal.json.data.reward.source_event_id);
});

test("injected terminal Quiz Streak failure rolls Progress XP evidence completion and day back", async () => {
  const fixture = await createQuizFixture();
  const session = await createQuizSession(fixture, fixture.userCookie);
  const questions = await readSessionQuiz(fixture, session, fixture.userCookie);
  const first = quizAnswer(fixture, session, questions[0], correctChoice(questions[0], fixture), randomUUID());
  assert.equal((await postQuizAnswer(fixture.userCookie, first)).status, 200);
  const before = await quizState(fixture.user.id, session.id);
  const service = createQuizService({
    quizRepository: createQuizRepository(prisma),
    createSessionRepository: createLearningSessionRepository,
    createStreakRepository: (transaction) => ({
      ...createStreakRepository(transaction),
      async insertDayForCompletedSession() { throw new Error("injected Quiz terminal Streak failure"); },
    }),
    now: () => now,
  });
  const final = quizAnswer(fixture, session, questions[1], correctChoice(questions[1], fixture), randomUUID());
  await assert.rejects(service.recordAnswer(fixture.user.id, final), /injected Quiz terminal Streak failure/);
  assert.deepEqual(await quizState(fixture.user.id, session.id), before);
});

async function createQuizFixture() {
  const fixture = await createFixture();
  const topic = await createTopicFixture();
  const labels = ["meaning one", "meaning two", "meaning three", "meaning four", "meaning five"];
  const vocabulary = await Promise.all(labels.map((meaning, index) => prisma.vOCABULARY.create({
    data: {
      word: `streak-quiz-${index}-${randomUUID()}`,
      meanings: { create: [{ part_of_speech: "verb", meaning_vi: meaning, cefr_level: "A1" }] },
    },
  })));
  const set = await prisma.vOCABULARY_SET.create({ data: {
    owner_id: fixture.admin.id,
    topic_id: topic.id,
    name: `Streak Quiz ${randomUUID()}`,
    is_public: true,
    items: { create: vocabulary.slice(0, 2).map(({ id }, position) => ({
      vocabulary_id: id, position: position + 1,
    })) },
  } });
  return { ...fixture, set, quizVocabulary: vocabulary, quizLabels: labels };
}

async function createQuizSession(fixture, cookie) {
  const response = await request("/api/learning-sessions", { method: "POST", cookie, json: {
    operation_id: randomUUID(), set_id: fixture.set.id, mode: "QUIZ",
    vocabulary_ids: fixture.quizVocabulary.slice(0, 2).map(({ id }) => id),
  } });
  assert.equal(response.status, 201, response.text);
  return response.json.data.session;
}

async function readSessionQuiz(fixture, session, cookie) {
  const ids = session.items.map(({ vocabulary_id: id }) => id).join("%2C");
  const response = await request(`/api/quiz/sets/${fixture.set.id}/questions?type=MULTIPLE_CHOICE&run_id=${session.id}&session_id=${session.id}&vocabulary_ids=${ids}`, { cookie });
  assert.equal(response.status, 200, response.text);
  assert.equal(response.json.data.run_id, session.id);
  return response.json.data.questions;
}

function correctChoice(question, fixture) {
  const index = fixture.quizVocabulary.findIndex(({ id }) => id === question.vocabulary_id);
  return question.choices.find(({ label }) => label === fixture.quizLabels[index]).choice_id;
}

function wrongChoice(question, fixture) {
  const correct = correctChoice(question, fixture);
  return question.choices.find(({ choice_id }) => choice_id !== correct).choice_id;
}

function quizAnswer(fixture, session, question, selectedChoiceId, eventId) {
  return {
    event_id: eventId,
    session_id: session.id,
    set_id: fixture.set.id,
    vocabulary_id: question.vocabulary_id,
    run_id: session.id,
    question_revision: question.question_revision,
    quiz_type: "MULTIPLE_CHOICE",
    expected_revision: question.progress.revision,
    selected_choice_id: selectedChoiceId,
  };
}

function postQuizAnswer(cookie, json) {
  return request("/api/quiz/answers", { method: "POST", cookie, json });
}

function assertQuizError(response, status, code) {
  assert.equal(response.status, status, response.text);
  assert.equal(response.json?.error?.code, code);
}

async function quizState(userId, sessionId) {
  const [user, progress, rewards, session, days] = await Promise.all([
    prisma.uSER.findUniqueOrThrow({ where: { id: userId }, select: { total_xp: true } }),
    prisma.lEARNING_PROGRESS.findMany({ where: { user_id: userId }, orderBy: { vocabulary_id: "asc" } }),
    prisma.xP_REWARD.findMany({ where: { user_id: userId }, orderBy: { id: "asc" } }),
    prisma.lEARNING_SESSION.findUniqueOrThrow({ where: { id: sessionId },
      include: { items: { orderBy: { position: "asc" } } } }),
    prisma.sTREAK_DAY.findMany({ where: { user_id: userId }, orderBy: { activity_date: "asc" } }),
  ]);
  return { user, progress, rewards, session, days };
}

async function createFixture() {
  const user = await createUserFixture(prisma, { display_name: "Streak Foundation User" });
  const other = await createUserFixture(prisma, { display_name: "Streak Foundation Other" });
  const admin = await createUserFixture(prisma, { display_name: "Streak Foundation Admin", role: "ADMIN" });
  const [userSession, otherSession, adminSession] = await Promise.all([
    createSessionFixture(prisma, user.id),
    createSessionFixture(prisma, other.id),
    createSessionFixture(prisma, admin.id),
  ]);
  const vocabulary = await Promise.all([0, 1].map((index) => prisma.vOCABULARY.create({
    data: { word: `streak-foundation-${index}-${randomUUID()}` },
  })));
  const set = await prisma.vOCABULARY_SET.create({
    data: {
      owner_id: user.id,
      name: `Streak Foundation ${randomUUID()}`,
      is_public: false,
      items: {
        create: vocabulary.map(({ id }, index) => ({ vocabulary_id: id, position: index + 1 })),
      },
    },
  });
  return {
    user, other, admin, set,
    vocabularyIds: vocabulary.map(({ id }) => id),
    userCookie: `session_id=${userSession.rawToken}`,
    otherCookie: `session_id=${otherSession.rawToken}`,
    adminCookie: `session_id=${adminSession.rawToken}`,
  };
}

async function createSrsSession(fixture) {
  const response = await request("/api/learning-sessions", {
    method: "POST",
    cookie: fixture.userCookie,
    json: { operation_id: randomUUID(), set_id: fixture.set.id, mode: "SRS" },
  });
  assert.equal(response.status, 201, response.text);
  assert.equal(response.json.data.session.mode, "SRS");
  return response.json.data.session;
}

function markSessionCompleted(sessionId, completionEventId) {
  return prisma.lEARNING_SESSION.update({
    where: { id: sessionId },
    data: {
      status: "COMPLETED",
      completed_at: now,
      completion_event_id: completionEventId,
    },
  });
}

async function captureRejection(action) {
  try {
    await action();
  } catch (error) {
    return error;
  }
  assert.fail("Expected operation to reject.");
}

async function assertPrismaUniqueViolation(action, expected) {
  const error = await captureRejection(action);
  assert.equal(error?.code, "P2002");
  assertUniqueTarget(error, expected);
  return error;
}

function assertUniqueTarget(error, { model, constraint, columns }) {
  const target = Array.isArray(error?.meta?.target)
    ? error.meta.target.join(",")
    : String(error?.meta?.target ?? error?.meta?.constraint ?? "");
  const modelMatches = error?.meta?.modelName === model;
  const constraintMatches = target.includes(constraint);
  const columnsMatch = modelMatches && columns.every((column) => target.includes(column));
  assert.equal(
    constraintMatches || columnsMatch,
    true,
    `Unexpected Prisma unique target for ${model}: ${target}`,
  );
}

function srsEvent({
  eventId = randomUUID(), sessionId, setId, vocabularyId,
  expectedRevision = 0, rating,
}) {
  return {
    event_id: eventId,
    ...(sessionId ? { session_id: sessionId } : {}),
    set_id: setId,
    vocabulary_id: vocabularyId,
    expected_revision: expectedRevision,
    rating,
  };
}

function postSrsEvent(cookie, json) {
  return request("/api/learning/events", { method: "POST", cookie, json });
}

async function acceptFirstSrsItem(fixture, session) {
  const response = await postSrsEvent(fixture.userCookie, srsEvent({
    sessionId: session.id,
    setId: fixture.set.id,
    vocabularyId: session.items[0].vocabulary_id,
    rating: "GOOD",
  }));
  assert.equal(response.status, 200, response.text);
}

function receiptCount(sessionId) {
  return prisma.lEARNING_SESSION_SRS_RECEIPT.count({
    where: { session_item: { session_id: sessionId } },
  });
}

function readSessionItem(sessionId, vocabularyId) {
  return prisma.lEARNING_SESSION_ITEM.findUniqueOrThrow({
    where: { session_id_vocabulary_id: { session_id: sessionId, vocabulary_id: vocabularyId } },
  });
}

async function srsState(userId, sessionId) {
  const [user, progress, rewards, session, receipts, days] = await Promise.all([
    prisma.uSER.findUniqueOrThrow({ where: { id: userId }, select: { total_xp: true } }),
    prisma.lEARNING_PROGRESS.findMany({ where: { user_id: userId }, orderBy: { vocabulary_id: "asc" } }),
    prisma.xP_REWARD.findMany({ where: { user_id: userId }, orderBy: { id: "asc" } }),
    prisma.lEARNING_SESSION.findUniqueOrThrow({
      where: { id: sessionId },
      include: { items: { orderBy: { position: "asc" } } },
    }),
    prisma.lEARNING_SESSION_SRS_RECEIPT.findMany({
      where: { session_item: { session_id: sessionId } },
      orderBy: { event_id: "asc" },
    }),
    prisma.sTREAK_DAY.findMany({ where: { user_id: userId }, orderBy: { activity_date: "asc" } }),
  ]);
  return { user, progress, rewards, session, receipts, days };
}

async function srsUserState(userId) {
  const [user, progress, rewards, sessions, receipts, days] = await Promise.all([
    prisma.uSER.findUniqueOrThrow({ where: { id: userId }, select: { total_xp: true } }),
    prisma.lEARNING_PROGRESS.findMany({ where: { user_id: userId }, orderBy: { vocabulary_id: "asc" } }),
    prisma.xP_REWARD.findMany({ where: { user_id: userId }, orderBy: { id: "asc" } }),
    prisma.lEARNING_SESSION.findMany({
      where: { user_id: userId },
      orderBy: { id: "asc" },
      include: { items: { orderBy: { position: "asc" } } },
    }),
    prisma.lEARNING_SESSION_SRS_RECEIPT.findMany({
      where: { session_item: { session: { user_id: userId } } },
      orderBy: { event_id: "asc" },
    }),
    prisma.sTREAK_DAY.findMany({ where: { user_id: userId }, orderBy: { activity_date: "asc" } }),
  ]);
  return { user, progress, rewards, sessions, receipts, days };
}

async function rejectedOperationState(fixture) {
  return Promise.all([
    srsUserState(fixture.user.id),
    srsUserState(fixture.other.id),
  ]);
}

function createTopicFixture() {
  return prisma.tOPIC.create({
    data: { name: `Streak Foundation Topic ${randomUUID()}` },
  });
}

async function createPublicSystemSetFixture() {
  const fixture = await createFixture();
  const topic = await createTopicFixture();
  const set = await prisma.vOCABULARY_SET.create({
    data: {
      topic_id: topic.id,
      owner_id: fixture.admin.id,
      name: `Streak Foundation System Set ${randomUUID()}`,
      cefr_level: "A1",
      is_public: true,
      items: {
        create: fixture.vocabularyIds.map((vocabularyId, index) => ({
          vocabulary_id: vocabularyId,
          position: index + 1,
        })),
      },
    },
  });
  return { ...fixture, set };
}

function readPersistedSession(sessionId) {
  return prisma.lEARNING_SESSION.findUnique({
    where: { id: sessionId },
    include: { items: { orderBy: { position: "asc" } } },
  });
}

function normalCreateBody(fixture) {
  return {
    operation_id: randomUUID(),
    set_id: fixture.set.id,
    mode: "NORMAL",
    vocabulary_ids: fixture.vocabularyIds,
  };
}

async function createNormalSession(fixture) {
  const response = await request("/api/learning-sessions", {
    method: "POST",
    cookie: fixture.userCookie,
    json: normalCreateBody(fixture),
  });
  assert.equal(response.status, 201);
  return response.json.data.session;
}

function createCompletionReadyNormalSession(fixture) {
  const acceptedAt = new Date(now.getTime());
  return prisma.lEARNING_SESSION.create({
    data: {
      user_id: fixture.user.id,
      vocabulary_set_id: fixture.set.id,
      set_id_snapshot: fixture.set.id,
      mode: "NORMAL",
      create_operation_id: randomUUID(),
      snapshot_size: fixture.vocabularyIds.length,
      created_at: acceptedAt,
      expires_at: new Date(acceptedAt.getTime() + 7 * 86_400_000),
      items: {
        create: fixture.vocabularyIds.map((vocabularyId, position) => ({
          vocabulary_id: vocabularyId,
          position,
          evidence: "NORMAL_REVEALED",
          evidence_event_id: randomUUID(),
          evidence_at: acceptedAt,
        })),
      },
    },
  });
}

function reveal(fixture, sessionId, vocabularyId, operationId) {
  return revealWithCookie({
    cookie: fixture.userCookie,
    sessionId,
    vocabularyId,
    operationId,
  });
}

function revealWithCookie({ cookie, sessionId, vocabularyId, operationId }) {
  return request(`/api/learning-sessions/${sessionId}/items/${vocabularyId}/reveal`, {
    method: "PUT",
    cookie,
    json: { operation_id: operationId },
  });
}

function request(path, options) {
  return http.request(path, options);
}

async function assertLockTimeout(client, operation) {
  await assert.rejects(client.$transaction(async (transaction) => {
    await transaction.$executeRawUnsafe("SET LOCAL lock_timeout = '150ms'");
    await operation(transaction);
  }));
}

async function remainsPending(promise) {
  const result = await Promise.race([
    promise.then(() => false, () => false),
    new Promise((resolve) => setTimeout(() => resolve(true), 100)),
  ]);
  return result;
}

async function withTimeout(promise, message, timeoutMs = 2_000) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function settleConcurrentRequests(promises, message) {
  try {
    return await withTimeout(Promise.all(promises), message, 10_000);
  } catch (primaryError) {
    try {
      await withTimeout(
        Promise.allSettled(promises),
        `${message} Requests did not settle after failure.`,
        5_000,
      );
    } catch (settlementError) {
      throw new AggregateError([primaryError, settlementError], message);
    }
    throw primaryError;
  }
}

async function runContendedSrsRequests({ fixture, session, vocabularyId, requests, label }) {
  let release;
  let signalLocked;
  const releaseGate = new Promise((resolve) => { release = resolve; });
  const lockReady = new Promise((resolve) => { signalLocked = resolve; });
  let holderPid;
  const holder = peer.$transaction(async (transaction) => {
    const [backend] = await transaction.$queryRaw`SELECT pg_backend_pid()::integer AS pid`;
    holderPid = backend.pid;
    await createLearningRepository(transaction).lockProgressIdentity(fixture.user.id, vocabularyId);
    signalLocked();
    await releaseGate;
  });
  try {
    await withTimeout(lockReady, `Timed out acquiring the ${label} barrier.`, 5_000);
  } catch (error) {
    release();
    await withTimeout(
      Promise.allSettled([holder]),
      `Timed out settling the failed ${label} barrier.`,
      5_000,
    );
    throw error;
  }
  const pendingRequests = requests.map((event) => postSrsEvent(fixture.userCookie, event));
  await runWithGuaranteedRelease({
    action: async () => {
      await waitForBlockingChain(holderPid, 2, `Timed out establishing ${label} contention.`);
      assert.deepEqual(
        await Promise.all(pendingRequests.map((requestPromise) => remainsPending(requestPromise))),
        [true, true],
      );
    },
    release,
    held: labeledContentionOperations(holder, pendingRequests),
    settleTimeoutMs: 10_000,
  });
  return settleConcurrentRequests(pendingRequests, `Timed out settling ${label}.`);
}

async function runContendedQuizRequests({ fixture, vocabularyId, requests, label }) {
  let release;
  let signalLocked;
  const releaseGate = new Promise((resolve) => { release = resolve; });
  const lockReady = new Promise((resolve) => { signalLocked = resolve; });
  let holderPid;
  const holder = peer.$transaction(async (transaction) => {
    const [backend] = await transaction.$queryRaw`SELECT pg_backend_pid()::integer AS pid`;
    holderPid = backend.pid;
    await createQuizRepository(transaction).lockProgressIdentity(fixture.user.id, vocabularyId);
    signalLocked();
    await releaseGate;
  });
  try {
    await withTimeout(lockReady, `Timed out acquiring the ${label} barrier.`, 5_000);
  } catch (error) {
    release();
    await withTimeout(
      Promise.allSettled([holder]),
      `Timed out settling the failed ${label} barrier.`,
      5_000,
    );
    throw error;
  }
  const pendingRequests = requests.map((event) => postQuizAnswer(fixture.userCookie, event));
  await runWithGuaranteedRelease({
    action: async () => {
      await waitForBlockingChain(holderPid, 2, `Timed out establishing ${label} contention.`);
      assert.deepEqual(
        await Promise.all(pendingRequests.map((requestPromise) => remainsPending(requestPromise))),
        [true, true],
      );
    },
    release,
    held: labeledContentionOperations(holder, pendingRequests),
    settleTimeoutMs: 10_000,
  });
  return settleConcurrentRequests(pendingRequests, `Timed out settling ${label}.`);
}

async function waitForBlockingChain(holderPid, expectedCount, message) {
  return observeBoundedContention({
    expectedCount,
    message,
    readSample: (remainingMs) => readBlockingChain(holderPid, expectedCount, remainingMs),
    describeRows: (rows) => describeContentionWaitStates(rows, expectedCount),
    observationDeadlineMs: 10_000,
    maximumSamples: 200,
    minimumLifecycleBudgetMs: CONTENTION_OBSERVER_MIN_LIFECYCLE_BUDGET_MS,
  });
}

function readBlockingChain(holderPid, expectedCount, remainingMs) {
  const { maxWait, timeout, statementTimeoutMs } = contentionObserverTransactionPolicy(remainingMs);
  return runSanitizedContentionObserver((phase) => observer.$transaction(async (transaction) => {
    phase.callbackEntered();
    phase.statementTimeoutStarted();
    await transaction.$queryRaw`SELECT set_config(
      'statement_timeout',
      ${`${statementTimeoutMs}ms`},
      true
    )`;
    phase.statementTimeoutCompleted();
    phase.blockingQueryStarted();
    const rows = await transaction.$queryRaw`
      WITH RECURSIVE blocked(pid, depth, path) AS (
        SELECT activity.pid, 1, ARRAY[activity.pid]
        FROM pg_stat_activity AS activity
        WHERE ${holderPid} = ANY(pg_blocking_pids(activity.pid))
        UNION ALL
        SELECT activity.pid, prior.depth + 1, prior.path || activity.pid
        FROM pg_stat_activity AS activity
        JOIN blocked AS prior ON prior.pid = ANY(pg_blocking_pids(activity.pid))
        WHERE prior.depth < ${expectedCount}
          AND NOT activity.pid = ANY(prior.path)
      )
      SELECT activity.pid::integer AS pid,
             blocked.depth::integer AS depth,
             activity.state,
             activity.wait_event_type,
             activity.wait_event,
             pg_blocking_pids(activity.pid)::integer[] AS blocking_pids
      FROM (
        SELECT pid, MIN(depth)::integer AS depth
        FROM blocked
        GROUP BY pid
      ) AS blocked
      JOIN pg_stat_activity AS activity ON activity.pid = blocked.pid
      ORDER BY blocked.depth ASC, activity.pid ASC
      LIMIT ${expectedCount}
    `;
    phase.blockingQueryCompleted();
    phase.callbackReturned();
    return rows;
  }, { maxWait, timeout }), prismaObserverErrorTypes);
}

function labeledContentionOperations(holder, requests) {
  return [
    { label: "holder", promise: holder },
    ...requests.map((promise, index) => ({ label: `request-${index + 1}`, promise })),
  ];
}

async function legacyState(userId) {
  const [user, progress, rewards] = await Promise.all([
    prisma.uSER.findUnique({ where: { id: userId }, select: { total_xp: true } }),
    prisma.lEARNING_PROGRESS.findMany({
      where: { user_id: userId },
      orderBy: { vocabulary_id: "asc" },
    }),
    prisma.xP_REWARD.findMany({
      where: { user_id: userId },
      orderBy: { id: "asc" },
    }),
  ]);
  return { user, progress, rewards };
}
