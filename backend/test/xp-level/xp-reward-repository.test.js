import assert from "node:assert/strict";
import test from "node:test";
import { createLearningRepository } from "../../src/repositories/learning-repository.js";
import { createQuizRepository } from "../../src/repositories/quiz-repository.js";
import {
  XP_REWARD_COLLISION_KINDS,
  createXpRewardRepository,
  isXpRewardCollisionError,
} from "../../src/repositories/xp-reward-repository.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const VOCABULARY_ID = "22222222-2222-4222-8222-222222222222";
const SOURCE_EVENT_ID = "33333333-3333-4333-8333-333333333333";
const REWARD = Object.freeze({
  id: "44444444-4444-4444-8444-444444444444",
  user_id: USER_ID,
  vocabulary_id: VOCABULARY_ID,
  reward_type: "SRS_INITIAL",
  reward_cycle: 0,
  source_event_id: SOURCE_EVENT_ID,
  xp_amount: 3,
  created_at: new Date("2026-10-16T08:00:00.000Z"),
});

test("reward lookups use exact USER-scoped source and composite identities", async () => {
  const calls = [];
  const repository = createXpRewardRepository(prismaDouble({ calls }));

  await repository.findRewardBySourceEvent(USER_ID, SOURCE_EVENT_ID);
  await repository.findRewardByIdentity(USER_ID, VOCABULARY_ID, "SRS_INITIAL", 0);

  assert.deepEqual(calls.map(({ operation, args }) => ({ operation, where: args.where })), [
    {
      operation: "reward.findUnique",
      where: {
        user_id_source_event_id: {
          user_id: USER_ID,
          source_event_id: SOURCE_EVENT_ID,
        },
      },
    },
    {
      operation: "reward.findUnique",
      where: {
        user_id_vocabulary_id_reward_type_reward_cycle: {
          user_id: USER_ID,
          vocabulary_id: VOCABULARY_ID,
          reward_type: "SRS_INITIAL",
          reward_cycle: 0,
        },
      },
    },
  ]);
});

test("a new positive reward is inserted before the matching atomic XP increment", async () => {
  const calls = [];
  const repository = createXpRewardRepository(prismaDouble({ calls, totalXp: 13 }));

  const result = await repository.insertRewardAndIncrementXp(REWARD);

  assert.deepEqual(result, { reward: REWARD, total_xp: 13 });
  assert.deepEqual(calls.map(({ operation }) => operation), ["reward.create", "user.update"]);
  assert.deepEqual(calls[0].args.data, {
    user_id: USER_ID,
    vocabulary_id: VOCABULARY_ID,
    reward_type: "SRS_INITIAL",
    reward_cycle: 0,
    source_event_id: SOURCE_EVENT_ID,
    xp_amount: 3,
  });
  assert.deepEqual(calls[1].args, {
    where: { id: USER_ID },
    data: { total_xp: { increment: 3 } },
    select: { total_xp: true },
  });
});

test("composite reward identity collisions are classified for service conflict mapping", async () => {
  const error = prismaUniqueError([
    "user_id",
    "vocabulary_id",
    "reward_type",
    "reward_cycle",
  ]);
  const repository = createXpRewardRepository(prismaDouble({ createError: error }));

  await assert.rejects(repository.insertPositiveReward(REWARD), (caught) => {
    assert.equal(isXpRewardCollisionError(caught), true);
    assert.equal(caught.kind, XP_REWARD_COLLISION_KINDS.REWARD_IDENTITY);
    assert.equal(caught.cause, error);
    return true;
  });
});

test("USER/source-event collisions are classified independently", async () => {
  const error = prismaUniqueError("XP_REWARD_user_id_source_event_id_key");
  const repository = createXpRewardRepository(prismaDouble({ createError: error }));

  await assert.rejects(repository.insertPositiveReward(REWARD), (caught) => {
    assert.equal(isXpRewardCollisionError(caught), true);
    assert.equal(caught.kind, XP_REWARD_COLLISION_KINDS.SOURCE_EVENT);
    return true;
  });
});

test("unexpected database errors and unknown uniqueness targets propagate unchanged", async () => {
  for (const error of [
    Object.assign(new Error("database unavailable"), { code: "P1001" }),
    prismaUniqueError(["unrelated_field"]),
  ]) {
    const repository = createXpRewardRepository(prismaDouble({ createError: error }));
    await assert.rejects(repository.insertPositiveReward(REWARD), (caught) => caught === error);
  }
});

test("an insert failure never attempts an XP increment", async () => {
  const calls = [];
  const error = prismaUniqueError("XP_REWARD_user_id_source_event_id_key");
  const repository = createXpRewardRepository(prismaDouble({ calls, createError: error }));

  await assert.rejects(repository.insertRewardAndIncrementXp(REWARD), isXpRewardCollisionError);
  assert.deepEqual(calls.map(({ operation }) => operation), ["reward.create"]);
});

test("an XP increment failure propagates for caller-owned transaction rollback", async () => {
  const calls = [];
  const error = Object.assign(new Error("USER update failed"), { code: "P2025" });
  const repository = createXpRewardRepository(prismaDouble({ calls, updateError: error }));

  await assert.rejects(repository.insertRewardAndIncrementXp(REWARD), (caught) => caught === error);
  assert.deepEqual(calls.map(({ operation }) => operation), ["reward.create", "user.update"]);
});

test("USER XP reads return the scoped balance or null without deriving a value", async () => {
  assert.equal(await createXpRewardRepository(prismaDouble({ totalXp: 21 })).readUserTotalXp(USER_ID), 21);
  assert.equal(await createXpRewardRepository(prismaDouble({ missingUser: true })).readUserTotalXp(USER_ID), null);
});

test("Learning and Quiz transactions compose the same reward primitives without nesting", async () => {
  for (const createActivityRepository of [createLearningRepository, createQuizRepository]) {
    let transactionCount = 0;
    const transactionClient = prismaDouble({ totalXp: 3 });
    const rootClient = {
      $transaction: async (callback) => {
        transactionCount += 1;
        return callback(transactionClient);
      },
    };

    const result = await createActivityRepository(rootClient).withTransaction(async (repository) => {
      assert.equal(typeof repository.findRewardByIdentity, "function");
      assert.equal(typeof repository.insertRewardAndIncrementXp, "function");
      return repository.insertRewardAndIncrementXp(REWARD);
    });

    assert.equal(result.total_xp, 3);
    assert.equal(transactionCount, 1);
  }
});

function prismaDouble({
  calls = [],
  createError,
  updateError,
  totalXp = 3,
  missingUser = false,
} = {}) {
  return {
    xP_REWARD: {
      async findUnique(args) {
        calls.push({ operation: "reward.findUnique", args });
        return REWARD;
      },
      async create(args) {
        calls.push({ operation: "reward.create", args });
        if (createError) throw createError;
        return REWARD;
      },
    },
    uSER: {
      async findUnique(args) {
        calls.push({ operation: "user.findUnique", args });
        return missingUser ? null : { total_xp: totalXp };
      },
      async update(args) {
        calls.push({ operation: "user.update", args });
        if (updateError) throw updateError;
        return { total_xp: totalXp };
      },
    },
  };
}

function prismaUniqueError(target) {
  return Object.assign(new Error("unique constraint"), {
    code: "P2002",
    meta: { target },
  });
}
