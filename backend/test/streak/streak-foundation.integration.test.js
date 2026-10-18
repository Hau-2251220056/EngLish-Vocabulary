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
import { createSessionFixture, createUserFixture } from "../helpers/auth-fixtures.js";
import { startHttpTestServer } from "../helpers/http-test-server.js";
import { assertFoundationAuthorization } from "./streak-foundation-safety.js";
import { runWithGuaranteedRelease } from "./streak-foundation-safety.js";

let database;
let prisma;
let peer;
let http;
let now = new Date("2026-10-18T16:59:59.999Z");
const CONCURRENCY_TIMEOUT_MS = 15_000;

before(async () => {
  assertFoundationAuthorization(process.env);
  const [{ createTestDatabase }, { PrismaClient }] = await Promise.all([
    import("../helpers/test-database.js"),
    import("../../src/generated/prisma/client.ts"),
  ]);
  const expectedSchema = process.env.STREAK_FOUNDATION_SCHEMA_NAME;
  const expectedSchemaMarker = process.env.STREAK_FOUNDATION_SCHEMA_MARKER;
  assert.equal(typeof expectedSchema, "string");
  assert.equal(typeof expectedSchemaMarker, "string");
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
  try {
    if (database) await database.reset();
  } finally {
    try { if (http) await http.close(); }
    finally {
      try { if (peer) await peer.$disconnect(); }
      finally { if (database) await database.disconnect(); }
    }
  }
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

  await prisma.vOCABULARY_SET.update({
    where: { id: fixture.set.id },
    data: { is_public: true },
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

  await prisma.lEARNING_PROGRESS.createMany({
    data: fixture.vocabularyIds.map((vocabularyId) => ({
      user_id: fixture.user.id,
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
    cookie: fixture.userCookie,
    json: {
      operation_id: randomUUID(),
      set_id: fixture.set.id,
      mode: "SRS",
    },
  });
  assert.equal(upToDate.status, 200);
  assert.deepEqual(upToDate.json.data, {
    session: null,
    reason: "SRS_UP_TO_DATE",
    replayed: false,
  });
  assert.equal(await prisma.lEARNING_SESSION.count({ where: { user_id: fixture.user.id } }), 0);
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

  const revokedFixture = await createFixture();
  await prisma.vOCABULARY_SET.update({
    where: { id: revokedFixture.set.id },
    data: { is_public: true },
  });
  const createdByOther = await request("/api/learning-sessions", {
    method: "POST",
    cookie: revokedFixture.otherCookie,
    json: normalCreateBody(revokedFixture),
  });
  assert.equal(createdByOther.status, 201);
  await prisma.vOCABULARY_SET.update({
    where: { id: revokedFixture.set.id },
    data: { is_public: false },
  });
  const afterRevocation = await reveal(
    revokedFixture,
    createdByOther.json.data.session.id,
    revokedFixture.vocabularyIds[0],
    randomUUID(),
  );
  assert.equal(afterRevocation.status, 409);
  assert.equal(afterRevocation.json.error.code, "LEARNING_SESSION_INACCESSIBLE");
});

test("parallel completed sessions create one Streak day without deadlock", {
  timeout: CONCURRENCY_TIMEOUT_MS,
}, async () => {
  const fixture = await createFixture();
  const sessions = await Promise.all([
    createNormalSession(fixture),
    createNormalSession(fixture),
  ]);
  for (const session of sessions) {
    for (const vocabularyId of fixture.vocabularyIds) {
      assert.equal((await reveal(fixture, session.id, vocabularyId, randomUUID())).status, 200);
    }
  }
  const completions = await Promise.all(sessions.map((session) => request(
    `/api/learning-sessions/${session.id}/complete`,
    { method: "POST", cookie: fixture.userCookie, json: { operation_id: randomUUID() } },
  )));
  assert.deepEqual(completions.map(({ status }) => status), [200, 200]);
  assert.equal(await prisma.sTREAK_DAY.count({ where: { user_id: fixture.user.id } }), 1);
  assert.equal(await prisma.lEARNING_SESSION.count({
    where: { user_id: fixture.user.id, status: "COMPLETED" },
  }), 2);
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

test("post-lock instant controls expiry and the Asia/Ho_Chi_Minh completion day", {
  timeout: CONCURRENCY_TIMEOUT_MS,
}, async () => {
  const fixture = await createFixture();
  const midnightSession = await createNormalSession(fixture);
  for (const vocabularyId of fixture.vocabularyIds) {
    assert.equal((await reveal(fixture, midnightSession.id, vocabularyId, randomUUID())).status, 200);
  }
  now = new Date("2026-10-18T17:00:00.000Z");
  const completionOperationId = randomUUID();
  const completed = await request(`/api/learning-sessions/${midnightSession.id}/complete`, {
    method: "POST", cookie: fixture.userCookie, json: { operation_id: completionOperationId },
  });
  assert.equal(completed.status, 200);
  assert.equal(completed.json.data.streak.last_qualified_date, "2026-10-19");
  const replay = await request(`/api/learning-sessions/${midnightSession.id}/complete`, {
    method: "POST",
    cookie: fixture.userCookie,
    json: { operation_id: completionOperationId },
  });
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
  await runWithGuaranteedRelease({
    action: async () => {
      await withTimeout(lockReady, "Timed out waiting for session row lock holder.");
      pendingReveal = reveal(fixture, expiring.id, fixture.vocabularyIds[0], randomUUID());
      assert.equal(await remainsPending(pendingReveal), true);
      now = expiresAt;
    },
    release,
    held: [blocker],
  });
  const expired = await withTimeout(pendingReveal, "Timed out waiting for expired reveal response.");
  assert.equal(expired.status, 409);
  assert.equal(expired.json.error.code, "LEARNING_SESSION_EXPIRED");
});

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

function reveal(fixture, sessionId, vocabularyId, operationId) {
  return request(`/api/learning-sessions/${sessionId}/items/${vocabularyId}/reveal`, {
    method: "PUT",
    cookie: fixture.userCookie,
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

async function legacyState(userId) {
  const [user, progress, rewards] = await Promise.all([
    prisma.uSER.findUnique({ where: { id: userId }, select: { total_xp: true } }),
    prisma.lEARNING_PROGRESS.findMany({
      where: { user_id: userId },
      orderBy: { vocabulary_id: "asc" },
      select: { vocabulary_id: true, status: true, revision: true, last_event_id: true },
    }),
    prisma.xP_REWARD.findMany({
      where: { user_id: userId },
      orderBy: { id: "asc" },
      select: { id: true, xp_amount: true, source_event_id: true },
    }),
  ]);
  return { user, progress, rewards };
}
