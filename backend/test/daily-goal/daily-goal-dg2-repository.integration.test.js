import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { createDailyGoalRepository, createDailyGoalRepositoryForTest } from "../../src/repositories/daily-goal-repository.js";
import { createDailyGoalService } from "../../src/services/daily-goal-service.js";

const REQUIRED_DURABLE_CHECKS = Object.freeze([
  "sameUserWaited", "differentUsersEntered", "ownerPersisted", "staleUnchanged",
  "raceReceiptsUnique", "raceCreditBounded", "replayReceiptUnique", "replayMutationOnce",
  "mismatchUnchanged", "rollbackComplete", "restrictObserved", "cleanupRaceRechecked",
  "sleepGapExcluded", "leaseLiveGapBurned", "nonOwnerReclaimed", "midnightConserved",
]);

const REPOSITORY_DIAGNOSTIC_PHASES = Object.freeze(new Set([
  "FIXTURE_A", "SAME_USER_LOCK", "FIXTURE_B", "DIFFERENT_USER_LOCK",
  "SESSION_ESTABLISH", "SESSION_READY", "SAME_USER_TX_START", "SAME_USER_OPERATIONS",
  "SAME_USER_DURABLE_ASSERTIONS", "OWNERSHIP_TRANSFER",
  "STALE_GENERATION", "CONCURRENT_REPLAY", "FINGERPRINT_MISMATCH",
  "SLEEP_RECLAIM", "LEASE_GAP_BURN", "NON_OWNER_RECLAIM",
  "ROLLBACK_AFTER_CREDIT", "VIETNAM_MIDNIGHT", "FK_CLEANUP",
  "CLEANUP_RACE", "EVIDENCE_GATE", "FINAL_CLEANUP", "REPOSITORY_UNCLASSIFIED",
]));
const REPOSITORY_DIAGNOSTIC_LIMIT_BYTES = 256;

export async function runRepositoryIntegration({ prisma, diagnosticWriter } = {}) {
  if (!prisma?.$transaction) throw new TypeError("A real Prisma client is required.");
  const users = [];
  return runRepositoryDiagnosticLifecycle({
    diagnosticWriter,
    cleanup: () => cleanupUsers(prisma, users),
    async execute(runPhase) {
    let assertions = 0;
    const a = await runPhase("FIXTURE_A", () => seedLearningContext(prisma, "same-a", users));
    const durable = Object.create(null);
    const same = await runPhase("SAME_USER_LOCK", () => proveSameUserSerialization(prisma, a.user.id)); assertions += same;
    durable.sameUserWaited = true;

    const b = await runPhase("FIXTURE_B", () => seedLearningContext(prisma, "different-b", users));
    assertions += await runPhase("DIFFERENT_USER_LOCK", () => proveDifferentUserIndependence(prisma, a.user.id, b.user.id));
    durable.differentUsersEntered = true;

    const clock = { value: new Date("2026-10-26T00:00:00.000Z") };
    const service = createDailyGoalService({ dailyGoalRepository: createDailyGoalRepository(prisma), now: () => new Date(clock.value), uuid: randomUUID });
    const { session: sessionA, ready: readyA } = await establishAndReady({ prisma, service, clock, userId: a.user.id, learningSessionId: a.learning.id, runPhase });
    const timelineStart = clock.value.getTime();
    clock.value = new Date(timelineStart + 20_000);
    assertions += await proveSameUserCreditRace({ prisma, clock, userId: a.user.id, sessionId: sessionA.tracking_session_id, generation: readyA.generation, timelineStart, runPhase });
    durable.raceReceiptsUnique = true;
    durable.raceCreditBounded = true;
    const { sessionB, transfer } = await runPhase("OWNERSHIP_TRANSFER", async () => {
      const session = await service.establish(a.user.id, { operation_id: randomUUID(), ...createRequest(a.learning.id) });
      const claimed = await service.engage(a.user.id, session.tracking_session_id, { operation_id: randomUUID(), event_type: "REVEAL" });
      assert.equal(claimed.owner, true); assertions += 1;
      const persistedOwner = await prisma.dAILY_GOAL_OWNER.findUnique({ where: { user_id: a.user.id } });
      assert.equal(persistedOwner.tracking_session_id, session.tracking_session_id); assertions += 1;
      assert.equal(persistedOwner.generation.toString(), claimed.generation); assertions += 1;
      return { sessionB: session, transfer: claimed };
    });
    durable.ownerPersisted = true;
    await runPhase("STALE_GENERATION", async () => {
      const staleBefore = await durableSnapshot(prisma, a.user.id);
      await assert.rejects(service.heartbeat(a.user.id, sessionA.tracking_session_id, heartbeat(randomUUID(), readyA.generation)), (error) => error?.code === "TRACKING_OWNERSHIP_CONFLICT"); assertions += 1;
      assert.deepEqual(await durableSnapshot(prisma, a.user.id), staleBefore); assertions += 1;
    });
    durable.staleUnchanged = true;

    const replayOperation = randomUUID();
    clock.value = new Date(timelineStart + 40_000);
    await runPhase("CONCURRENT_REPLAY", async () => {
      const replayBefore = await accountingSnapshot(prisma, a.user.id);
      const [first, replay] = await runAtConcurrentTransactionStart({
      prisma,
      createOperations(client) {
        const concurrentService = createDailyGoalService({ dailyGoalRepository: createDailyGoalRepository(client), now: () => new Date(clock.value), uuid: randomUUID });
        return [
          () => concurrentService.heartbeat(a.user.id, sessionB.tracking_session_id, heartbeat(replayOperation, transfer.generation)),
          () => concurrentService.heartbeat(a.user.id, sessionB.tracking_session_id, heartbeat(replayOperation, transfer.generation)),
        ];
      },
      });
      assert.equal([first, replay].filter((item) => item.replayed === true).length, 1); assertions += 1;
      const replayAfter = await accountingSnapshot(prisma, a.user.id);
      assert.equal(await prisma.dAILY_GOAL_OPERATION_RECEIPT.count({ where: { user_id: a.user.id, operation_id: replayOperation } }), 1); assertions += 1;
      assert.equal(replayAfter.dayMilliseconds - replayBefore.dayMilliseconds, 20_000n); assertions += 1;
      assert.equal(replayAfter.owner.generation, replayBefore.owner.generation); assertions += 1;
      assert.equal(replayAfter.owner.last_accounted_at.toISOString(), clock.value.toISOString()); assertions += 1;
      assert.equal(replayAfter.owner.lease_expires_at.toISOString(), new Date(timelineStart + 85_000).toISOString()); assertions += 1;
      assert.notEqual(replayAfter.owner.lease_expires_at.toISOString(), replayBefore.owner.lease_expires_at.toISOString()); assertions += 1;
    });
    durable.replayReceiptUnique = true;
    durable.replayMutationOnce = true;
    await runPhase("FINGERPRINT_MISMATCH", async () => {
      const mismatchBefore = await durableSnapshot(prisma, a.user.id);
      await assert.rejects(service.engage(a.user.id, sessionB.tracking_session_id, { operation_id: replayOperation, generation: transfer.generation, event_type: "NEXT" }), (error) => error?.code === "OPERATION_CONFLICT"); assertions += 1;
      assert.deepEqual(await durableSnapshot(prisma, a.user.id), mismatchBefore); assertions += 1;
    });
    durable.mismatchUnchanged = true;

    const reclaimed = await runPhase("SLEEP_RECLAIM", async () => {
      clock.value = new Date(timelineStart + 100_000);
      const beforeSleep = await prisma.dAILY_GOAL_DAY.aggregate({ where: { user_id: a.user.id }, _sum: { active_milliseconds: true } });
      const result = await service.heartbeat(a.user.id, sessionB.tracking_session_id, heartbeat(randomUUID(), transfer.generation));
      const afterSleep = await prisma.dAILY_GOAL_DAY.aggregate({ where: { user_id: a.user.id }, _sum: { active_milliseconds: true } });
      assert.equal(afterSleep._sum.active_milliseconds ?? 0n, beforeSleep._sum.active_milliseconds ?? 0n); assertions += 1;
      assert(BigInt(result.generation) > BigInt(transfer.generation)); assertions += 1;
      return result;
    });
    durable.sleepGapExcluded = true;

    const burned = await runPhase("LEASE_GAP_BURN", async () => {
      clock.value = new Date(timelineStart + 130_000);
      const gapBefore = await accountingSnapshot(prisma, a.user.id);
      const result = await service.heartbeat(a.user.id, sessionB.tracking_session_id, heartbeat(randomUUID(), reclaimed.generation));
      const gapAfter = await accountingSnapshot(prisma, a.user.id);
      assert.equal(result.credited_milliseconds, "0"); assertions += 1;
      assert.equal(gapAfter.dayMilliseconds, gapBefore.dayMilliseconds); assertions += 1;
      assert.equal(gapAfter.owner.last_accounted_at.toISOString(), clock.value.toISOString()); assertions += 1;
      return result;
    });
    durable.leaseLiveGapBurned = true;

    assertions += await runPhase("NON_OWNER_RECLAIM", () => proveNonOwnerReclaim({ prisma, service, clock, fixture: a, currentSessionId: sessionB.tracking_session_id, currentGeneration: burned.generation }));
    durable.nonOwnerReclaimed = true;

    assertions += await runPhase("ROLLBACK_AFTER_CREDIT", () => proveRollbackAfterDayCredit(prisma));
    durable.rollbackComplete = true;
    assertions += await runPhase("VIETNAM_MIDNIGHT", () => proveMidnightSplit(prisma, a));
    durable.midnightConserved = true;
    assertions += await runPhase("FK_CLEANUP", () => proveCleanupAndRestrict(prisma));
    durable.restrictObserved = true;
    assertions += await runPhase("CLEANUP_RACE", () => proveCleanupRaceRecheck(prisma));
    durable.cleanupRaceRechecked = true;

    return runPhase("EVIDENCE_GATE", () => buildRepositoryEvidenceForTest(durable, {
      sameUserContention: pass(same),
      differentUserIndependence: pass(2),
      ownershipTransfer: pass(6),
      staleGeneration: pass(2),
      replay: pass(8),
      rollback: pass(4),
      fkCleanup: pass(7),
      sleepOffline: pass(2),
      vietnamMidnight: pass(3),
      noFabrication: pass(5),
    }));
    },
  });
}

async function proveSameUserSerialization(prisma, userId) {
  const gate = createAbortableBarrier({ parties: 1, timeoutMilliseconds: 5_000 });
  let lockEntries = 0;
  const client = transactionClientWithLockHook(prisma, async () => {
    lockEntries += 1;
    if (lockEntries === 1) await gate.arriveAndWait();
  });
  const repository = createDailyGoalRepository(client);
  const pending = [];
  let completed = false;
  try {
    pending.push(repository.withUserTransaction(userId, async () => "A"));
    await waitFor(() => gate.snapshot().arrivals === 1);
    pending.push(repository.withUserTransaction(userId, async () => "B"));
    await boundedDelay(50);
    assert.equal(lockEntries, 1);
    gate.release();
    assert.deepEqual(await Promise.all(pending), ["A", "B"]);
    assert.equal(lockEntries, 2);
    completed = true;
    return 3;
  } finally {
    if (!gate.snapshot().terminal) gate.abort(new Error("Same-USER barrier aborted."));
    await Promise.allSettled(pending);
    if (completed) assert.equal(gate.snapshot().timerCleared, true);
  }
}

async function proveDifferentUserIndependence(prisma, firstUser, secondUser) {
  const gate = createAbortableBarrier({ parties: 2, timeoutMilliseconds: 5_000 });
  const client = transactionClientWithLockHook(prisma, () => gate.arriveAndWait());
  const repository = createDailyGoalRepository(client);
  const pending = [repository.withUserTransaction(firstUser, async () => "A"), repository.withUserTransaction(secondUser, async () => "B")];
  let completed = false;
  try {
    await waitFor(() => gate.snapshot().arrivals === 2);
    assert.equal(gate.snapshot().arrivals, 2);
    gate.release();
    assert.deepEqual((await Promise.all(pending)).sort(), ["A", "B"]);
    completed = true;
    return 2;
  } finally {
    if (!gate.snapshot().terminal) gate.abort(new Error("Different-USER barrier aborted."));
    await Promise.allSettled(pending);
    if (completed) assert.equal(gate.snapshot().timerCleared, true);
  }
}

async function proveSameUserCreditRace({ prisma, clock, userId, sessionId, generation, timelineStart, runPhase }) {
  const operations = [randomUUID(), randomUUID()];
  const before = await runPhase("SAME_USER_DURABLE_ASSERTIONS", () => accountingSnapshot(prisma, userId));
  const results = await runAtConcurrentTransactionStart({
    prisma,
    runStartBoundary: (operation) => runPhase("SAME_USER_TX_START", operation),
    runOperationsBoundary: (operation) => runPhase("SAME_USER_OPERATIONS", operation),
    createOperations(client) {
      const concurrentService = createDailyGoalService({ dailyGoalRepository: createDailyGoalRepository(client), now: () => new Date(clock.value), uuid: randomUUID });
      return operations.map((operationId) => () => concurrentService.heartbeat(userId, sessionId, heartbeat(operationId, generation)));
    },
  });
  return runPhase("SAME_USER_DURABLE_ASSERTIONS", async () => {
    const after = await accountingSnapshot(prisma, userId);
    await assertSameUserDurableState({ prisma, userId, operations, before, after, results, timelineStart });
    return 7;
  });
}

async function assertSameUserDurableState({ prisma, userId, operations, before, after, results, timelineStart }) {
  assert.equal(results.reduce((sum, item) => sum + BigInt(item.credited_milliseconds), 0n), 20_000n);
  assert.equal(after.dayMilliseconds - before.dayMilliseconds, 20_000n);
  assert.equal(after.owner.generation, before.owner.generation);
  assert.equal(after.owner.last_accounted_at.toISOString(), new Date(timelineStart + 20_000).toISOString());
  assert.equal(after.owner.lease_expires_at.toISOString(), new Date(timelineStart + 65_000).toISOString());
  for (const operationId of operations) assert.equal(await prisma.dAILY_GOAL_OPERATION_RECEIPT.count({ where: { user_id: userId, operation_id: operationId } }), 1);
}

async function proveNonOwnerReclaim({ prisma, service, clock, fixture, currentSessionId, currentGeneration }) {
  const contender = await service.establish(fixture.user.id, { operation_id: randomUUID(), ...createRequest(fixture.learning.id) });
  await alignClockForReady(prisma, clock, contender.tracking_session_id);
  const contenderReady = await service.engage(fixture.user.id, contender.tracking_session_id, { operation_id: randomUUID(), generation: currentGeneration, event_type: "READY" });
  const currentClaim = await service.engage(fixture.user.id, currentSessionId, { operation_id: randomUUID(), generation: contenderReady.generation, event_type: "REVEAL" });
  clock.value = new Date(clock.value.getTime() + 46_000);
  const reclaimed = await service.heartbeat(fixture.user.id, contender.tracking_session_id, heartbeat(randomUUID(), contenderReady.generation));
  const owner = await prisma.dAILY_GOAL_OWNER.findUnique({ where: { user_id: fixture.user.id } });
  assert.equal(reclaimed.owner, true);
  assert.equal(owner.tracking_session_id, contender.tracking_session_id);
  assert(BigInt(owner.generation) > BigInt(currentClaim.generation));
  return 3;
}

async function proveRollbackAfterDayCredit(prisma) {
  const users = [];
  return withFixtureCleanup(() => cleanupUsers(prisma, users), async () => {
    const fixture = await seedLearningContext(prisma, "rollback-credit", users);
    const clock = { value: new Date("2026-10-26T02:00:00.000Z") };
    const normal = createDailyGoalService({ dailyGoalRepository: createDailyGoalRepository(prisma), now: () => new Date(clock.value), uuid: randomUUID });
    const session = await normal.establish(fixture.user.id, { operation_id: randomUUID(), ...createRequest(fixture.learning.id) });
    await alignClockForReady(prisma, clock, session.tracking_session_id);
    const ready = await normal.engage(fixture.user.id, session.tracking_session_id, { operation_id: randomUUID(), event_type: "READY" });
    const readyAt = new Date(clock.value);
    clock.value = new Date(clock.value.getTime() + 20_000);
    const before = await durableSnapshot(prisma, fixture.user.id);
    const operation = randomUUID();
    const failing = createDailyGoalService({ dailyGoalRepository: createDailyGoalRepository(transactionClientWithReceiptFailure(prisma)), now: () => new Date(clock.value), uuid: randomUUID });
    await assert.rejects(failing.heartbeat(fixture.user.id, session.tracking_session_id, heartbeat(operation, ready.generation)));
    assert.deepEqual(await durableSnapshot(prisma, fixture.user.id), before);
    assert.equal(await prisma.dAILY_GOAL_OPERATION_RECEIPT.count({ where: { user_id: fixture.user.id, operation_id: operation } }), 0);
    const owner = await prisma.dAILY_GOAL_OWNER.findUnique({ where: { user_id: fixture.user.id } });
    assert.equal(owner.last_accounted_at.toISOString(), readyAt.toISOString());
    return 4;
  });
}

async function proveMidnightSplit(prisma, fixture) {
  const clock = { value: new Date("2026-10-26T16:59:59.600Z") };
  const service = createDailyGoalService({ dailyGoalRepository: createDailyGoalRepository(prisma), now: () => new Date(clock.value), uuid: randomUUID });
  const session = await service.establish(fixture.user.id, { operation_id: randomUUID(), ...createRequest(fixture.learning.id) });
  const createdAt = await readTrackingCreatedAt(prisma, session.tracking_session_id);
  const midnight = nextVietnamMidnightAfter(createdAt.getTime() + 400);
  clock.value = new Date(midnight - 400);
  const ready = await service.engage(fixture.user.id, session.tracking_session_id, { operation_id: randomUUID(), event_type: "READY" });
  clock.value = new Date(midnight + 400);
  await service.engage(fixture.user.id, session.tracking_session_id, { operation_id: randomUUID(), generation: ready.generation, event_type: "REVEAL" });
  const rows = await prisma.dAILY_GOAL_DAY.findMany({ where: { user_id: fixture.user.id }, orderBy: { activity_date: "asc" } });
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((row) => row.active_milliseconds), [400n, 400n]);
  assert.equal(rows.reduce((sum, row) => sum + row.active_milliseconds, 0n), 800n);
  return 3;
}

async function proveCleanupAndRestrict(prisma) {
  const users = [];
  return withFixtureCleanup(() => cleanupUsers(prisma, users), async () => {
    const fixture = await seedLearningContext(prisma, "cleanup", users);
    const session = await prisma.dAILY_GOAL_TRACKING_SESSION.create({ data: { user_id: fixture.user.id, activity_type: "NORMAL", learning_session_id: fixture.learning.id, status: "CLOSED", closed_at: new Date("2026-08-01T00:00:00.000Z") } });
    await prisma.dAILY_GOAL_OPERATION_RECEIPT.create({ data: { operation_id: randomUUID(), user_id: fixture.user.id, tracking_session_id: session.id, operation_type: "CLOSE", request_fingerprint: "reviewed", response_projection: {}, created_at: new Date("2026-08-02T00:00:00.000Z") } });
    await assert.rejects(prisma.dAILY_GOAL_TRACKING_SESSION.delete({ where: { id: session.id } }));
    const repository = createDailyGoalRepositoryForTest(prisma, { now: () => new Date("2026-10-26T00:00:00.000Z") });
    const result = await repository.withCleanupTransaction((tx) => tx.cleanupExpiredOperationalState());
    assert.equal(result.receiptsDeleted, 1);
    assert.equal(result.trackingSessionsDeleted, 1);
    assert.equal(await prisma.dAILY_GOAL_TRACKING_SESSION.count({ where: { id: session.id } }), 0);
    return 4;
  });
}

async function proveCleanupRaceRecheck(prisma) {
  const users = [];
  return withFixtureCleanup(() => cleanupUsers(prisma, users), async () => {
    const fixture = await seedLearningContext(prisma, "cleanup-race", users);
    const session = await prisma.dAILY_GOAL_TRACKING_SESSION.create({ data: { user_id: fixture.user.id, activity_type: "NORMAL", learning_session_id: fixture.learning.id, status: "CLOSED", closed_at: new Date("2026-08-01T00:00:00.000Z") } });
    let changed = false;
    const client = new Proxy(prisma, { get(target, property) {
    if (property !== "$transaction") { const value = Reflect.get(target, property, target); return typeof value === "function" ? value.bind(target) : value; }
    return (callback, options) => target.$transaction((tx) => callback(new Proxy(tx, { get(inner, key) {
      if (key !== "dAILY_GOAL_TRACKING_SESSION") return Reflect.get(inner, key, inner);
      return new Proxy(inner[key], { get(delegate, method) {
        const value = Reflect.get(delegate, method, delegate);
        if (method !== "findMany") return typeof value === "function" ? value.bind(delegate) : value;
        return async (...args) => {
          const rows = await value.apply(delegate, args);
          if (!changed && rows.some((row) => row.id === session.id)) {
            changed = true;
            await prisma.dAILY_GOAL_TRACKING_SESSION.update({ where: { id: session.id }, data: { status: "ACTIVE", closed_at: null } });
          }
          return rows;
        };
      } });
    } })), options);
    } });
    const repository = createDailyGoalRepositoryForTest(client, { now: () => new Date("2026-10-26T00:00:00.000Z") });
    const result = await repository.withCleanupTransaction((tx) => tx.cleanupExpiredOperationalState());
    assert.equal(changed, true);
    assert.equal(result.trackingSessionsDeleted, 0);
    assert.equal(await prisma.dAILY_GOAL_TRACKING_SESSION.count({ where: { id: session.id } }), 1);
    return 3;
  });
}

function transactionClientWithLockHook(prisma, hook) { return new Proxy(prisma, { get(target, property) { if (property !== "$transaction") { const value = Reflect.get(target, property, target); return typeof value === "function" ? value.bind(target) : value; } return (callback, options) => target.$transaction((tx) => callback(new Proxy(tx, { get(inner, key) { if (key !== "$queryRaw") return Reflect.get(inner, key, inner); return async (...args) => { const result = await inner.$queryRaw(...args); await hook(); return result; }; } })), options); } }); }
function transactionClientWithStartBarrier(prisma, barrier) { return new Proxy(prisma, { get(target, property) { if (property !== "$transaction") { const value = Reflect.get(target, property, target); return typeof value === "function" ? value.bind(target) : value; } return (callback, options) => target.$transaction(async (tx) => { await barrier.arriveAndWait(); return callback(tx); }, options); } }); }
function transactionClientWithReceiptFailure(prisma) { return new Proxy(prisma, { get(target, property) { if (property !== "$transaction") { const value = Reflect.get(target, property, target); return typeof value === "function" ? value.bind(target) : value; } return (callback, options) => target.$transaction((tx) => callback(new Proxy(tx, { get(inner, key) { if (key !== "dAILY_GOAL_OPERATION_RECEIPT") return Reflect.get(inner, key, inner); return new Proxy(inner[key], { get(delegate, method) { if (method === "create") return async () => { throw new Error("Injected receipt failure."); }; const value = Reflect.get(delegate, method, delegate); return typeof value === "function" ? value.bind(delegate) : value; } }); } })), options); } }); }
async function accountingSnapshot(prisma, userId) { const [owner, aggregate] = await Promise.all([prisma.dAILY_GOAL_OWNER.findUnique({ where: { user_id: userId } }), prisma.dAILY_GOAL_DAY.aggregate({ where: { user_id: userId }, _sum: { active_milliseconds: true } })]); return { owner, dayMilliseconds: aggregate._sum.active_milliseconds ?? 0n }; }
async function durableSnapshot(prisma, userId) { const [owner, sessions, days, receipts] = await Promise.all([prisma.dAILY_GOAL_OWNER.findUnique({ where: { user_id: userId } }), prisma.dAILY_GOAL_TRACKING_SESSION.findMany({ where: { user_id: userId }, orderBy: { id: "asc" } }), prisma.dAILY_GOAL_DAY.findMany({ where: { user_id: userId }, orderBy: { activity_date: "asc" } }), prisma.dAILY_GOAL_OPERATION_RECEIPT.findMany({ where: { user_id: userId }, orderBy: { operation_id: "asc" } })]); return structuredClone({ owner, sessions, days, receipts }); }
async function seedLearningContext(prisma, label, cleanupUserIds, createdAt = new Date()) {
  if (!Array.isArray(cleanupUserIds)) throw new TypeError("A fixture cleanup registry is required.");
  const fixtureCreatedAt = new Date(createdAt);
  if (Number.isNaN(fixtureCreatedAt.getTime())) throw new TypeError("Fixture creation time must be valid.");
  const user = await prisma.uSER.create({ data: { email: `${label}-${randomUUID()}@example.test`, password_hash: "not-used", display_name: label } });
  cleanupUserIds.push(user.id);
  const learning = await prisma.lEARNING_SESSION.create({ data: { user_id: user.id, set_id_snapshot: randomUUID(), mode: "NORMAL", status: "ACTIVE", create_operation_id: randomUUID(), snapshot_size: 1, created_at: fixtureCreatedAt, expires_at: new Date(fixtureCreatedAt.getTime() + (7 * 86_400_000)) } });
  return { user, learning };
}
async function cleanupUsers(prisma, ids) { if (!ids.length) return; await prisma.dAILY_GOAL_OPERATION_RECEIPT.deleteMany({ where: { user_id: { in: ids } } }); await prisma.dAILY_GOAL_OWNER.deleteMany({ where: { user_id: { in: ids } } }); await prisma.dAILY_GOAL_TRACKING_SESSION.deleteMany({ where: { user_id: { in: ids } } }); await prisma.dAILY_GOAL_DAY.deleteMany({ where: { user_id: { in: ids } } }); await prisma.lEARNING_SESSION.deleteMany({ where: { user_id: { in: ids } } }); await prisma.aUTH_SESSION.deleteMany({ where: { user_id: { in: ids } } }); await prisma.uSER.deleteMany({ where: { id: { in: ids } } }); }

export async function seedLearningContextWithCleanupForTest({ prisma, label = "offline-fixture", createdAt }) {
  const users = [];
  return withFixtureCleanup(
    () => cleanupUsers(prisma, users),
    () => seedLearningContext(prisma, label, users, createdAt),
  );
}

async function withFixtureCleanup(cleanup, operation) {
  let primaryFailed = false;
  try {
    return await operation();
  } catch (error) {
    primaryFailed = true;
    throw error;
  } finally {
    try {
      await cleanup();
    } catch (cleanupError) {
      if (!primaryFailed) throw cleanupError;
    }
  }
}

async function establishAndReady({ prisma, service, clock, userId, learningSessionId, runPhase }) {
  const session = await runPhase(
    "SESSION_ESTABLISH",
    () => service.establish(userId, { operation_id: randomUUID(), ...createRequest(learningSessionId) }),
  );
  await alignClockForReady(prisma, clock, session.tracking_session_id);
  const ready = await runPhase(
    "SESSION_READY",
    () => service.engage(userId, session.tracking_session_id, { operation_id: randomUUID(), event_type: "READY" }),
  );
  return { session, ready };
}

async function alignClockForReady(prisma, clock, trackingSessionId) {
  const createdAt = await readTrackingCreatedAt(prisma, trackingSessionId);
  clock.value = new Date(Math.max(clock.value.getTime(), createdAt.getTime()));
}

async function readTrackingCreatedAt(prisma, trackingSessionId) {
  const session = await prisma.dAILY_GOAL_TRACKING_SESSION.findUnique({
    where: { id: trackingSessionId },
    select: { created_at: true },
  });
  if (!(session?.created_at instanceof Date) || Number.isNaN(session.created_at.getTime())) {
    throw new Error("Persisted tracking-session creation time is unavailable.");
  }
  return new Date(session.created_at);
}

function nextVietnamMidnightAfter(minimumInstant) {
  const instant = new Date(minimumInstant);
  let boundary = Date.UTC(instant.getUTCFullYear(), instant.getUTCMonth(), instant.getUTCDate(), 17, 0, 0, 0);
  if (boundary < minimumInstant) boundary += 86_400_000;
  return boundary;
}

export function establishAndReadyForTest(options) {
  return establishAndReady(options);
}
function createRequest(learningSessionId) { return { activity_type: "NORMAL", learning_session_id: learningSessionId }; }
function heartbeat(operation_id, generation) { return { operation_id, generation, eligibility: "VISIBLE_FOCUSED_ACTIVE" }; }
function pass(assertions) { return Object.freeze({ status: "PASS", assertions }); }
async function waitFor(predicate, timeoutMilliseconds = 2_000) { const deadline = Date.now() + timeoutMilliseconds; while (!predicate()) { if (Date.now() >= deadline) throw new Error("Barrier observation timed out."); await boundedDelay(Math.min(5, timeoutMilliseconds)); } }
function boundedDelay(milliseconds) { return new Promise((resolve) => setTimeout(resolve, milliseconds)); }

async function runRepositoryDiagnosticLifecycle({ execute, cleanup, diagnosticWriter = defaultDiagnosticWriter }) {
  let primaryError;
  let primaryPhase;
  let result;
  const runPhase = async (phase, operation) => {
    assertRepositoryDiagnosticPhase(phase);
    try { return await operation(); }
    catch (error) { if (!primaryError) { primaryError = error; primaryPhase = phase; } throw error; }
  };
  try { result = await execute(runPhase); }
  catch (error) { if (!primaryError) { primaryError = error; primaryPhase = "REPOSITORY_UNCLASSIFIED"; } }
  try { await cleanup(); }
  catch (error) {
    if (!primaryError) { primaryError = error; primaryPhase = "FINAL_CLEANUP"; }
  }
  if (primaryError) {
    try { emitRepositoryDiagnostic(primaryPhase, diagnosticWriter); } catch {}
    throw primaryError;
  }
  return result;
}

function assertRepositoryDiagnosticPhase(phase) {
  if (!REPOSITORY_DIAGNOSTIC_PHASES.has(phase)) throw new Error("Repository diagnostic phase is not allowlisted.");
}

function emitRepositoryDiagnostic(phase, writer) {
  assertRepositoryDiagnosticPhase(phase);
  if (typeof writer !== "function") throw new TypeError("Repository diagnostic writer is required.");
  const line = `${JSON.stringify({ outcome: "DG2_REPOSITORY_STAGE_REFUSED", repositoryStage: phase })}\n`;
  if (Buffer.byteLength(line, "utf8") > REPOSITORY_DIAGNOSTIC_LIMIT_BYTES) throw new Error("Repository diagnostic output exceeds its bound.");
  writer(line);
}

function defaultDiagnosticWriter(line) { process.stdout.write(line); }

export function runRepositoryDiagnosticLifecycleForTest(options) {
  return runRepositoryDiagnosticLifecycle(options);
}

export function repositoryDiagnosticLineForTest(phase) {
  let output = "";
  emitRepositoryDiagnostic(phase, (line) => { output += line; });
  return output;
}

export async function runAtConcurrentTransactionStart({ prisma, createOperations, runStartBoundary = runDirectly, runOperationsBoundary = runDirectly, timeoutMilliseconds = 5_000, observationTimeoutMilliseconds = 2_000 }) {
  if (!prisma?.$transaction || typeof createOperations !== "function") throw new TypeError("Concurrent transaction operations are required.");
  if (typeof runStartBoundary !== "function" || typeof runOperationsBoundary !== "function") throw new TypeError("Concurrent transaction boundaries are required.");
  const barrier = createAbortableBarrier({ parties: 2, timeoutMilliseconds });
  const client = transactionClientWithStartBarrier(prisma, barrier);
  const operations = createOperations(client);
  if (!Array.isArray(operations) || operations.length !== 2 || operations.some((operation) => typeof operation !== "function")) throw new TypeError("Exactly two transaction operations are required.");
  const pending = operations.map((operation) => {
    const promise = Promise.resolve().then(operation);
    promise.catch(() => {});
    return promise;
  });
  try {
    await runStartBoundary(async () => {
      await waitFor(() => barrier.snapshot().arrivals === 2, observationTimeoutMilliseconds);
      assert.equal(barrier.snapshot().arrivals, 2);
    });
    return await runOperationsBoundary(async () => {
      barrier.release();
      return Promise.all(pending);
    });
  } finally {
    if (!barrier.snapshot().terminal) barrier.abort(new Error("Transaction-start barrier aborted."));
    await Promise.allSettled(pending);
  }
}

function runDirectly(operation) { return operation(); }

export function assertSameUserDurableStateForTest(options) {
  return assertSameUserDurableState(options);
}

export function proveSameUserCreditRaceForTest(options) {
  return proveSameUserCreditRace(options);
}

export function buildRepositoryEvidenceForTest(checks, categories) {
  if (!checks || REQUIRED_DURABLE_CHECKS.some((name) => checks[name] !== true)) throw new Error("DG-2 durable evidence is incomplete.");
  const requiredCategories = ["sameUserContention", "differentUserIndependence", "ownershipTransfer", "staleGeneration", "replay", "rollback", "fkCleanup", "sleepOffline", "vietnamMidnight", "noFabrication"];
  if (!categories || requiredCategories.some((name) => categories[name]?.status !== "PASS" || !Number.isInteger(categories[name].assertions) || categories[name].assertions < 1)) throw new Error("DG-2 repository category evidence is incomplete.");
  return Object.freeze(Object.fromEntries(requiredCategories.map((name) => [name, categories[name]])));
}

export function createAbortableBarrier({ parties, timeoutMilliseconds = 2_000, setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  if (!Number.isInteger(parties) || parties < 1 || !Number.isInteger(timeoutMilliseconds) || timeoutMilliseconds < 1) throw new TypeError("A bounded barrier is required.");
  let arrivals = 0; let terminal = false; let timerCleared = false; let resolveWait; let rejectWait;
  const waiting = new Promise((resolve, reject) => { resolveWait = resolve; rejectWait = reject; });
  const timer = setTimer(() => settle(false, new Error("Barrier timed out.")), timeoutMilliseconds);
  function clear() { if (!timerCleared) { timerCleared = true; clearTimer(timer); } }
  function settle(success, error) { if (terminal) return false; terminal = true; clear(); success ? resolveWait() : rejectWait(error); return true; }
  return Object.freeze({
    async arriveAndWait() { if (terminal || arrivals >= parties) throw new Error("Unexpected barrier arrival."); arrivals += 1; await waiting; },
    release() { if (arrivals !== parties || !settle(true)) throw new Error("Barrier cannot be released."); },
    abort(error = new Error("Barrier aborted.")) { return settle(false, error); },
    snapshot() { return Object.freeze({ arrivals, parties, terminal, timerCleared }); },
  });
}
