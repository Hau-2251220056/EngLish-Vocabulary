import assert from "node:assert/strict";
import test from "node:test";

import {
  createDailyGoalRepository,
  createDailyGoalRepositoryForTest,
  DAILY_GOAL_CLEANUP_BATCH_LIMIT,
} from "../../src/repositories/daily-goal-repository.js";

const USER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

test("USER transaction acquires its advisory lock before exposing the same transaction", async () => {
  const harness = createHarness();
  const repository = createDailyGoalRepository(harness.prisma);
  await repository.withUserTransaction(USER, async (...args) => {
    const [transactionRepository] = args;
    assert.equal(args.length, 1);
    assert.deepEqual(harness.calls.map((call) => call.kind), ["lock"]);
    await transactionRepository.findOwner();
    return { ok: true };
  });
  assert.deepEqual(harness.calls.map((call) => call.kind), ["lock", "owner.findUnique", "commit"]);
  assert.equal(harness.calls[0].values[0], USER);
});

test("lock failure prevents every command read and write", async () => {
  const harness = createHarness({ failLock: true });
  let entered = false;
  await assert.rejects(
    createDailyGoalRepository(harness.prisma).withUserTransaction(USER, () => { entered = true; }),
    /lock failed/,
  );
  assert.equal(entered, false);
  assert.deepEqual(harness.calls.map((call) => call.kind), ["lock", "rollback"]);
});

test("owned session, monitor and notification operations always include authenticated user_id", async () => {
  const harness = createHarness();
  await createDailyGoalRepository(harness.prisma).withUserTransaction(USER, async (repository) => {
    await repository.findTrackingSession("tracking");
    await repository.updateTrackingSession("tracking", { status: "PAUSED" });
    await repository.findMonitorSession("monitor");
    await repository.updateMonitorSession("monitor", { closed_at: new Date(0) });
    await repository.findNotification("notification");
    await repository.markNotificationRead("notification", new Date(1));
  });
  for (const call of harness.calls.filter((entry) => entry.args?.where)) {
    assert.equal(call.args.where.user_id, USER);
  }
  assert.equal(JSON.stringify(harness.calls).includes(OTHER), false);
});

test("activity context queries remain owner/access scoped inside the USER transaction", async () => {
  const harness = createHarness();
  const observedAt = new Date("2026-10-26T00:00:00.000Z");
  await createDailyGoalRepository(harness.prisma).withUserTransaction(USER, async (repository) => {
    await repository.findAuthorizedActivityContext({ activityType: "QUIZ", learningSessionId: "learning", observedAt });
    await repository.findAuthorizedActivityContext({ activityType: "SPEAKING", setId: "set", vocabularyId: "word", observedAt });
  });
  assert.deepEqual(harness.calls.find((call) => call.kind === "learning-session.findFirst").args.where, {
    id: "learning", user_id: USER, status: "ACTIVE", mode: "QUIZ", expires_at: { gt: observedAt },
  });
  const speaking = harness.calls.find((call) => call.kind === "set.findFirst").args.where;
  assert.equal(speaking.id, "set");
  assert.deepEqual(speaking.items, { some: { vocabulary_id: "word" } });
  assert.equal(speaking.OR[1].owner_id, USER);
});

test("generation updates and expired-owner fencing are conditional and clear the pointer first", async () => {
  const harness = createHarness();
  await createDailyGoalRepository(harness.prisma).withUserTransaction(USER, async (repository) => {
    await repository.updateOwnerAtGeneration(7n, { lease_expires_at: new Date(10) });
    await repository.clearExpiredOwnerAtGeneration({
      expectedGeneration: 7n,
      expiredBefore: new Date(20),
      nextGeneration: 8n,
    });
  });
  const updates = harness.calls.filter((call) => call.kind === "owner.updateMany");
  assert.deepEqual(updates[0].args.where, { user_id: USER, generation: 7n });
  assert.deepEqual(updates[1].args.data, {
    tracking_session_id: null,
    lease_expires_at: null,
    last_accounted_at: null,
    generation: 8n,
  });
});

test("receipt replay accepts only exact stored type and server-derived fingerprint", async () => {
  const harness = createHarness({ receipt: {
    operation_id: "op", user_id: USER, operation_type: "HEARTBEAT",
    request_fingerprint: "server-derived-exact", credited_milliseconds: 20_000n,
    response_projection: { generation: "7" },
  } });
  await createDailyGoalRepository(harness.prisma).withUserTransaction(USER, async (repository) => {
    const replay = await repository.findOperationReplay({
      operationId: "op", operationType: "HEARTBEAT", requestFingerprint: "server-derived-exact",
    });
    assert.equal(replay.classification, "REPLAY");
    assert.equal(replay.receipt.credited_milliseconds, 20_000n);
    assert.equal((await repository.findOperationReplay({
      operationId: "op", operationType: "PAUSE", requestFingerprint: "server-derived-exact",
    })).classification, "OPERATION_CONFLICT");
    assert.equal((await repository.findOperationReplay({
      operationId: "op", operationType: "HEARTBEAT", requestFingerprint: "different",
    })).classification, "OPERATION_CONFLICT");
  });
});

test("day, receipt, reward, preference, monitor and notification writes stay owner-scoped", async () => {
  const harness = createHarness();
  const day = new Date("2026-10-26T00:00:00.000Z");
  await createDailyGoalRepository(harness.prisma).withUserTransaction(USER, async (repository) => {
    await repository.upsertDay(day, { create: { active_milliseconds: 0n }, update: { active_milliseconds: 1n } });
    await repository.createOperationReceipt({ operation_id: "op" });
    await repository.createReward({ activity_date: day, source_operation_id: "op", xp_amount: 10 });
    await repository.updatePreference({ daily_goal_minutes: 20 });
    await repository.incrementTotalXp(10);
    await repository.createMonitorSession({ id: "monitor" });
    await repository.createNotification({ id: "notification" });
  });
  const serialized = harness.calls.filter((call) => call.args?.data).map((call) => call.args.data);
  assert.equal(serialized.filter((data) => data.user_id === USER).length, 4);
  assert.equal(harness.calls.find((call) => call.kind === "day.upsert").args.create.user_id, USER);
  assert.deepEqual(harness.calls.find((call) => call.kind === "user.updateMany").args.where, { id: USER });
  assert.deepEqual(harness.calls.find((call) => call.kind === "user.update").args, {
    where: { id: USER }, data: { total_xp: { increment: 10 } }, select: { total_xp: true },
  });
});

test("transaction failure rolls back and never commits", async () => {
  const harness = createHarness();
  await assert.rejects(
    createDailyGoalRepository(harness.prisma).withUserTransaction(USER, async (repository) => {
      await repository.createTrackingSession({ id: "tracking" });
      throw new Error("injected failure");
    }),
    /injected failure/,
  );
  assert.deepEqual(harness.calls.slice(-2).map((call) => call.kind), ["tracking.create", "rollback"]);
  assert.equal(harness.calls.some((call) => call.kind === "commit"), false);
});

test("retained repositories are inert after commit and rollback, with zero later delegate calls", async () => {
  const committed = createHarness();
  let committedRepository;
  const domainResult = await createDailyGoalRepository(committed.prisma).withUserTransaction(USER, async (repository) => {
    committedRepository = repository;
    return { status: "domain-result" };
  });
  assert.deepEqual(domainResult, { status: "domain-result" });
  const committedCount = committed.calls.length;
  assert.throws(() => committedRepository.findOwner(), /no longer active/);
  assert.equal(committed.calls.length, committedCount);

  const rolledBack = createHarness();
  let rolledBackRepository;
  await assert.rejects(
    createDailyGoalRepository(rolledBack.prisma).withUserTransaction(USER, async (repository) => {
      rolledBackRepository = repository;
      throw new Error("rollback");
    }),
    /rollback/,
  );
  const rolledBackCount = rolledBack.calls.length;
  assert.throws(() => rolledBackRepository.findOwner(), /no longer active/);
  assert.equal(rolledBack.calls.length, rolledBackCount);
});

test("direct repository or raw-transaction callback results are refused", async () => {
  const repositoryHarness = createHarness();
  await assert.rejects(
    createDailyGoalRepository(repositoryHarness.prisma).withUserTransaction(USER, async (repository) => repository),
    /cannot be returned/,
  );
  assert.equal(repositoryHarness.calls.at(-1).kind, "rollback");

  const transactionHarness = createHarness();
  await assert.rejects(
    createDailyGoalRepository(transactionHarness.prisma).withUserTransaction(USER, async () => transactionHarness.transaction),
    /cannot be returned/,
  );
  assert.equal(transactionHarness.calls.at(-1).kind, "rollback");
});

test("a uniqueness failure stays inside the USER transaction and rolls back atomically", async () => {
  const harness = createHarness({ failAt: "reward.create" });
  await assert.rejects(
    createDailyGoalRepository(harness.prisma).withUserTransaction(USER, async (repository) => {
      await repository.upsertDay(new Date("2026-10-26T00:00:00.000Z"), {
        create: { active_milliseconds: 1n }, update: { active_milliseconds: 1n },
      });
      await repository.createReward({
        activity_date: new Date("2026-10-26T00:00:00.000Z"),
        source_operation_id: "duplicate", xp_amount: 10,
      });
    }),
    /injected reward.create/,
  );
  assert.deepEqual(harness.calls.map((call) => call.kind), [
    "lock", "day.upsert", "reward.create", "rollback",
  ]);
});

for (const [candidate, expected] of [[0, 0], [100, 100], [101, "REFUSE"]]) {
  test(`cleanup boundary ${candidate} is bounded at 100`, async () => {
    const harness = createHarness({ cleanupRows: 150 });
    const operation = createDailyGoalRepository(harness.prisma).withCleanupTransaction((repository) => (
      repository.cleanupExpiredOperationalState({
        limit: candidate,
      })
    ));
    if (expected === "REFUSE") {
      await assert.rejects(operation, /0 through 100/);
      assert.deepEqual(harness.calls.map((call) => call.kind), ["lock", "rollback"]);
    } else {
      const result = await operation;
      assert.equal(result.receiptsDeleted, expected);
      if (candidate === 100) assert.equal(harness.calls.find((call) => call.kind === "receipt.findMany").args.take, DAILY_GOAL_CLEANUP_BATCH_LIMIT);
    }
  });
}

test("cleanup is lock-first and child-first; parent queries and deletes exclude receipts and owner pointers", async () => {
  const harness = createHarness({ cleanupRows: 2 });
  await createDailyGoalRepository(harness.prisma).withCleanupTransaction((repository) => (
    repository.cleanupExpiredOperationalState({
    })
  ));
  const kinds = harness.calls.map((call) => call.kind);
  assert.deepEqual(kinds, [
    "lock", "receipt.findMany", "receipt.deleteMany",
    "tracking.findMany", "tracking.deleteMany",
    "monitor.findMany", "monitor.deleteMany", "commit",
  ]);
  for (const kind of ["tracking.findMany", "tracking.deleteMany"]) {
    const where = harness.calls.find((call) => call.kind === kind).args.where;
    assert.equal(where.status, "CLOSED");
    assert.ok(where.closed_at.lt instanceof Date);
    assert.deepEqual(where.operation_receipts, { none: {} });
    assert.deepEqual(where.owner_records, { none: {} });
  }
  assert.deepEqual(
    harness.calls.find((call) => call.kind === "tracking.deleteMany").args.where.closed_at,
    harness.calls.find((call) => call.kind === "tracking.findMany").args.where.closed_at,
  );
  for (const kind of ["monitor.findMany", "monitor.deleteMany"]) {
    const where = harness.calls.find((call) => call.kind === kind).args.where;
    assert.ok(where.closed_at.lt instanceof Date);
    assert.deepEqual(where.operation_receipts, { none: {} });
  }
});

test("cleanup derives strict 30/31-day cutoffs once and retains rows exactly at each boundary", async () => {
  const evaluatedAt = new Date("2026-10-26T12:00:00.000Z");
  const receiptCutoff = new Date(evaluatedAt.getTime() - 30 * 86_400_000);
  const parentCutoff = new Date(evaluatedAt.getTime() - 31 * 86_400_000);
  const harness = createHarness({
    cleanupFixtures: {
      receipts: boundaryRows("operation_id", "receipt", receiptCutoff, "created_at"),
      tracking: boundaryRows("id", "tracking", parentCutoff, "closed_at"),
      monitors: boundaryRows("id", "monitor", parentCutoff, "closed_at"),
    },
  });
  const repository = createDailyGoalRepositoryForTest(harness.prisma, { now: () => evaluatedAt });
  const result = await repository.withCleanupTransaction((cleanup) => cleanup.cleanupExpiredOperationalState());
  assert.deepEqual(result, { receiptsDeleted: 1, trackingSessionsDeleted: 1, monitorSessionsDeleted: 1 });
  assert.deepEqual(harness.calls.find((call) => call.kind === "receipt.findMany").args.where.created_at, { lt: receiptCutoff });
  assert.deepEqual(harness.calls.find((call) => call.kind === "tracking.findMany").args.where.closed_at, { lt: parentCutoff });
  assert.deepEqual(harness.calls.find((call) => call.kind === "monitor.findMany").args.where.closed_at, { lt: parentCutoff });
});

test("parent delete rechecks status, cutoff, receipts and owner after selection", async () => {
  const evaluatedAt = new Date("2026-10-26T12:00:00.000Z");
  const parentCutoff = new Date(evaluatedAt.getTime() - 31 * 86_400_000);
  const harness = createHarness({ cleanupRows: 1, parentEligibilityChangesAfterSelection: true });
  const result = await createDailyGoalRepositoryForTest(harness.prisma, { now: () => evaluatedAt })
    .withCleanupTransaction((cleanup) => cleanup.cleanupExpiredOperationalState());
  assert.deepEqual(result, { receiptsDeleted: 1, trackingSessionsDeleted: 0, monitorSessionsDeleted: 0 });
  assert.deepEqual(harness.calls.find((call) => call.kind === "tracking.deleteMany").args.where, {
    id: { in: ["tracking-0"] }, status: "CLOSED", closed_at: { lt: parentCutoff },
    operation_receipts: { none: {} }, owner_records: { none: {} },
  });
  assert.deepEqual(harness.calls.find((call) => call.kind === "monitor.deleteMany").args.where, {
    id: { in: ["monitor-0"] }, closed_at: { lt: parentCutoff }, operation_receipts: { none: {} },
  });
});

test("cleanup failure rolls back the same transaction", async () => {
  const harness = createHarness({ cleanupRows: 1, failAt: "tracking.deleteMany" });
  await assert.rejects(
    createDailyGoalRepository(harness.prisma).withCleanupTransaction((repository) => (
      repository.cleanupExpiredOperationalState()
    )),
    /injected tracking.deleteMany/,
  );
  assert.equal(harness.calls.at(-1).kind, "rollback");
  assert.equal(harness.calls.some((call) => call.kind === "monitor.deleteMany"), false);
});

function createHarness({
  failLock = false,
  receipt = null,
  cleanupRows = 0,
  cleanupFixtures = null,
  parentEligibilityChangesAfterSelection = false,
  failAt = null,
} = {}) {
  const calls = [];
  const record = (kind, result) => async (args) => {
    calls.push({ kind, args });
    if (kind === failAt) throw new Error(`injected ${kind}`);
    return typeof result === "function" ? result(args) : result;
  };
  const delegate = (prefix, overrides = {}) => ({
    findUnique: record(`${prefix}.findUnique`, null),
    findFirst: record(`${prefix}.findFirst`, null),
    findMany: record(`${prefix}.findMany`, []),
    create: record(`${prefix}.create`, ({ data }) => data),
    upsert: record(`${prefix}.upsert`, ({ create }) => create),
    update: record(`${prefix}.update`, ({ data }) => data),
    updateMany: record(`${prefix}.updateMany`, { count: 1 }),
    deleteMany: record(`${prefix}.deleteMany`, ({ where }) => ({
      count: Object.values(where).find((value) => value?.in)?.in.length ?? 1,
    })),
    count: record(`${prefix}.count`, 0),
    ...overrides,
  });
  const ids = (field, prefix, fixtureKey, timeField) => ({ take, where }) => {
    if (cleanupFixtures) {
      return cleanupFixtures[fixtureKey]
        .filter((row) => row[timeField] < where[timeField].lt)
        .slice(0, take)
        .map((row) => ({ [field]: row[field] }));
    }
    return Array.from(
      { length: Math.min(cleanupRows, take) },
      (_, index) => ({ [field]: `${prefix}-${index}` }),
    );
  };
  const transaction = {
    $queryRaw(strings, ...values) {
      calls.push({ kind: "lock", sql: String.raw({ raw: strings }, ...values), values });
      if (failLock) return Promise.reject(new Error("lock failed"));
      return Promise.resolve([{ lock_result: null }]);
    },
    dAILY_GOAL_OWNER: delegate("owner"),
    dAILY_GOAL_TRACKING_SESSION: delegate("tracking", {
      findMany: record("tracking.findMany", ids("id", "tracking", "tracking", "closed_at")),
      ...(parentEligibilityChangesAfterSelection
        ? { deleteMany: record("tracking.deleteMany", { count: 0 }) }
        : {}),
    }),
    dAILY_GOAL_OPERATION_RECEIPT: delegate("receipt", {
      findFirst: record("receipt.findFirst", receipt),
      findMany: record("receipt.findMany", ids("operation_id", "receipt", "receipts", "created_at")),
    }),
    dAILY_GOAL_DAY: delegate("day"),
    dAILY_GOAL_REWARD: delegate("reward"),
    uSER: delegate("user"),
    dAILY_GOAL_MONITOR_SESSION: delegate("monitor", {
      findMany: record("monitor.findMany", ids("id", "monitor", "monitors", "closed_at")),
      ...(parentEligibilityChangesAfterSelection
        ? { deleteMany: record("monitor.deleteMany", { count: 0 }) }
        : {}),
    }),
    uSER_NOTIFICATION: delegate("notification"),
    lEARNING_SESSION: delegate("learning-session"),
    vOCABULARY_SET: delegate("set"),
  };
  const prisma = {
    async $transaction(callback) {
      try {
        const result = await callback(transaction);
        calls.push({ kind: "commit" });
        return result;
      } catch (error) {
        calls.push({ kind: "rollback" });
        throw error;
      }
    },
  };
  return { prisma, transaction, calls };
}

function boundaryRows(idField, prefix, cutoff, timeField) {
  return [-1, 0, 1].map((offset, index) => ({
    [idField]: `${prefix}-${index}`,
    [timeField]: new Date(cutoff.getTime() + offset),
  }));
}
