import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, afterEach, before, test } from "node:test";
import { createLearningRepository } from "../../src/repositories/learning-repository.js";
import {
  XP_REWARD_COLLISION_KINDS,
  isXpRewardCollisionError,
} from "../../src/repositories/xp-reward-repository.js";
import { createTestDatabase } from "../helpers/test-database.js";
import {
  assertMatchingOwnership,
  assertRunIdentity,
  assertSafeSchemaName,
  buildOwnership,
} from "./xp-level-migration-safety.js";

const TEST_PREFIX = "xp-reward-task-220";
const INTEGER_MAX = 2_147_483_647;

let database;
let prisma;
const fixtureUserIds = new Set();
const fixtureVocabularyIds = new Set();

before(async () => {
  const schemaName = requireIsolatedSchemaEnvironment();
  database = await createTestDatabase();
  prisma = database.prisma;
  await assertIsolatedSchemaOwnership(schemaName);
});

afterEach(async () => {
  await cleanupFixtures();
});

after(async () => {
  try {
    await cleanupFixtures();
  } finally {
    if (database) await database.disconnect();
  }
});

test("accepted Progress CAS, reward insertion, and XP increment commit in one caller-owned transaction", async () => {
  const { user, vocabulary, progress } = await createFixture({ totalXp: 7 });
  const reward = rewardData(user.id, vocabulary.id);

  const result = await createLearningRepository(prisma).withTransaction(async (repository) => {
    const updated = await repository.updateProgressAtRevision(progress.id, 1, {
      revision: { increment: 1 },
      review_count: { increment: 1 },
      last_event_id: reward.source_event_id,
    });
    assert.equal(updated.count, 1);
    return repository.insertRewardAndIncrementXp(reward);
  });

  assert.equal(result.total_xp, 10);
  assert.equal(result.reward.vocabulary_id, vocabulary.id);
  assert.deepEqual(await persistedState(user.id, vocabulary.id), {
    totalXp: 10,
    progressRevision: 2,
    progressEventId: reward.source_event_id,
    rewards: [{
      user_id: user.id,
      vocabulary_id: vocabulary.id,
      reward_type: "SRS_INITIAL",
      reward_cycle: 0,
      source_event_id: reward.source_event_id,
      xp_amount: 3,
    }],
  });
});

test("a reward collision after Progress CAS rolls the Progress mutation back and cannot increment XP", async () => {
  const { user, vocabulary, progress } = await createFixture();
  const firstReward = rewardData(user.id, vocabulary.id);
  await createLearningRepository(prisma).withTransaction((repository) =>
    repository.insertRewardAndIncrementXp(firstReward));

  const duplicateIdentity = rewardData(user.id, vocabulary.id, {
    source_event_id: randomUUID(),
  });
  await assert.rejects(
    createLearningRepository(prisma).withTransaction(async (repository) => {
      const updated = await repository.updateProgressAtRevision(progress.id, 1, {
        revision: { increment: 1 },
        review_count: { increment: 1 },
        last_event_id: duplicateIdentity.source_event_id,
      });
      assert.equal(updated.count, 1);
      return repository.insertRewardAndIncrementXp(duplicateIdentity);
    }),
    (error) => isXpRewardCollisionError(error)
      && error.kind === XP_REWARD_COLLISION_KINDS.REWARD_IDENTITY,
  );

  assert.deepEqual(await persistedState(user.id, vocabulary.id), {
    totalXp: 3,
    progressRevision: 1,
    progressEventId: null,
    rewards: [{
      user_id: user.id,
      vocabulary_id: vocabulary.id,
      reward_type: "SRS_INITIAL",
      reward_cycle: 0,
      source_event_id: firstReward.source_event_id,
      xp_amount: 3,
    }],
  });
});

test("a database increment failure rolls both the reward insertion and Progress CAS back", async () => {
  const { user, vocabulary, progress } = await createFixture({ totalXp: INTEGER_MAX });
  const reward = rewardData(user.id, vocabulary.id);

  await assert.rejects(
    createLearningRepository(prisma).withTransaction(async (repository) => {
      const updated = await repository.updateProgressAtRevision(progress.id, 1, {
        revision: { increment: 1 },
        review_count: { increment: 1 },
        last_event_id: reward.source_event_id,
      });
      assert.equal(updated.count, 1);
      return repository.insertRewardAndIncrementXp(reward);
    }),
    (error) => !isXpRewardCollisionError(error),
  );

  assert.deepEqual(await persistedState(user.id, vocabulary.id), {
    totalXp: INTEGER_MAX,
    progressRevision: 1,
    progressEventId: null,
    rewards: [],
  });
});

test("USER/source-event uniqueness rejects a different Vocabulary identity without a second increment", async () => {
  const { user, vocabulary: firstVocabulary } = await createFixture({ progress: false });
  const secondVocabulary = await createVocabulary();
  const sourceEventId = randomUUID();
  const repository = createLearningRepository(prisma);

  await repository.withTransaction((transaction) =>
    transaction.insertRewardAndIncrementXp(rewardData(user.id, firstVocabulary.id, {
      source_event_id: sourceEventId,
    })));

  await assert.rejects(
    repository.withTransaction((transaction) =>
      transaction.insertRewardAndIncrementXp(rewardData(user.id, secondVocabulary.id, {
        reward_type: "QUIZ_FIRST_CORRECT",
        source_event_id: sourceEventId,
      }))),
    (error) => isXpRewardCollisionError(error)
      && error.kind === XP_REWARD_COLLISION_KINDS.SOURCE_EVENT,
  );

  assert.equal(await prisma.uSER.findUnique({ where: { id: user.id }, select: { total_xp: true } }).then((row) => row.total_xp), 3);
  assert.equal(await prisma.xP_REWARD.count({ where: { user_id: user.id } }), 1);
  assert.equal(await prisma.xP_REWARD.count({ where: { user_id: user.id, vocabulary_id: secondVocabulary.id } }), 0);
});

test("concurrent duplicate attempts persist and increment exactly once", async () => {
  const { user, vocabulary } = await createFixture({ progress: false });
  const reward = rewardData(user.id, vocabulary.id);
  const repository = createLearningRepository(prisma);

  const attempts = await Promise.allSettled([
    repository.withTransaction((transaction) => transaction.insertRewardAndIncrementXp(reward)),
    repository.withTransaction((transaction) => transaction.insertRewardAndIncrementXp(reward)),
  ]);

  assert.equal(attempts.filter(({ status }) => status === "fulfilled").length, 1);
  const rejected = attempts.find(({ status }) => status === "rejected");
  assert.ok(rejected);
  assert.equal(isXpRewardCollisionError(rejected.reason), true);
  assert.equal(await prisma.xP_REWARD.count({ where: { user_id: user.id } }), 1);
  assert.equal(await prisma.uSER.findUnique({ where: { id: user.id }, select: { total_xp: true } }).then((row) => row.total_xp), 3);
});

test("concurrent rewards for different exact Vocabulary UUIDs accumulate without a lost update", async () => {
  const { user, vocabulary: firstVocabulary } = await createFixture({ progress: false });
  const secondVocabulary = await createVocabulary();
  const repository = createLearningRepository(prisma);

  await Promise.all([
    repository.withTransaction((transaction) => transaction.insertRewardAndIncrementXp(
      rewardData(user.id, firstVocabulary.id),
    )),
    repository.withTransaction((transaction) => transaction.insertRewardAndIncrementXp(
      rewardData(user.id, secondVocabulary.id),
    )),
  ]);

  const rewards = await prisma.xP_REWARD.findMany({
    where: { user_id: user.id },
    orderBy: { vocabulary_id: "asc" },
    select: { vocabulary_id: true, xp_amount: true },
  });
  assert.deepEqual(new Set(rewards.map(({ vocabulary_id }) => vocabulary_id)), new Set([
    firstVocabulary.id,
    secondVocabulary.id,
  ]));
  assert.deepEqual(rewards.map(({ xp_amount }) => xp_amount), [3, 3]);
  assert.equal(await prisma.uSER.findUnique({ where: { id: user.id }, select: { total_xp: true } }).then((row) => row.total_xp), 6);
});

test("replay lookup returns exact positive evidence and absence remains the zero-reward basis", async () => {
  const { user, vocabulary } = await createFixture({ progress: false });
  const reward = rewardData(user.id, vocabulary.id);
  const repository = createLearningRepository(prisma);

  assert.equal(await repository.findRewardBySourceEvent(user.id, reward.source_event_id), null);
  assert.equal(await repository.findRewardByIdentity(user.id, vocabulary.id, reward.reward_type, reward.reward_cycle), null);

  await repository.withTransaction((transaction) => transaction.insertRewardAndIncrementXp(reward));

  assert.deepEqual(await repository.findRewardBySourceEvent(user.id, reward.source_event_id), reward);
  assert.deepEqual(
    await repository.findRewardByIdentity(user.id, vocabulary.id, reward.reward_type, reward.reward_cycle),
    reward,
  );
});

async function createFixture({ totalXp = 0, progress = true } = {}) {
  const user = await prisma.uSER.create({
    data: {
      email: `${TEST_PREFIX}-${randomUUID()}@example.test`,
      password_hash: "task-220-not-an-auth-fixture",
      display_name: "TASK-220 Repository User",
      role: "USER",
      total_xp: totalXp,
    },
  });
  fixtureUserIds.add(user.id);
  const vocabulary = await createVocabulary();
  const progressRow = progress
    ? await prisma.lEARNING_PROGRESS.create({
      data: {
        user_id: user.id,
        vocabulary_id: vocabulary.id,
        status: "LEARNING",
        review_count: 1,
        revision: 1,
      },
    })
    : null;
  return { user, vocabulary, progress: progressRow };
}

async function createVocabulary() {
  const vocabulary = await prisma.vOCABULARY.create({
    data: { word: `${TEST_PREFIX}-${randomUUID()}` },
  });
  fixtureVocabularyIds.add(vocabulary.id);
  return vocabulary;
}

function rewardData(userId, vocabularyId, overrides = {}) {
  return {
    user_id: userId,
    vocabulary_id: vocabularyId,
    reward_type: "SRS_INITIAL",
    reward_cycle: 0,
    source_event_id: randomUUID(),
    xp_amount: 3,
    ...overrides,
  };
}

async function persistedState(userId, vocabularyId) {
  const [user, progress, rewards] = await Promise.all([
    prisma.uSER.findUnique({ where: { id: userId }, select: { total_xp: true } }),
    prisma.lEARNING_PROGRESS.findUnique({
      where: { user_id_vocabulary_id: { user_id: userId, vocabulary_id: vocabularyId } },
      select: { revision: true, last_event_id: true },
    }),
    prisma.xP_REWARD.findMany({
      where: { user_id: userId, vocabulary_id: vocabularyId },
      orderBy: { created_at: "asc" },
      select: {
        user_id: true,
        vocabulary_id: true,
        reward_type: true,
        reward_cycle: true,
        source_event_id: true,
        xp_amount: true,
      },
    }),
  ]);
  return {
    totalXp: user.total_xp,
    progressRevision: progress.revision,
    progressEventId: progress.last_event_id,
    rewards,
  };
}

async function cleanupFixtures() {
  if (!prisma) return;
  const userIds = [...fixtureUserIds];
  const vocabularyIds = [...fixtureVocabularyIds];
  if (userIds.length > 0) {
    await prisma.xP_REWARD.deleteMany({ where: { user_id: { in: userIds } } });
    await prisma.lEARNING_PROGRESS.deleteMany({ where: { user_id: { in: userIds } } });
    await prisma.aUTH_SESSION.deleteMany({ where: { user_id: { in: userIds } } });
  }
  if (vocabularyIds.length > 0) {
    await prisma.vOCABULARY.deleteMany({ where: { id: { in: vocabularyIds } } });
  }
  if (userIds.length > 0) {
    await prisma.uSER.deleteMany({ where: { id: { in: userIds } } });
  }
  fixtureUserIds.clear();
  fixtureVocabularyIds.clear();
}

function requireIsolatedSchemaEnvironment() {
  const schemaName = assertSafeSchemaName(
    process.env.XP_REPOSITORY_TEST_SCHEMA ?? "",
  );
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
