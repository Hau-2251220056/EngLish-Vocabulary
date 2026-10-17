import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, afterEach, before, test } from "node:test";
import { createLearningRepository } from "../../src/repositories/learning-repository.js";
import { createLearningService } from "../../src/services/learning-service.js";
import { createTestDatabase } from "../helpers/test-database.js";
import {
  assertMatchingOwnership,
  assertRunIdentity,
  assertSafeSchemaName,
  buildOwnership,
} from "./xp-level-migration-safety.js";

const TEST_PREFIX = "xp-srs-task-222";
const FIXED_NOW = new Date("2026-10-16T08:00:00.000Z");
const INTEGER_MAX = 2_147_483_647;

let database;
let prisma;
const fixtureUserIds = new Set();
const fixtureVocabularyIds = new Set();
const fixtureSetIds = new Set();

before(async () => {
  const schemaName = requireIsolatedSchemaEnvironment();
  database = await createTestDatabase();
  prisma = database.prisma;
  await assertIsolatedSchemaOwnership(schemaName);
});

afterEach(cleanupFixtures);

after(async () => {
  try {
    await cleanupFixtures();
  } finally {
    if (database) await database.disconnect();
  }
});

test("initial HARD, GOOD, and EASY each persist exactly one 3 XP reward", async () => {
  for (const rating of ["HARD", "GOOD", "EASY"]) {
    const fixture = await createFixture();
    const result = await record(fixture, { rating });

    assertReward(result, { earned: 3, total: 3, replayed: false });
    assert.deepEqual(await rewardSummary(fixture.user.id, fixture.vocabulary.id), [
      { reward_type: "SRS_INITIAL", reward_cycle: 0, xp_amount: 3 },
    ]);
  }
});

test("multiple initial AGAIN events award zero and each first passing rating remains eligible", async () => {
  for (const rating of ["HARD", "GOOD", "EASY"]) {
    const fixture = await createFixture();
    const firstAgain = await record(fixture, { rating: "AGAIN" });
    const secondAgain = await record(fixture, {
      rating: "AGAIN",
      expectedRevision: 1,
    });
    const passing = await record(fixture, {
      rating,
      expectedRevision: 2,
    });

    assertReward(firstAgain, { earned: 0, total: 0, replayed: false });
    assertReward(secondAgain, { earned: 0, total: 0, replayed: false });
    assertReward(passing, { earned: 3, total: 3, replayed: false });
    assert.equal(await rewardCount(fixture.user.id), 1);
  }
});

test("legacy, Quiz-unscheduled, and future Progress cannot receive due-review XP", async () => {
  const cases = [
    { status: "NEEDS_REVIEW", intervalDays: null, nextReviewAt: null },
    { status: "LEARNED", intervalDays: null, nextReviewAt: null },
    { status: "LEARNED", intervalDays: 3, nextReviewAt: dayOffset(1), rejects: true },
  ];
  for (const entry of cases) {
    const fixture = await createFixture({ totalXp: 3 });
    await seedInitialReward(fixture);
    await createProgress(fixture, entry);
    const operation = record(fixture, { rating: "GOOD", expectedRevision: 1 });

    if (entry.rejects) {
      await assert.rejects(operation, { code: "LEARNING_PROGRESS_CHANGED" });
    } else {
      assertReward(await operation, { earned: 0, total: 3, replayed: false });
    }
    assert.equal(await rewardCount(fixture.user.id), 1);
    assert.equal(await totalXp(fixture.user.id), 3);
  }
});

test("exact-boundary and overdue LEARNED reviews award 1 XP from the pre-event revision", async () => {
  for (const nextReviewAt of [new Date(FIXED_NOW), dayOffset(-1)]) {
    const fixture = await createFixture({ totalXp: 3 });
    await seedInitialReward(fixture);
    await createProgress(fixture, {
      status: "LEARNED",
      revision: 7,
      intervalDays: 3,
      nextReviewAt,
    });

    const result = await record(fixture, { rating: "HARD", expectedRevision: 7 });
    assertReward(result, { earned: 1, total: 4, replayed: false });
    assert.deepEqual(await rewardSummary(fixture.user.id, fixture.vocabulary.id), [
      { reward_type: "SRS_INITIAL", reward_cycle: 0, xp_amount: 3 },
      { reward_type: "SRS_DUE_REVIEW", reward_cycle: 7, xp_amount: 1 },
    ]);
  }
});

test("due AGAIN awards once, immediate requeues award zero, and a later due cycle can award", async () => {
  const fixture = await createFixture({ totalXp: 3 });
  await seedInitialReward(fixture);
  await createProgress(fixture, {
    status: "LEARNED",
    revision: 4,
    intervalDays: 3,
    nextReviewAt: dayOffset(-1),
  });
  let clock = new Date(FIXED_NOW);
  const learningService = service(() => new Date(clock));

  const dueAgain = await record(fixture, {
    rating: "AGAIN",
    expectedRevision: 4,
    learningService,
  });
  const requeue = await record(fixture, {
    rating: "AGAIN",
    expectedRevision: 5,
    learningService,
  });
  const pass = await record(fixture, {
    rating: "GOOD",
    expectedRevision: 6,
    learningService,
  });
  clock = new Date(FIXED_NOW.getTime() + 3 * 86_400_000);
  const laterDue = await record(fixture, {
    rating: "EASY",
    expectedRevision: 7,
    learningService,
  });

  assertReward(dueAgain, { earned: 1, total: 4, replayed: false });
  assertReward(requeue, { earned: 0, total: 4, replayed: false });
  assertReward(pass, { earned: 0, total: 4, replayed: false });
  assertReward(laterDue, { earned: 1, total: 5, replayed: false });
  assert.deepEqual(
    (await rewardSummary(fixture.user.id, fixture.vocabulary.id))
      .filter(({ reward_type }) => reward_type === "SRS_DUE_REVIEW")
      .map(({ reward_cycle }) => reward_cycle),
    [4, 7],
  );
});

test("replay returns original XP and current total without a second mutation", async () => {
  const fixture = await createFixture();
  const eventId = randomUUID();
  const original = await record(fixture, { rating: "GOOD", eventId });
  const unrelated = await createVocabulary("unrelated");
  await createLearningRepository(prisma).withTransaction((repository) =>
    repository.insertRewardAndIncrementXp({
      user_id: fixture.user.id,
      vocabulary_id: unrelated.id,
      reward_type: "QUIZ_FIRST_CORRECT",
      reward_cycle: 0,
      source_event_id: randomUUID(),
      xp_amount: 3,
    }));
  const replay = await record(fixture, { rating: "EASY", eventId });

  assertReward(original, { earned: 3, total: 3, replayed: false });
  assertReward(replay, { earned: 3, total: 6, replayed: true });
  assert.equal(replay.revision, original.revision);
  assert.equal(await rewardCount(fixture.user.id), 2);
});

test("same headword UUIDs and alternate Sets preserve exact reward identity", async () => {
  const user = await createUser();
  const first = await createVocabulary("same-headword", {
    ownerId: user.id,
    word: `${TEST_PREFIX}-shared`,
  });
  const second = await createVocabulary("same-headword", {
    ownerId: user.id,
    word: `${TEST_PREFIX}-shared`,
  });
  const firstSet = await createSet(user.id, [first.id, second.id]);
  const alternateSet = await createSet(user.id, [first.id]);
  const firstEventId = randomUUID();

  const firstResult = await record(
    { user, vocabulary: first, set: firstSet },
    { rating: "GOOD", eventId: firstEventId },
  );
  const duplicateIdentity = await record(
    { user, vocabulary: first, set: alternateSet },
    { rating: "EASY", eventId: firstEventId },
  );
  const secondResult = await record({ user, vocabulary: second, set: firstSet }, { rating: "GOOD" });

  assertReward(firstResult, { earned: 3, total: 3, replayed: false });
  assertReward(duplicateIdentity, { earned: 3, total: 3, replayed: true });
  assertReward(secondResult, { earned: 3, total: 6, replayed: false });
  assert.deepEqual(
    new Set((await prisma.xP_REWARD.findMany({ where: { user_id: user.id } }))
      .map(({ vocabulary_id }) => vocabulary_id)),
    new Set([first.id, second.id]),
  );
});

test("concurrent duplicate and same-revision commands cannot double transition or award", async () => {
  const duplicateFixture = await createFixture();
  const duplicateEvent = randomUUID();
  const duplicateResults = await Promise.all([
    record(duplicateFixture, { rating: "GOOD", eventId: duplicateEvent }),
    record(duplicateFixture, { rating: "GOOD", eventId: duplicateEvent }),
  ]);
  assert.deepEqual(
    duplicateResults.map(({ reward }) => reward.replayed).sort(),
    [false, true],
  );
  assert.equal(await rewardCount(duplicateFixture.user.id), 1);
  assert.equal(await totalXp(duplicateFixture.user.id), 3);

  const raceFixture = await createFixture();
  const raceResults = await Promise.allSettled([
    record(raceFixture, { rating: "HARD" }),
    record(raceFixture, { rating: "EASY" }),
  ]);
  assert.equal(raceResults.filter(({ status }) => status === "fulfilled").length, 1);
  assert.equal(raceResults.filter(({ status }) => status === "rejected").length, 1);
  assert.equal(await rewardCount(raceFixture.user.id), 1);
  assert.equal(await totalXp(raceFixture.user.id), 3);
});

test("stale CAS and reward insertion collisions roll back Progress and XP", async () => {
  const stale = await createFixture();
  await createProgress(stale, { status: "LEARNING", revision: 2, nextReviewAt: FIXED_NOW });
  await assert.rejects(
    record(stale, { rating: "GOOD", expectedRevision: 1 }),
    { code: "LEARNING_PROGRESS_CHANGED" },
  );
  assert.deepEqual(await persistedState(stale), { revision: 2, eventId: null, totalXp: 0, rewards: 0 });

  const collision = await createFixture({ totalXp: 4 });
  await seedInitialReward(collision);
  await createProgress(collision, {
    status: "LEARNED",
    revision: 5,
    intervalDays: 3,
    nextReviewAt: dayOffset(-1),
  });
  await prisma.xP_REWARD.create({
    data: {
      user_id: collision.user.id,
      vocabulary_id: collision.vocabulary.id,
      reward_type: "SRS_DUE_REVIEW",
      reward_cycle: 5,
      source_event_id: randomUUID(),
      xp_amount: 1,
    },
  });
  await assert.rejects(
    record(collision, { rating: "GOOD", expectedRevision: 5 }),
    { code: "LEARNING_PROGRESS_CHANGED" },
  );
  assert.deepEqual(await persistedState(collision), { revision: 5, eventId: null, totalXp: 4, rewards: 2 });
});

test("XP increment failure rolls back the accepted Progress and reward insert", async () => {
  const fixture = await createFixture({ totalXp: INTEGER_MAX });
  await assert.rejects(record(fixture, { rating: "GOOD" }));
  assert.deepEqual(await persistedState(fixture), {
    revision: null,
    eventId: null,
    totalXp: INTEGER_MAX,
    rewards: 0,
  });
});

test("authorization rejection and NORMAL reads create no Progress, reward, or XP", async () => {
  const owner = await createUser();
  const other = await createUser();
  const vocabulary = await createVocabulary("authorization");
  const set = await createSet(owner.id, [vocabulary.id]);

  await assert.rejects(
    record({ user: other, vocabulary, set }, { rating: "GOOD" }),
    { code: "LEARNING_SET_NOT_FOUND" },
  );
  const normal = await service().getLearningSet(owner.id, set.id, { mode: "NORMAL" });
  assert.equal(normal.mode, "NORMAL");
  assert.equal(await prisma.lEARNING_PROGRESS.count({ where: { user_id: owner.id } }), 0);
  assert.equal(await rewardCount(owner.id), 0);
  assert.equal(await totalXp(owner.id), 0);
  assert.equal(await totalXp(other.id), 0);
});

function service(now = () => new Date(FIXED_NOW)) {
  return createLearningService({
    learningRepository: createLearningRepository(prisma),
    now,
  });
}

function record(fixture, {
  rating,
  expectedRevision = 0,
  eventId = randomUUID(),
  learningService = service(),
}) {
  return learningService.recordMeaningfulEvent(fixture.user.id, {
    event_id: eventId,
    set_id: fixture.set.id,
    vocabulary_id: fixture.vocabulary.id,
    expected_revision: expectedRevision,
    rating,
  });
}

async function createFixture({ totalXp = 0 } = {}) {
  const user = await createUser(totalXp);
  const vocabulary = await createVocabulary("fixture");
  const set = await createSet(user.id, [vocabulary.id]);
  return { user, vocabulary, set };
}

async function createUser(totalXp = 0) {
  const user = await prisma.uSER.create({
    data: {
      email: `${TEST_PREFIX}-${randomUUID()}@example.test`,
      password_hash: "task-222-not-an-auth-fixture",
      display_name: "TASK-222 SRS XP User",
      role: "USER",
      total_xp: totalXp,
    },
  });
  fixtureUserIds.add(user.id);
  return user;
}

async function createVocabulary(label, { ownerId = null, word } = {}) {
  const vocabulary = await prisma.vOCABULARY.create({
    data: {
      owner_id: ownerId,
      word: word ?? `${TEST_PREFIX}-${label}-${randomUUID()}`,
    },
  });
  fixtureVocabularyIds.add(vocabulary.id);
  return vocabulary;
}

async function createSet(ownerId, vocabularyIds) {
  const set = await prisma.vOCABULARY_SET.create({
    data: {
      owner_id: ownerId,
      name: `${TEST_PREFIX}-${randomUUID()}`,
      is_public: false,
      items: {
        create: vocabularyIds.map((vocabularyId, index) => ({
          vocabulary_id: vocabularyId,
          position: index + 1,
        })),
      },
    },
  });
  fixtureSetIds.add(set.id);
  return set;
}

function createProgress(fixture, {
  status,
  revision = 1,
  intervalDays = null,
  nextReviewAt = null,
}) {
  return prisma.lEARNING_PROGRESS.create({
    data: {
      user_id: fixture.user.id,
      vocabulary_id: fixture.vocabulary.id,
      status,
      review_count: revision,
      revision,
      last_reviewed_at: dayOffset(-3),
      interval_days: intervalDays,
      next_review_at: nextReviewAt,
    },
  });
}

function seedInitialReward(fixture) {
  return prisma.xP_REWARD.create({
    data: {
      user_id: fixture.user.id,
      vocabulary_id: fixture.vocabulary.id,
      reward_type: "SRS_INITIAL",
      reward_cycle: 0,
      source_event_id: randomUUID(),
      xp_amount: 3,
    },
  });
}

function rewardSummary(userId, vocabularyId) {
  return prisma.xP_REWARD.findMany({
    where: { user_id: userId, vocabulary_id: vocabularyId },
    orderBy: [{ reward_type: "asc" }, { reward_cycle: "asc" }],
    select: { reward_type: true, reward_cycle: true, xp_amount: true },
  });
}

function rewardCount(userId) {
  return prisma.xP_REWARD.count({ where: { user_id: userId } });
}

async function totalXp(userId) {
  return prisma.uSER.findUniqueOrThrow({
    where: { id: userId },
    select: { total_xp: true },
  }).then(({ total_xp }) => total_xp);
}

async function persistedState(fixture) {
  const progress = await prisma.lEARNING_PROGRESS.findUnique({
    where: {
      user_id_vocabulary_id: {
        user_id: fixture.user.id,
        vocabulary_id: fixture.vocabulary.id,
      },
    },
    select: { revision: true, last_event_id: true },
  });
  return {
    revision: progress?.revision ?? null,
    eventId: progress?.last_event_id ?? null,
    totalXp: await totalXp(fixture.user.id),
    rewards: await rewardCount(fixture.user.id),
  };
}

function assertReward(result, { earned, total, replayed }) {
  assert.equal(result.reward.xp_earned, earned);
  assert.equal(result.reward.total_xp, total);
  assert.equal(result.reward.replayed, replayed);
  assert.equal(typeof result.reward.level, "number");
  assert.equal(Object.hasOwn(result, "status"), true);
  assert.equal(Object.hasOwn(result, "revision"), true);
}

function dayOffset(days) {
  return new Date(FIXED_NOW.getTime() + days * 86_400_000);
}

async function cleanupFixtures() {
  if (!prisma) return;
  const userIds = [...fixtureUserIds];
  const vocabularyIds = [...fixtureVocabularyIds];
  const setIds = [...fixtureSetIds];
  await prisma.$transaction(async (transaction) => {
    if (userIds.length > 0) {
      await transaction.xP_REWARD.deleteMany({ where: { user_id: { in: userIds } } });
      await transaction.lEARNING_PROGRESS.deleteMany({ where: { user_id: { in: userIds } } });
      await transaction.aUTH_SESSION.deleteMany({ where: { user_id: { in: userIds } } });
    }
    if (setIds.length > 0) {
      await transaction.vOCABULARY_SET_ITEM.deleteMany({
        where: { vocabulary_set_id: { in: setIds } },
      });
      await transaction.vOCABULARY_SET.deleteMany({ where: { id: { in: setIds } } });
    }
    if (vocabularyIds.length > 0) {
      await transaction.vOCABULARY.deleteMany({ where: { id: { in: vocabularyIds } } });
    }
    if (userIds.length > 0) {
      await transaction.uSER.deleteMany({ where: { id: { in: userIds } } });
    }
  });
  fixtureUserIds.clear();
  fixtureVocabularyIds.clear();
  fixtureSetIds.clear();
}

function requireIsolatedSchemaEnvironment() {
  const schemaName = assertSafeSchemaName(process.env.XP_LEARNING_TEST_SCHEMA ?? "");
  const testUrl = new URL(process.env.TEST_DATABASE_URL ?? "");
  const databaseUrl = new URL(process.env.DATABASE_URL ?? "");
  assert.equal(testUrl.searchParams.get("schema"), schemaName);
  assert.equal(databaseUrl.searchParams.get("schema"), schemaName);
  assert.equal(testUrl.toString(), databaseUrl.toString());
  return schemaName;
}

async function assertIsolatedSchemaOwnership(schemaName) {
  const identity = assertRunIdentity({
    repository: process.env.GITHUB_REPOSITORY ?? "",
    runId: process.env.GITHUB_RUN_ID ?? "",
    attempt: process.env.GITHUB_RUN_ATTEMPT ?? "",
  });
  const expectedOwnership = buildOwnership({
    repository: identity.repository,
    runId: identity.runId,
    attempt: identity.attempt,
    schemaName,
  });
  const [row] = await prisma.$queryRawUnsafe(
    "SELECT current_schema() AS schema_name, obj_description(current_schema()::regnamespace, 'pg_namespace') AS ownership_marker",
  );
  assert.equal(row?.schema_name, schemaName);
  assertMatchingOwnership(row?.ownership_marker, expectedOwnership);
}
