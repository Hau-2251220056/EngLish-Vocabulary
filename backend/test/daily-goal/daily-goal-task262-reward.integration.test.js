import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { createDailyGoalRepository } from "../../src/repositories/daily-goal-repository.js";
import { createDailyGoalService } from "../../src/services/daily-goal-service.js";
import { projectXpLevel } from "../../src/services/xp-level-service.js";
import { runAtConcurrentTransactionStart } from "./daily-goal-dg2-repository.integration.test.js";
import { createTask262Barrier } from "./daily-goal-task262-core.js";

const NOW = new Date("2026-10-27T08:00:00.000Z");
const DAY = new Date("2026-10-27T00:00:00.000Z");

export async function runTask262RewardIntegration({ prisma } = {}) {
  if (!prisma?.$transaction) throw new TypeError("A real Prisma client is required.");
  const users = [];
  const evidence = createEvidenceTracker([
    "firstSetup", "goalEdits", "heartbeatGoalRace", "rewardUniqueness",
    "notificationUniqueness", "levelProjection", "atomicRollback",
    "databaseUniqueness", "preGoalTime", "completionBoundary",
  ]);
  let primary;
  try {
    const first = await seedUser(prisma, users, { milliseconds: 1_200_000n, totalXp: 45 });
    await prisma.uSER.update({
      where: { id: first.id },
      data: { daily_goal_reminders_enabled: false, daily_goal_reminders_enabled_at: NOW },
    });
    const setupResults = await concurrentGoalUpdates(prisma, first.id, [15, 15]);
    assert.equal(setupResults.filter((item) => item.reward.earned_now).length, 1); evidence.mark("firstSetup");
    assert(setupResults.every((item) => item.reminder_enabled === false));
    await assertCompletionState(prisma, first.id, { milliseconds: 1_200_000n, totalXp: 55, rewards: 1, notifications: 1 });
    assert.equal(await prisma.uSER_NOTIFICATION.count({ where: { user_id: first.id } }), 1);
    assert.equal(await prisma.uSER_NOTIFICATION.count({ where: { user_id: first.id, type: "DAILY_GOAL_INACTIVITY_REMINDER" } }), 0);
    evidence.mark("rewardUniqueness"); evidence.mark("notificationUniqueness");
    assert.deepEqual(setupResults.at(-1).xp_level, projectXpLevel(55)); evidence.mark("levelProjection");

    const below = await seedUser(prisma, users, { milliseconds: 599_999n });
    const belowResult = await service(prisma).updateGoal(below.id, goalUpdate(10));
    assert.equal(belowResult.completed, false);
    assert.equal(belowResult.reward.earned_now, false);
    assert.equal((await day(prisma, below.id)).active_milliseconds, 599_999n); evidence.mark("completionBoundary", 3);

    const boundary = await seedUser(prisma, users, { milliseconds: 600_000n });
    const boundaryResult = await service(prisma).updateGoal(boundary.id, goalUpdate(10));
    assert.equal(boundaryResult.completed, true);
    assert.equal(boundaryResult.reward.xp_earned, 10); evidence.mark("completionBoundary", 2);

    const edited = await seedUser(prisma, users, { milliseconds: 900_000n, goal: 30 });
    const reduced = await concurrentGoalUpdates(prisma, edited.id, [15, 15]);
    assert.equal(reduced.filter((item) => item.reward.earned_now).length, 1); evidence.mark("goalEdits");
    const increased = await concurrentGoalUpdates(prisma, edited.id, [30, 30]);
    assert(increased.every((item) => item.completed === false && item.reward_earned === true));
    await assertCompletionState(prisma, edited.id, { milliseconds: 900_000n, totalXp: 10, rewards: 1, notifications: 1 }); evidence.mark("goalEdits", 2);

    const conflicting = await seedUser(prisma, users, { milliseconds: 900_000n, goal: 20 });
    const conflictingResults = await concurrentGoalUpdates(prisma, conflicting.id, [10, 30]);
    const conflictingState = await assertCompletionState(prisma, conflicting.id, { milliseconds: 900_000n, totalXp: 10, rewards: 1, notifications: 1 });
    assert([10, 30].includes(conflictingState.goal));
    assert.equal(conflictingState.goal === 10, conflictingState.completed);
    assert.equal(conflictingState.rewardEarned, true);
    assert.equal(conflictingResults.filter((item) => item.reward.earned_now).length, 1);
    evidence.mark("goalEdits", 4);

    const raced = await seedTrackingUser(prisma, users, { milliseconds: 580_000n, goal: 20 });
    const raceClock = { value: new Date(raced.readyAt.getTime() + 20_000) };
    const raceResults = await runAtConcurrentTransactionStart({
      prisma,
      createOperations(client) {
        const concurrent = service(client, raceClock);
        return [
          () => concurrent.heartbeat(raced.id, raced.trackingSessionId, { operation_id: randomUUID(), generation: raced.generation, eligibility: "VISIBLE_FOCUSED_ACTIVE" }),
          () => concurrent.updateGoal(raced.id, goalUpdate(10)),
        ];
      },
    });
    assert.equal(raceResults.length, 2);
    await assertCompletionState(prisma, raced.id, { milliseconds: 600_000n, totalXp: 10, rewards: 1, notifications: 1 }); evidence.mark("heartbeatGoalRace", 2);

    const preGoal = await seedTrackingUser(prisma, users, { milliseconds: 600_000n, goal: null });
    const preSetupDay = await day(prisma, preGoal.id);
    assert.equal(preSetupDay.active_milliseconds, 600_000n);
    assert.equal(preSetupDay.last_credited_at.getTime(), preGoal.readyAt.getTime());
    assert.equal(preSetupDay.last_engagement_at.getTime(), preGoal.readyAt.getTime());
    const configured = await service(prisma, { value: preGoal.readyAt }).updateGoal(preGoal.id, goalUpdate(15));
    assert.equal(configured.completed, false);
    assert.equal(configured.reward.earned_now, false);
    const configuredDay = await day(prisma, preGoal.id);
    assert.equal(configuredDay.active_milliseconds, 600_000n);
    assert.equal(configuredDay.last_credited_at.getTime(), preGoal.readyAt.getTime());
    assert.equal(configuredDay.last_engagement_at.getTime(), preGoal.readyAt.getTime());
    await creditEligibleTime(prisma, preGoal, 12);
    const completedDay = await day(prisma, preGoal.id);
    const completionTime = preGoal.readyAt.getTime() + 300_000;
    assert.equal(completedDay.last_credited_at.getTime(), completionTime);
    assert.equal(completedDay.last_engagement_at.getTime(), completionTime);
    await assertCompletionState(prisma, preGoal.id, { milliseconds: 900_000n, totalXp: 10, rewards: 1, notifications: 1, goal: 15 });
    evidence.mark("preGoalTime", 12);

    const rollback = await seedUser(prisma, users, { milliseconds: 600_000n });
    const failing = service(transactionClientWithNotificationFailure(prisma));
    await assert.rejects(failing.updateGoal(rollback.id, goalUpdate(10)), /Injected completion notification failure/);
    await assertCompletionState(prisma, rollback.id, { milliseconds: 600_000n, totalXp: 0, rewards: 0, notifications: 0, goal: null, receipts: 0 }); evidence.mark("atomicRollback", 2);
    const retry = await service(prisma).updateGoal(rollback.id, goalUpdate(10));
    assert.equal(retry.reward.earned_now, true); evidence.mark("atomicRollback");

    const uniqueness = await seedUser(prisma, users);
    await assertDatabaseUniquenessRaces(prisma, uniqueness.id); evidence.mark("databaseUniqueness", 6);

    return evidence.finish();
  } catch (error) {
    primary = error;
    throw error;
  } finally {
    try { await cleanupUsers(prisma, users); }
    catch (cleanupError) { if (primary) markCleanupFailure(primary); else throw cleanupError; }
  }
}

async function concurrentGoalUpdates(prisma, userId, targets) {
  return runAtConcurrentTransactionStart({
    prisma,
    createOperations(client) {
      const concurrent = service(client);
      return targets.map((target) => () => concurrent.updateGoal(userId, goalUpdate(target)));
    },
  });
}

async function seedUser(prisma, users, { milliseconds = 0n, totalXp = 0, goal = null } = {}) {
  const user = await prisma.uSER.create({
    data: {
      email: `task262-${randomUUID()}@example.test`, password_hash: "not-used", display_name: "TASK-262",
      role: "USER", total_xp: totalXp, daily_goal_minutes: goal,
    },
  });
  users.push(user.id);
  if (milliseconds > 0n) {
    await prisma.dAILY_GOAL_DAY.create({
      data: { user_id: user.id, activity_date: DAY, active_milliseconds: milliseconds, last_credited_at: NOW, last_engagement_at: NOW, last_activity_type: "NORMAL" },
    });
  }
  return user;
}

async function seedTrackingUser(prisma, users, { milliseconds, goal }) {
  const user = await seedUser(prisma, users, { milliseconds, goal });
  const learning = await prisma.lEARNING_SESSION.create({
    data: { user_id: user.id, set_id_snapshot: randomUUID(), mode: "NORMAL", status: "ACTIVE", create_operation_id: randomUUID(), snapshot_size: 1, created_at: NOW, expires_at: new Date(NOW.getTime() + (7 * 86_400_000)) },
  });
  const clock = { value: new Date(NOW) };
  const instance = service(prisma, clock);
  const established = await instance.establish(user.id, { operation_id: randomUUID(), activity_type: "NORMAL", learning_session_id: learning.id });
  const ready = await instance.engage(user.id, established.tracking_session_id, { operation_id: randomUUID(), event_type: "READY" });
  return { ...user, trackingSessionId: established.tracking_session_id, generation: ready.generation, readyAt: new Date(clock.value) };
}

async function assertCompletionState(prisma, userId, expected) {
  const [user, persistedDay, rewards, notifications, receipts] = await Promise.all([
    prisma.uSER.findUniqueOrThrow({ where: { id: userId }, select: { total_xp: true, daily_goal_minutes: true } }),
    day(prisma, userId),
    prisma.dAILY_GOAL_REWARD.count({ where: { user_id: userId } }),
    prisma.uSER_NOTIFICATION.count({ where: { user_id: userId, type: "DAILY_GOAL_COMPLETED" } }),
    prisma.dAILY_GOAL_OPERATION_RECEIPT.count({ where: { user_id: userId } }),
  ]);
  assert.equal(persistedDay?.active_milliseconds ?? 0n, expected.milliseconds);
  assert.equal(user.total_xp, expected.totalXp);
  assert.equal(rewards, expected.rewards);
  assert.equal(notifications, expected.notifications);
  if (Object.hasOwn(expected, "goal")) assert.equal(user.daily_goal_minutes, expected.goal);
  if (Object.hasOwn(expected, "receipts")) assert.equal(receipts, expected.receipts);
  return {
    goal: user.daily_goal_minutes,
    completed: (persistedDay?.active_milliseconds ?? 0n) >= BigInt((user.daily_goal_minutes ?? 0) * 60_000),
    rewardEarned: rewards === 1,
  };
}

async function creditEligibleTime(prisma, fixture, heartbeats) {
  const clock = { value: new Date(fixture.readyAt) };
  const instance = service(prisma, clock);
  for (let index = 0; index < heartbeats; index += 1) {
    clock.value = new Date(clock.value.getTime() + 25_000);
    if ((index + 1) % 4 === 0) {
      await instance.engage(fixture.id, fixture.trackingSessionId, { operation_id: randomUUID(), event_type: "NAVIGATE" });
    } else {
      await instance.heartbeat(fixture.id, fixture.trackingSessionId, { operation_id: randomUUID(), generation: fixture.generation, eligibility: "VISIBLE_FOCUSED_ACTIVE" });
    }
  }
}

async function assertDatabaseUniquenessRaces(prisma, userId) {
  const sourceOperationId = randomUUID();
  const reward = () => ({ user_id: userId, activity_date: DAY, source_operation_id: sourceOperationId, xp_amount: 10 });
  const rewardResults = await raceIndependentCreates(prisma, (tx) => tx.dAILY_GOAL_REWARD.create({ data: reward() }));
  assert.equal(rewardResults.filter(({ status }) => status === "fulfilled").length, 1);
  assert.equal(rewardResults.filter(({ status, reason }) => status === "rejected" && reason?.code === "P2002").length, 1);
  assert.equal(await prisma.dAILY_GOAL_REWARD.count({ where: { user_id: userId, activity_date: DAY } }), 1);
  const notification = () => ({ user_id: userId, type: "DAILY_GOAL_COMPLETED", application_date: DAY, title: "Daily goal completed", body: "Daily goal completed." });
  const notificationResults = await raceIndependentCreates(prisma, (tx) => tx.uSER_NOTIFICATION.create({ data: notification() }));
  assert.equal(notificationResults.filter(({ status }) => status === "fulfilled").length, 1);
  assert.equal(notificationResults.filter(({ status, reason }) => status === "rejected" && reason?.code === "P2002").length, 1);
  assert.equal(await prisma.uSER_NOTIFICATION.count({ where: { user_id: userId, type: "DAILY_GOAL_COMPLETED", application_date: DAY } }), 1);
}

async function raceIndependentCreates(prisma, create) {
  const barrier = createTask262Barrier({ parties: 2, timeoutMilliseconds: 5_000 });
  const pending = [0, 1].map(() => prisma.$transaction(async (tx) => {
    await barrier.arriveAndWait();
    return create(tx);
  }, { maxWait: 5_000, timeout: 10_000 }));
  pending.forEach((operation) => operation.catch(() => {}));
  try {
    await waitForArrivals(barrier, 2_000);
    barrier.release();
    return await Promise.allSettled(pending);
  } finally {
    if (!barrier.snapshot().terminal) barrier.abort();
    await Promise.allSettled(pending);
  }
}

async function waitForArrivals(barrier, timeoutMilliseconds) {
  const deadline = Date.now() + timeoutMilliseconds;
  while (barrier.snapshot().arrivals !== 2) {
    if (Date.now() >= deadline) throw new Error("TASK-262 uniqueness race did not reach its bounded start barrier.");
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

function transactionClientWithNotificationFailure(prisma) {
  return new Proxy(prisma, {
    get(target, property) {
      if (property !== "$transaction") {
        const value = Reflect.get(target, property, target);
        return typeof value === "function" ? value.bind(target) : value;
      }
      return (callback, options) => target.$transaction((tx) => callback(new Proxy(tx, {
        get(inner, key) {
          if (key !== "uSER_NOTIFICATION") return Reflect.get(inner, key, inner);
          return new Proxy(inner[key], {
            get(delegate, method) {
              if (method === "create") return async () => { throw new Error("Injected completion notification failure."); };
              const value = Reflect.get(delegate, method, delegate);
              return typeof value === "function" ? value.bind(delegate) : value;
            },
          });
        },
      })), options);
    },
  });
}

function service(prisma, clock = { value: NOW }) {
  return createDailyGoalService({ dailyGoalRepository: createDailyGoalRepository(prisma), now: () => new Date(clock.value), uuid: randomUUID });
}
function goalUpdate(target_minutes) { return { operation_id: randomUUID(), target_minutes }; }
function day(prisma, userId) { return prisma.dAILY_GOAL_DAY.findUnique({ where: { user_id_activity_date: { user_id: userId, activity_date: DAY } } }); }
function createEvidenceTracker(categories) {
  const counts = Object.fromEntries(categories.map((category) => [category, 0]));
  return Object.freeze({
    mark(category, count = 1) { assert(Object.hasOwn(counts, category)); counts[category] += count; },
    finish() {
      assert(Object.values(counts).every((count) => Number.isInteger(count) && count > 0));
      return Object.fromEntries(Object.entries(counts).map(([category, assertions]) => [category, Object.freeze({ status: "PASS", assertions })]));
    },
  });
}
function markCleanupFailure(error) { try { Object.defineProperty(error, "task262CleanupFailed", { value: true }); } catch {} }

async function cleanupUsers(prisma, ids) {
  if (!ids.length) return;
  const where = { user_id: { in: ids } };
  await prisma.dAILY_GOAL_OPERATION_RECEIPT.deleteMany({ where });
  await prisma.dAILY_GOAL_OWNER.deleteMany({ where });
  await prisma.dAILY_GOAL_TRACKING_SESSION.deleteMany({ where });
  await prisma.dAILY_GOAL_MONITOR_SESSION.deleteMany({ where });
  await prisma.uSER_NOTIFICATION.deleteMany({ where });
  await prisma.dAILY_GOAL_REWARD.deleteMany({ where });
  await prisma.dAILY_GOAL_DAY.deleteMany({ where });
  await prisma.lEARNING_SESSION.deleteMany({ where });
  await prisma.aUTH_SESSION.deleteMany({ where });
  await prisma.uSER.deleteMany({ where: { id: { in: ids } } });
}
