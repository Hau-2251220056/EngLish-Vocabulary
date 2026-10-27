import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  DG2_OPERATION,
  DG2_REF,
  DG2_REPOSITORY,
  createControlledBarrier,
  createDg2Harness,
  refusalEvidence,
  validateDg2Binding,
} from "./daily-goal-dg2-core.js";
import {
  DG2_CLIENT_CONTRACT,
  bindingFromEnvironment,
  buildFullClientGenerateInvocation,
  createDg2SubprocessEnvironment,
  validateFixedPrismaInputs,
} from "./daily-goal-dg2-cli.js";
import {
  assertMidnightDurableDeltaForTest,
  assertSameUserDurableStateForTest,
  buildRepositoryEvidenceForTest,
  createOldClosedTrackingSessionForTest,
  createAbortableBarrier,
  establishAndReadyForTest,
  repositoryDiagnosticLineForTest,
  proveSameUserCreditRaceForTest,
  proveFingerprintMismatchForTest,
  proveNonOwnerReclaimForTest,
  proveOwnershipTransferForTest,
  runAtConcurrentTransactionStart,
  runRepositoryDiagnosticLifecycleForTest,
  seedLearningContextWithCleanupForTest,
} from "./daily-goal-dg2-repository.integration.test.js";
import {
  alignReadyClockForTest,
  createHttpTimelineForTest,
  createIdentityForTest,
  createLearningForTest,
  httpDiagnosticLineForTest,
  runHttpDiagnosticLifecycleForTest,
} from "./daily-goal-dg2-http.integration.test.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const workflowPath = path.join(root, ".github/workflows/daily-goal-dg2-real-stack.yml");
const SHA = "a".repeat(40);

test("DG-2 binding is exact, immutable-looking and separate from DG-1", () => {
  const value = validateDg2Binding(binding());
  assert.equal(value.repository, DG2_REPOSITORY);
  assert.equal(value.sourceRef, DG2_REF);
  assert.equal(value.sourceSha, SHA);
  assert(Object.isFrozen(value));
  for (const patch of [
    { authorized: "false" }, { operation: "DAILY_GOAL_DG1_EPHEMERAL_POSTGRESQL_17" },
    { repository: "other/repository" }, { sourceSha: "A".repeat(40) },
    { sourceRef: "refs/heads/main" }, { workflowSha: "b".repeat(40) },
    { runId: "0" }, { runAttempt: "x" }, { postgresqlMajor: "16" },
  ]) assert.throws(() => validateDg2Binding({ ...binding(), ...patch }));
});

test("trusted authorization/result are single-use and bound to the current invocation", async () => {
  const harness = createDg2Harness();
  const authorization = harness.issueAuthorization(binding());
  const calls = [];
  const trusted = await harness.run({ authorization, adapter: fakeAdapter(calls) });
  const evidence = harness.verifyResult({ trustedResult: trusted, authorization, expectedBinding: binding() });
  assert.deepEqual(calls, ["prepared", "generated", "repository", "http", "cleanup"]);
  assert.equal(evidence.outcome, "DG2_REAL_STACK_VERIFICATION_PASS");
  assert.equal(evidence.rewardSpecific.acDg024RewardXp, "NOT_RUN_DEFERRED_TO_TASK_262");
  assert.equal(evidence.rewardSpecific.acDg048SetupReward, "NOT_RUN_DEFERRED_TO_TASK_262");
  assert.equal(evidence.dg2Passed, false);
  assert.equal(evidence.supabasePlatformVerified, false);
  assert.equal(evidence.deploymentAuthorized, false);
  assert.throws(() => harness.verifyResult({ trustedResult: trusted, authorization, expectedBinding: binding() }));
  await assert.rejects(harness.run({ authorization, adapter: fakeAdapter([]) }));
});

test("failure evidence is fixed, bounded and never serializes hostile nested errors", async () => {
  const harness = createDg2Harness();
  const authorization = harness.issueAuthorization(binding());
  const calls = [];
  await assert.rejects(harness.run({ authorization, adapter: fakeAdapter(calls, { repositoryError: new Error("postgresql://user:password@host/db SELECT secret") }) }), (error) => {
    const evidence = refusalEvidence(error);
    const serialized = JSON.stringify(evidence);
    assert.equal(evidence.code, "DG2_REPOSITORY_FAILED");
    assert(!serialized.includes("password"));
    assert(!serialized.includes("SELECT"));
    assert(Buffer.byteLength(serialized, "utf8") < 16_384);
    return true;
  });
  assert.deepEqual(calls, ["prepared", "generated", "repository", "cleanup"]);
});

test("cleanup is attempted once and cleanup failure is terminal only without an earlier primary", async () => {
  const successHarness = createDg2Harness();
  const successAuthorization = successHarness.issueAuthorization(binding());
  const successCalls = [];
  await assert.rejects(successHarness.run({ authorization: successAuthorization, adapter: fakeAdapter(successCalls, { cleanupError: true }) }), (error) => error.code === "DG2_CLEANUP_FAILED");
  assert.equal(successCalls.filter((item) => item === "cleanup").length, 1);

  const primaryHarness = createDg2Harness();
  const primaryAuthorization = primaryHarness.issueAuthorization(binding());
  await assert.rejects(primaryHarness.run({ authorization: primaryAuthorization, adapter: fakeAdapter([], { repositoryError: new Error("primary"), cleanupError: true }) }), (error) => error.code === "DG2_REPOSITORY_FAILED");
});

test("controlled barriers require exact arrivals and fail closed on timeout", async () => {
  const barrier = createControlledBarrier({ parties: 2, timeoutMilliseconds: 1_000 });
  const first = barrier.arriveAndWait();
  const second = barrier.arriveAndWait();
  assert.deepEqual(barrier.snapshot(), { arrivals: 2, parties: 2, released: false });
  barrier.release();
  await Promise.all([first, second]);
  assert.deepEqual(barrier.snapshot(), { arrivals: 2, parties: 2, released: true });

  let timeout;
  const timed = createControlledBarrier({ parties: 1, timeoutMilliseconds: 1, setTimer(callback) { timeout = callback; return 1; }, clearTimer() {} });
  const waiting = timed.arriveAndWait();
  timeout();
  await assert.rejects(waiting, (error) => error.code === "DG2_BARRIER_TIMEOUT");
});

test("integration barrier abort settles every waiter and clears its timer exactly once", async () => {
  let timeoutCallback;
  let clears = 0;
  const barrier = createAbortableBarrier({
    parties: 2,
    timeoutMilliseconds: 100,
    setTimer(callback) { timeoutCallback = callback; return 7; },
    clearTimer(id) { assert.equal(id, 7); clears += 1; },
  });
  const first = barrier.arriveAndWait();
  const second = barrier.arriveAndWait();
  assert.equal(barrier.abort(new Error("primary failure")), true);
  const settled = await Promise.allSettled([first, second]);
  assert.deepEqual(settled.map((item) => item.status), ["rejected", "rejected"]);
  assert.equal(clears, 1);
  assert.equal(barrier.abort(new Error("late")), false);
  timeoutCallback();
  assert.equal(clears, 1);
  assert.deepEqual(barrier.snapshot(), { arrivals: 2, parties: 2, terminal: true, timerCleared: true });
});

test("transaction-start gate observes two interactive callbacks before releasing operation bodies", async () => {
  const fake = fakeInteractiveTransactions();
  const bodies = [];
  const boundaries = [];
  const result = await runAtConcurrentTransactionStart({
    prisma: fake.client,
    runStartBoundary: async (operation) => { boundaries.push("start:begin"); const value = await operation(); boundaries.push("start:end"); return value; },
    runOperationsBoundary: async (operation) => { boundaries.push("operations:begin"); const value = await operation(); boundaries.push("operations:end"); return value; },
    createOperations(client) {
      return [
        () => client.$transaction(async () => { bodies.push("A"); return "A"; }),
        () => client.$transaction(async () => { bodies.push("B"); return "B"; }),
      ];
    },
    timeoutMilliseconds: 100,
    observationTimeoutMilliseconds: 50,
  });
  assert.deepEqual(result.sort(), ["A", "B"]);
  assert.deepEqual(boundaries, ["start:begin", "start:end", "operations:begin", "operations:end"]);
  assert.equal(fake.stats.starts, 2);
  assert.equal(fake.stats.maxActive, 2);
  assert.deepEqual(bodies.sort(), ["A", "B"]);
  assert.equal(fake.stats.active, 0);
});

test("sequential transaction callbacks cannot satisfy the start gate and fail boundedly", async () => {
  const fake = fakeInteractiveTransactions({ sequential: true });
  const bodies = [];
  await assert.rejects(runAtConcurrentTransactionStart({
    prisma: fake.client,
    createOperations(client) {
      return [
        () => client.$transaction(async () => { bodies.push("A"); }),
        () => client.$transaction(async () => { bodies.push("B"); }),
      ];
    },
    timeoutMilliseconds: 100,
    observationTimeoutMilliseconds: 20,
  }), /Barrier observation timed out/);
  assert.deepEqual(bodies, []);
  assert.equal(fake.stats.starts, 2);
  assert.equal(fake.stats.active, 0);
});

test("early transaction failure aborts the other start waiter and settles both operations", async () => {
  const fake = fakeInteractiveTransactions({ rejectFirstBeforeCallback: true });
  let bodies = 0;
  await assert.rejects(runAtConcurrentTransactionStart({
    prisma: fake.client,
    createOperations(client) {
      return [
        () => client.$transaction(async () => { bodies += 1; }),
        () => client.$transaction(async () => { bodies += 1; }),
      ];
    },
    timeoutMilliseconds: 100,
    observationTimeoutMilliseconds: 20,
  }), /Barrier observation timed out/);
  assert.equal(bodies, 0);
  assert.equal(fake.stats.calls, 2);
  assert.equal(fake.stats.active, 0);
});

test("repository diagnostic emits only an allowlisted phase and preserves primary failure over cleanup", async () => {
  const primary = new Error("postgresql://user:password@host/db SELECT secret /private/path");
  const output = [];
  let cleanupCalls = 0;
  await assert.rejects(runRepositoryDiagnosticLifecycleForTest({
    async execute(runPhase) {
      await runPhase("SAME_USER_LOCK", async () => { throw primary; });
    },
    async cleanup() { cleanupCalls += 1; throw new Error("cleanup credential and SQL"); },
    diagnosticWriter(line) { output.push(line); },
  }), (error) => error === primary);
  assert.equal(output.length, 1);
  assert.equal(cleanupCalls, 1);
  assert.deepEqual(JSON.parse(output[0]), { outcome: "DG2_REPOSITORY_STAGE_REFUSED", repositoryStage: "SAME_USER_LOCK" });
  assert.equal(Buffer.byteLength(output[0], "utf8") <= 256, true);
  assert.doesNotMatch(output[0], /password|SELECT|private|cleanup|credential/i);
});

test("same-USER substages are bounded, redacted and preserve primary failure over cleanup", async () => {
  for (const phase of ["SAME_USER_TX_START", "SAME_USER_OPERATIONS", "SAME_USER_DURABLE_ASSERTIONS"]) {
    const line = repositoryDiagnosticLineForTest(phase);
    assert.deepEqual(JSON.parse(line), { outcome: "DG2_REPOSITORY_STAGE_REFUSED", repositoryStage: phase });
    assert.equal(Buffer.byteLength(line, "utf8") <= 256, true);
  }
  assert.throws(() => repositoryDiagnosticLineForTest("SAME_USER_CREDIT_RACE"), /not allowlisted/);

  const primary = new Error("postgresql://user:password@host/db SELECT secret /private/path");
  const output = [];
  let cleanupCalls = 0;
  await assert.rejects(runRepositoryDiagnosticLifecycleForTest({
    diagnosticWriter(line) { output.push(line); },
    async cleanup() { cleanupCalls += 1; throw new Error("cleanup credential"); },
    async execute(runPhase) { await runPhase("SAME_USER_OPERATIONS", async () => { throw primary; }); },
  }), (error) => error === primary);
  assert.equal(cleanupCalls, 1);
  assert.deepEqual(JSON.parse(output[0]), { outcome: "DG2_REPOSITORY_STAGE_REFUSED", repositoryStage: "SAME_USER_OPERATIONS" });
  assert.doesNotMatch(output[0], /password|SELECT|private|cleanup|credential/i);
});

test("same-USER durable cursor and lease follow a nonhistorical timeline anchor", async () => {
  const timelineStart = new Date("2027-02-03T04:05:06.789Z").getTime();
  const operationIds = ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"];
  const counted = [];
  await assertSameUserDurableStateForTest({
    timelineStart,
    userId: "33333333-3333-4333-8333-333333333333",
    operations: operationIds,
    before: { dayMilliseconds: 5_000n, owner: { generation: 9n } },
    after: {
      dayMilliseconds: 25_000n,
      owner: {
        generation: 9n,
        last_accounted_at: new Date(timelineStart + 20_000),
        lease_expires_at: new Date(timelineStart + 65_000),
      },
    },
    results: [{ credited_milliseconds: "20000" }, { credited_milliseconds: "0" }],
    prisma: { dAILY_GOAL_OPERATION_RECEIPT: { async count({ where }) { counted.push(where); return 1; } } },
  });
  assert.deepEqual(counted.map((where) => where.operation_id), operationIds);
});

test("same-USER baseline snapshot failure is durable-stage refusal before race operations", async () => {
  const primary = new Error("baseline database read failed at postgresql://user:password@host/db");
  const output = [];
  let raceOperations = 0;
  let cleanupCalls = 0;
  const prisma = {
    dAILY_GOAL_OWNER: { async findUnique() { throw primary; } },
    dAILY_GOAL_DAY: { async aggregate() { return { _sum: { active_milliseconds: 0n } }; } },
    async $transaction() { raceOperations += 1; throw new Error("race operation must not start"); },
  };

  await assert.rejects(runRepositoryDiagnosticLifecycleForTest({
    diagnosticWriter(line) { output.push(line); },
    async cleanup() { cleanupCalls += 1; throw new Error("cleanup password must not mask primary"); },
    execute(runPhase) {
      return proveSameUserCreditRaceForTest({
        prisma,
        clock: { value: new Date("2027-02-03T04:05:26.789Z") },
        userId: "33333333-3333-4333-8333-333333333333",
        sessionId: "44444444-4444-4444-8444-444444444444",
        generation: "9",
        timelineStart: new Date("2027-02-03T04:05:06.789Z").getTime(),
        runPhase,
      });
    },
  }), (error) => error === primary);

  assert.equal(raceOperations, 0);
  assert.equal(cleanupCalls, 1);
  assert.deepEqual(output.map((line) => JSON.parse(line)), [{
    outcome: "DG2_REPOSITORY_STAGE_REFUSED",
    repositoryStage: "SAME_USER_DURABLE_ASSERTIONS",
  }]);
  assert.equal(Buffer.byteLength(output[0], "utf8") <= 256, true);
  assert.doesNotMatch(output[0], /postgresql|password|database read|cleanup/i);
});

test("ownership transfer aligns persisted creation time and uses READY before zero-credit REVEAL", async () => {
  const persistedCreatedAt = new Date("2027-03-04T05:06:07.890Z");
  const clock = { value: new Date("2027-03-04T05:06:00.000Z") };
  const calls = [];
  let owner = { generation: 4n, tracking_session_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" };
  const dayValues = [12_000n, 12_000n];
  const prisma = {
    dAILY_GOAL_TRACKING_SESSION: { async findUnique({ where }) { assert.equal(where.id, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"); return { created_at: persistedCreatedAt }; } },
    dAILY_GOAL_OWNER: { async findUnique() { return owner; } },
    dAILY_GOAL_DAY: { async aggregate() { return { _sum: { active_milliseconds: dayValues.shift() } }; } },
  };
  const service = {
    async establish() { calls.push(["ESTABLISH", new Date(clock.value)]); return { tracking_session_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }; },
    async engage(_userId, sessionId, input) {
      calls.push([input.event_type, new Date(clock.value), input]);
      assert.equal(sessionId, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
      if (input.event_type === "READY") return { owner: true, generation: "5", credited_milliseconds: "0" };
      assert.equal(input.generation, "5");
      owner = { generation: 5n, tracking_session_id: sessionId };
      return { owner: true, generation: "5", credited_milliseconds: "0" };
    },
  };

  const result = await proveOwnershipTransferForTest({
    prisma,
    service,
    clock,
    fixture: { user: { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" }, learning: { id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd" } },
  });

  assert.deepEqual(calls.map(([name]) => name), ["ESTABLISH", "READY", "REVEAL"]);
  assert.equal(calls[1][1].toISOString(), persistedCreatedAt.toISOString());
  assert.equal(calls[2][1].toISOString(), persistedCreatedAt.toISOString());
  assert.equal(result.transfer.generation, "5");
  assert.equal(result.transferInstant, persistedCreatedAt.getTime());
  assert.equal(result.assertions, 7);
});

test("non-owner reclaim uses an omitted-generation engagement only after current lease expiry", async () => {
  const initial = new Date("2027-03-04T05:06:07.890Z");
  const contenderDeadline = initial.getTime() + 120_000;
  const clock = { value: initial };
  const calls = [];
  let owner = { tracking_session_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", generation: 7n };
  const contenderId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const currentId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const service = {
    async establish() { return { tracking_session_id: contenderId }; },
    async engage(_userId, sessionId, input) {
      calls.push({ sessionId, input: { ...input }, instant: new Date(clock.value) });
      if (input.event_type === "READY") return { owner: true, generation: "8", credited_milliseconds: "0", engagement_expires_at: new Date(contenderDeadline).toISOString() };
      if (sessionId === currentId) return { owner: true, generation: "9", credited_milliseconds: "0", lease_expires_at: new Date(initial.getTime() + 45_000).toISOString() };
      owner = { tracking_session_id: contenderId, generation: 10n };
      return { owner: true, generation: "10", credited_milliseconds: "0" };
    },
  };
  const prisma = {
    dAILY_GOAL_TRACKING_SESSION: { async findUnique() { return { created_at: initial }; } },
    dAILY_GOAL_OWNER: { async findUnique() { return owner; } },
  };

  const assertions = await proveNonOwnerReclaimForTest({
    prisma,
    service,
    clock,
    fixture: { user: { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" }, learning: { id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd" } },
    currentSessionId: currentId,
    currentGeneration: "7",
  });

  assert.equal(assertions, 6);
  assert.deepEqual(calls.map((call) => call.input.event_type), ["READY", "REVEAL", "REVEAL"]);
  assert.equal("generation" in calls[2].input, false);
  assert.equal(calls[2].instant.getTime(), initial.getTime() + 45_001);
  assert(calls[2].instant.getTime() < contenderDeadline);
});

test("old CLOSED fixture is valid and strictly older than the 31-day cleanup cutoff", async () => {
  const evaluatedAt = new Date("2026-10-26T00:00:00.000Z");
  let data;
  const result = await createOldClosedTrackingSessionForTest({
    evaluatedAt,
    fixture: { user: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }, learning: { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" } },
    prisma: { dAILY_GOAL_TRACKING_SESSION: { async create(input) { data = input.data; return { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", ...input.data }; } } },
  });
  const cutoff = evaluatedAt.getTime() - (31 * 86_400_000);
  assert.equal(data.closed_at.getTime(), cutoff - 1);
  assert.equal(data.created_at.getTime(), data.closed_at.getTime() - 86_400_000);
  assert(data.closed_at.getTime() >= data.created_at.getTime());
  assert(data.closed_at.getTime() < cutoff);
  assert.equal(result.status, "CLOSED");
});

test("both cleanup integration paths use the shared strict-cutoff CLOSED fixture", async () => {
  const source = await readFile(path.join(root, "backend/test/daily-goal/daily-goal-dg2-repository.integration.test.js"), "utf8");
  assert.match(source, /proveCleanupAndRestrict[\s\S]*?createOldClosedTrackingSession\(prisma, fixture, CLEANUP_EVALUATED_AT\)/);
  assert.match(source, /proveCleanupRaceRecheck[\s\S]*?createOldClosedTrackingSession\(prisma, fixture, CLEANUP_EVALUATED_AT\)/);
  assert.doesNotMatch(source, /status: "CLOSED", closed_at: new Date\("2026-08-01/);
});

test("valid REVEAL reaches replay conflict and executes the durable after snapshot", async () => {
  const fake = fingerprintMismatchFixture();
  const assertions = await proveFingerprintMismatchForTest({
    prisma: fake.prisma,
    service: {
      async engage(_userId, _sessionId, input) {
        fake.events.push(input.event_type);
        const error = new Error("persisted receipt differs");
        error.code = "OPERATION_CONFLICT";
        throw error;
      },
    },
    userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    sessionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    operationId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    generation: "5",
    eventType: "REVEAL",
  });
  assert.equal(assertions, 2);
  assert.deepEqual(fake.events, ["REVEAL"]);
  assert.deepEqual(fake.reads, { owner: 2, sessions: 2, days: 2, receipts: 2 });
});

test("invalid event is not accepted as fingerprint-mismatch evidence", async () => {
  const fake = fingerprintMismatchFixture();
  await assert.rejects(proveFingerprintMismatchForTest({
    prisma: fake.prisma,
    service: {
      async engage(_userId, _sessionId, input) {
        fake.events.push(input.event_type);
        const error = new Error("invalid event");
        error.code = "DAILY_GOAL_VALIDATION_ERROR";
        throw error;
      },
    },
    userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    sessionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    operationId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    generation: "5",
    eventType: "NEXT",
  }), (error) => error?.code === "ERR_ASSERTION");
  assert.deepEqual(fake.events, ["NEXT"]);
  assert.deepEqual(fake.reads, { owner: 1, sessions: 1, days: 1, receipts: 1 });
});

test("cleanup-only repository failure has a fixed phase and diagnostic writer failure cannot mask it", async () => {
  const cleanupFailure = new Error("hostile cleanup path and URL");
  let cleanupCalls = 0;
  await assert.rejects(runRepositoryDiagnosticLifecycleForTest({
    async execute() { return "domain result"; },
    async cleanup() { cleanupCalls += 1; throw cleanupFailure; },
    diagnosticWriter() { throw new Error("writer unavailable"); },
  }), (error) => error === cleanupFailure);
  assert.equal(cleanupCalls, 1);
  const line = repositoryDiagnosticLineForTest("FINAL_CLEANUP");
  assert.deepEqual(JSON.parse(line), { outcome: "DG2_REPOSITORY_STAGE_REFUSED", repositoryStage: "FINAL_CLEANUP" });
  assert.equal(Buffer.byteLength(line, "utf8") <= 256, true);
  assert.throws(() => repositoryDiagnosticLineForTest("postgresql://host/private"), /not allowlisted/);
});

test("establish/READY phases use persisted created_at as the controlled-clock floor", async () => {
  const initial = new Date("2026-10-26T00:00:00.000Z");
  const persistedCreatedAt = new Date("2026-10-27T03:04:05.678Z");
  const clock = { value: initial };
  const phases = [];
  let readyInstant;
  const result = await establishAndReadyForTest({
    prisma: { dAILY_GOAL_TRACKING_SESSION: { async findUnique() { return { created_at: persistedCreatedAt }; } } },
    clock,
    userId: "11111111-1111-4111-8111-111111111111",
    learningSessionId: "22222222-2222-4222-8222-222222222222",
    runPhase: async (phase, operation) => { phases.push(phase); return operation(); },
    service: {
      async establish() { return { tracking_session_id: "33333333-3333-4333-8333-333333333333" }; },
      async engage() { readyInstant = new Date(clock.value); return { generation: "1" }; },
    },
  });

  assert.deepEqual(phases, ["SESSION_ESTABLISH", "SESSION_READY"]);
  assert.equal(readyInstant.toISOString(), persistedCreatedAt.toISOString());
  assert.equal(clock.value.getTime() >= persistedCreatedAt.getTime(), true);
  assert.equal(result.ready.generation, "1");
});

test("split establish/READY diagnostics preserve stage, redaction and cleanup precedence", async () => {
  const primary = new Error("postgresql://user:password@host/db SELECT secret /private/path");
  const output = [];
  let cleanupCalls = 0;
  let readyCalls = 0;
  await assert.rejects(runRepositoryDiagnosticLifecycleForTest({
    diagnosticWriter(line) { output.push(line); },
    async cleanup() { cleanupCalls += 1; throw new Error("cleanup credential"); },
    execute(runPhase) {
      return establishAndReadyForTest({
        prisma: { dAILY_GOAL_TRACKING_SESSION: { async findUnique() { return { created_at: new Date("2026-10-27T00:00:00.000Z") }; } } },
        clock: { value: new Date("2026-10-26T00:00:00.000Z") },
        userId: "11111111-1111-4111-8111-111111111111",
        learningSessionId: "22222222-2222-4222-8222-222222222222",
        runPhase,
        service: {
          async establish() { return { tracking_session_id: "33333333-3333-4333-8333-333333333333" }; },
          async engage() { readyCalls += 1; throw primary; },
        },
      });
    },
  }), (error) => error === primary);

  assert.equal(readyCalls, 1);
  assert.equal(cleanupCalls, 1);
  assert.deepEqual(JSON.parse(output[0]), { outcome: "DG2_REPOSITORY_STAGE_REFUSED", repositoryStage: "SESSION_READY" });
  assert.equal(Buffer.byteLength(output[0], "utf8") <= 256, true);
  assert.doesNotMatch(output[0], /password|SELECT|private|cleanup|credential/i);

  const establishOutput = [];
  await assert.rejects(runRepositoryDiagnosticLifecycleForTest({
    diagnosticWriter(line) { establishOutput.push(line); },
    async cleanup() {},
    execute(runPhase) {
      return establishAndReadyForTest({
        prisma: { dAILY_GOAL_TRACKING_SESSION: { async findUnique() { throw new Error("must not query"); } } },
        clock: { value: new Date("2026-10-26T00:00:00.000Z") },
        userId: "11111111-1111-4111-8111-111111111111",
        learningSessionId: "22222222-2222-4222-8222-222222222222",
        runPhase,
        service: { async establish() { throw primary; }, async engage() { throw new Error("must not run"); } },
      });
    },
  }), (error) => error === primary);
  assert.deepEqual(JSON.parse(establishOutput[0]), { outcome: "DG2_REPOSITORY_STAGE_REFUSED", repositoryStage: "SESSION_ESTABLISH" });
});

test("learning fixture uses one creation instant and the exact seven-day expiry", async () => {
  const createdAt = new Date("2026-10-26T04:05:06.789Z");
  const fake = fixtureSeedPrisma();
  await seedLearningContextWithCleanupForTest({ prisma: fake.prisma, createdAt });

  assert.equal(fake.learningData.created_at.toISOString(), createdAt.toISOString());
  assert.equal(fake.learningData.expires_at.getTime() - fake.learningData.created_at.getTime(), 7 * 86_400_000);
  assert.deepEqual(fake.calls.slice(0, 2), ["user:create", "learning:create"]);
  assertFixtureCleanupIsScoped(fake.cleanupWhere, "fixture-user");
});

test("partial learning fixture failure cleans the already-created USER only", async () => {
  const fake = fixtureSeedPrisma({ learningFailure: new Error("fixture insert refused") });
  await assert.rejects(
    seedLearningContextWithCleanupForTest({ prisma: fake.prisma, createdAt: new Date("2026-10-26T00:00:00.000Z") }),
    /fixture insert refused/,
  );

  assert.deepEqual(fake.calls.slice(0, 2), ["user:create", "learning:create"]);
  assert.equal(fake.calls.filter((call) => call === "user:deleteMany").length, 1);
  assertFixtureCleanupIsScoped(fake.cleanupWhere, "fixture-user");
});

test("fixture cleanup preserves a seed failure when cleanup also fails", async () => {
  const seedFailure = new Error("seed failure");
  const cleanupFailure = new Error("cleanup failure");
  const fake = fixtureSeedPrisma({ learningFailure: seedFailure, cleanupFailure });
  await assert.rejects(
    seedLearningContextWithCleanupForTest({ prisma: fake.prisma, createdAt: new Date("2026-10-26T00:00:00.000Z") }),
    (error) => error === seedFailure,
  );
  assert.equal(fake.calls.filter((call) => call === "receipt:deleteMany").length, 1);
});

test("fixture cleanup reports cleanup-only failure and preserves throw undefined", async () => {
  const cleanupFailure = new Error("cleanup-only failure");
  const cleanupOnly = fixtureSeedPrisma({ cleanupFailure });
  await assert.rejects(
    seedLearningContextWithCleanupForTest({ prisma: cleanupOnly.prisma, createdAt: new Date("2026-10-26T00:00:00.000Z") }),
    (error) => error === cleanupFailure,
  );
  assert.equal(cleanupOnly.calls.filter((call) => call === "receipt:deleteMany").length, 1);

  const undefinedPrimary = fixtureSeedPrisma({ learningFailure: undefined, cleanupFailure });
  let rejected = false;
  let rejection = Symbol("not rejected");
  try {
    await seedLearningContextWithCleanupForTest({ prisma: undefinedPrimary.prisma, createdAt: new Date("2026-10-26T00:00:00.000Z") });
  } catch (error) {
    rejected = true;
    rejection = error;
  }
  assert.equal(rejected, true);
  assert.equal(rejection, undefined);
  assert.equal(undefinedPrimary.calls.filter((call) => call === "receipt:deleteMany").length, 1);
});

test("Vietnam-midnight evidence uses durable deltas and preserves pre-existing day amounts", () => {
  const evidence = midnightEvidence({
    beforeRows: [dayRow("2026-10-26", 40_000n)],
    afterRows: [dayRow("2026-10-26", 40_400n), dayRow("2026-10-27", 400n)],
  });
  assert.doesNotThrow(() => assertMidnightDurableDeltaForTest(evidence));
});

test("Vietnam-midnight evidence requires zero delta on every unrelated existing date", () => {
  const evidence = midnightEvidence({
    beforeRows: [dayRow("2026-10-25", 9_000n), dayRow("2026-10-26", 40_000n)],
    afterRows: [dayRow("2026-10-25", 9_000n), dayRow("2026-10-26", 40_400n), dayRow("2026-10-27", 400n)],
  });
  assert.doesNotThrow(() => assertMidnightDurableDeltaForTest(evidence));
  assert.throws(() => assertMidnightDurableDeltaForTest({
    ...evidence,
    afterRows: [dayRow("2026-10-25", 9_001n), dayRow("2026-10-26", 40_400n), dayRow("2026-10-27", 400n)],
  }), /Unexpected durable Daily Goal delta/);
});

test("Vietnam-midnight evidence rejects credit on the wrong date or an extra delta", () => {
  const evidence = midnightEvidence({ beforeRows: [dayRow("2026-10-26", 40_000n)] });
  assert.throws(() => assertMidnightDurableDeltaForTest({
    ...evidence,
    afterRows: [dayRow("2026-10-26", 40_400n), dayRow("2026-10-28", 400n)],
  }), /Unexpected durable Daily Goal delta/);
  assert.throws(() => assertMidnightDurableDeltaForTest({
    ...evidence,
    afterRows: [dayRow("2026-10-26", 40_401n), dayRow("2026-10-27", 400n)],
  }), /Unexpected durable Daily Goal delta/);
});

test("Vietnam-midnight evidence binds exact CREATE READY and REVEAL receipts", () => {
  const evidence = midnightEvidence();
  assert.throws(() => assertMidnightDurableDeltaForTest({
    ...evidence,
    receipts: evidence.receipts.map((receipt) => receipt.operation_id === evidence.operations.reveal
      ? { ...receipt, operation_type: "READY" }
      : receipt),
  }));
  assert.throws(() => assertMidnightDurableDeltaForTest({
    ...evidence,
    receipts: evidence.receipts.map((receipt) => receipt.operation_id === evidence.operations.reveal
      ? { ...receipt, credited_milliseconds: 799n }
      : receipt),
  }));
});

test("HTTP learning fixture uses one instant and exact seven-day expiry", async () => {
  let data;
  const createdAt = new Date("2027-04-05T06:07:08.901Z");
  await createLearningForTest({
    prisma: { lEARNING_SESSION: { async create(input) { data = input.data; return { id: "learning", ...data }; } } },
    userId: "11111111-1111-4111-8111-111111111111",
    createdAt,
  });
  assert.equal(data.created_at.toISOString(), createdAt.toISOString());
  assert.equal(data.expires_at.getTime() - data.created_at.getTime(), 7 * 86_400_000);
});

test("HTTP READY clock is aligned to the exact persisted tracking session", async () => {
  const requested = [];
  const clock = { value: new Date("2026-10-26T00:00:00.000Z") };
  const persisted = new Date("2027-04-05T06:07:08.901Z");
  const timelineStart = await alignReadyClockForTest({
    prisma: { dAILY_GOAL_TRACKING_SESSION: { async findUnique(input) { requested.push(input); return { created_at: persisted }; } } },
    clock,
    trackingSessionId: "22222222-2222-4222-8222-222222222222",
  });
  assert.deepEqual(requested, [{ where: { id: "22222222-2222-4222-8222-222222222222" }, select: { created_at: true } }]);
  assert.equal(timelineStart, persisted.getTime());
  assert.equal(clock.value.toISOString(), persisted.toISOString());
});

test("HTTP heartbeat and terminal timeline is entirely relative to READY", () => {
  const start = new Date("2027-04-05T06:07:08.901Z").getTime();
  const timeline = createHttpTimelineForTest(start);
  assert.deepEqual(timeline.heartbeats.map((instant) => instant - start), [20_000, 40_000, 60_000, 80_000, 100_000]);
  assert.equal(timeline.terminal - start, 120_000);
});

test("HTTP identity registers USER cleanup before AUTH_SESSION failure", async () => {
  const users = [];
  const authFailure = new Error("auth insert refused");
  await assert.rejects(createIdentityForTest({
    prisma: {
      uSER: { async create() { return { id: "fixture-user" }; } },
      aUTH_SESSION: { async create() { throw authFailure; } },
    },
    role: "USER",
    users,
  }), (error) => error === authFailure);
  assert.deepEqual(users, ["fixture-user"]);
});

test("HTTP lifecycle attempts close and fixture cleanup once while preserving primary failure", async () => {
  const primary = new Error("primary password URL SQL path");
  const calls = [];
  const output = [];
  await assert.rejects(runHttpDiagnosticLifecycleForTest({
    diagnosticWriter(line) { output.push(line); },
    async execute(runPhase) { return runPhase("HTTP_HEARTBEATS", async () => { throw primary; }); },
    async close() { calls.push("close"); throw new Error("close secret"); },
    async cleanup() { calls.push("cleanup"); throw new Error("cleanup credential"); },
  }), (error) => error === primary);
  assert.deepEqual(calls, ["close", "cleanup"]);
  assert.deepEqual(JSON.parse(output[0]), { outcome: "DG2_HTTP_STAGE_REFUSED", httpStage: "HTTP_HEARTBEATS" });
  assert.equal(Buffer.byteLength(output[0], "utf8") <= 256, true);
  assert.doesNotMatch(output[0], /password|URL|SQL|path|secret|credential/i);
});

test("HTTP lifecycle reports close-only and cleanup-only failures without skipping cleanup", async () => {
  const closeFailure = new Error("close failure");
  const closeCalls = [];
  await assert.rejects(runHttpDiagnosticLifecycleForTest({
    async execute() { return "ok"; },
    async close() { closeCalls.push("close"); throw closeFailure; },
    async cleanup() { closeCalls.push("cleanup"); throw new Error("later cleanup"); },
    diagnosticWriter() {},
  }), (error) => error === closeFailure);
  assert.deepEqual(closeCalls, ["close", "cleanup"]);

  const cleanupFailure = new Error("cleanup-only failure");
  const output = [];
  await assert.rejects(runHttpDiagnosticLifecycleForTest({
    async execute() { return "ok"; },
    async close() {},
    async cleanup() { throw cleanupFailure; },
    diagnosticWriter(line) { output.push(line); },
  }), (error) => error === cleanupFailure);
  assert.deepEqual(JSON.parse(output[0]), { outcome: "DG2_HTTP_STAGE_REFUSED", httpStage: "HTTP_FIXTURE_CLEANUP" });
});

test("HTTP diagnostic phase is allowlisted, single-line and bounded", () => {
  const line = httpDiagnosticLineForTest("HTTP_READY_REPLAY");
  assert.equal(line.endsWith("\n"), true);
  assert.equal(line.trim().split(/\r?\n/).length, 1);
  assert.equal(Buffer.byteLength(line, "utf8") <= 256, true);
  assert.deepEqual(JSON.parse(line), { outcome: "DG2_HTTP_STAGE_REFUSED", httpStage: "HTTP_READY_REPLAY" });
  assert.throws(() => httpDiagnosticLineForTest("postgresql://user:password@host/database"));
});

test("repository PASS categories require every named durable assertion", () => {
  const checks = Object.fromEntries([
    "sameUserWaited", "differentUsersEntered", "ownerPersisted", "staleUnchanged",
    "raceReceiptsUnique", "raceCreditBounded", "replayReceiptUnique", "replayMutationOnce",
    "mismatchUnchanged", "rollbackComplete", "restrictObserved", "cleanupRaceRechecked",
    "sleepGapExcluded", "leaseLiveGapBurned", "nonOwnerReclaimed", "midnightConserved",
  ].map((name) => [name, true]));
  const categories = repositoryCategories();
  assert.equal(buildRepositoryEvidenceForTest(checks, categories).noFabrication.status, "PASS");
  for (const missing of ["raceCreditBounded", "replayMutationOnce", "rollbackComplete", "nonOwnerReclaimed"]) {
    assert.throws(() => buildRepositoryEvidenceForTest({ ...checks, [missing]: false }, categories), /durable evidence is incomplete/);
  }
  assert.throws(() => buildRepositoryEvidenceForTest(checks, { ...categories, replay: undefined }), /category evidence is incomplete/);
});

test("full-model generation uses fixed explicit config/schema and a minimal job-local environment", async () => {
  const paths = await validateFixedPrismaInputs();
  assert.equal(paths.configPath, DG2_CLIENT_CONTRACT.configPath);
  assert.equal(paths.schemaPath, DG2_CLIENT_CONTRACT.schemaPath);
  const environment = { PATH: "reviewed", CI: "true", DAILY_GOAL_EPHEMERAL_JOB_DATABASE_URL: localUrl(), DATABASE_URL: undefined, AWS_SECRET_ACCESS_KEY: "forbidden", NODE_OPTIONS: "--require malicious" };
  const invocation = buildFullClientGenerateInvocation({ environment });
  assert.deepEqual(invocation.args.slice(0, 5), ["generate", "--config", DG2_CLIENT_CONTRACT.configPath, "--schema", DG2_CLIENT_CONTRACT.schemaPath]);
  assert.equal(invocation.env.DAILY_GOAL_EPHEMERAL_JOB_DATABASE_URL, localUrl());
  assert.equal(invocation.env.DATABASE_URL, undefined);
  assert.equal(invocation.env.AWS_SECRET_ACCESS_KEY, undefined);
  assert.equal(invocation.env.NODE_OPTIONS, undefined);
  assert.throws(() => buildFullClientGenerateInvocation({ environment: { ...environment, DATABASE_URL: "postgresql://external" } }));
  assert.throws(() => createDg2SubprocessEnvironment(environment, "postgresql://user:pass@example.com/db"));
});

test("environment binding ignores no identity field and accepts no caller path", () => {
  const environment = envBinding();
  assert.deepEqual(bindingFromEnvironment(environment), binding());
  assert(!Object.hasOwn(bindingFromEnvironment(environment), "schemaPath"));
  assert(!Object.hasOwn(bindingFromEnvironment(environment), "migrationPath"));
});

test("workflow is manual-only, fail-closed and orders migration preparation before real-stack suites", async () => {
  const source = await readFile(workflowPath, "utf8");
  const jobs = section(source, "jobs:");
  const preflight = section(jobs, "  preflight:", "  dg2-real-stack:");
  const downstream = section(jobs, "  dg2-real-stack:");
  assert.match(source, /^on:\n  workflow_dispatch:/m);
  assert.doesNotMatch(source, /^\s+(push|pull_request|schedule):/m);
  assert.match(source, /default: NOT_AUTHORIZED/);
  assert.match(source, /default: false/);
  assert.doesNotMatch(preflight, /services:|actions\/checkout|npm ci|prisma|postgres:17/);
  assert.match(downstream, /needs: preflight/);
  assert.doesNotMatch(downstream, /always\(\)/);
  assert.equal((source.match(/image: postgres:17/g) ?? []).length, 1);
  assert.match(source, /EXPECTED_SOURCE_SHA: \$\{\{ inputs\.expected_source_sha \}\}/);
  assert.match(source, /\[\[ "\$WORKFLOW_SHA" == "\$EVENT_SHA" \]\]/);
  assert.match(source, /ref: \$\{\{ github\.sha \}\}/);
  assert.doesNotMatch(source, /secrets\.|^\s+(?:CI_TEST_DATABASE_URL|TEST_DATABASE_URL|DATABASE_URL):/m);
  assert(source.indexOf("Run DG-2 offline guards") < source.indexOf("Prepare exact reviewed 12-migration database"));
  assert(source.indexOf("Prepare exact reviewed 12-migration database") < source.indexOf("Generate guarded full-model client"));
  assert(source.indexOf("Generate guarded full-model client") < source.indexOf("Run guarded DG-2 real-stack verification"));
  assert.match(source, /daily-goal-dg2-cli\.js --run/);
});

test("integration sources contain real repository/HTTP entrypoints and bounded lock barriers", async () => {
  const repository = await readFile(path.join(here, "daily-goal-dg2-repository.integration.test.js"), "utf8");
  const http = await readFile(path.join(here, "daily-goal-dg2-http.integration.test.js"), "utf8");
  assert.match(repository, /createDailyGoalRepository\(client\)/);
  assert.match(repository, /createAbortableBarrier\(\{ parties: 1, timeoutMilliseconds: 5_000 \}\)/);
  assert.match(repository, /createAbortableBarrier\(\{ parties: 2, timeoutMilliseconds: 5_000 \}\)/);
  assert.match(repository, /Promise\.allSettled\(pending\)/);
  assert.equal((repository.match(/runAtConcurrentTransactionStart\(\{/g) ?? []).length, 3);
  assert.match(repository, /proveSameUserCreditRace[\s\S]*?runAtConcurrentTransactionStart\(\{/);
  assert.match(repository, /const \[first, replay\] = await runAtConcurrentTransactionStart\(\{/);
  assert.match(repository, /TRACKING_OWNERSHIP_CONFLICT/);
  assert.match(repository, /OPERATION_CONFLICT/);
  assert.match(repository, /dAILY_GOAL_OPERATION_RECEIPT\.count/);
  assert.match(repository, /raceCreditBounded/);
  assert.doesNotMatch(repository, /assertions\s*-\s*\d+/);
  assert.match(repository, /\[400n, 400n\]/);
  assert.match(repository, /nextVietnamMidnightAfter/);
  assert.doesNotMatch(repository, /SESSION_ESTABLISH_READY/);
  assert.match(repository, /"SESSION_ESTABLISH"/);
  assert.match(repository, /"SESSION_READY"/);
  assert.match(repository, /cleanupExpiredOperationalState/);
  assert.match(http, /startHttpTestServer\(createApp/);
  for (const status of [401, 403, 404, 409, 400]) assert.match(http, new RegExp(`status, ${status}`));
  assert.match(http, /durableSnapshot\(prisma, user\.id\)/);
  assert.match(http, /IDLE_RESUME_REQUIRED/);
  assert.match(http, /terminalReceipt\.credited_milliseconds, 20_000n/);
  assert.match(http, /createHttpTimeline\(timelineStart\)/);
  assert.doesNotMatch(http, /2026-10-26T00:/);
});

function binding() { return { operation: DG2_OPERATION, authorized: "true", repository: DG2_REPOSITORY, sourceSha: SHA, sourceRef: DG2_REF, workflowSha: SHA, runId: "401", runAttempt: "2", postgresqlMajor: "17" }; }

function midnightEvidence({ beforeRows = [], afterRows = [dayRow("2026-10-26", 400n), dayRow("2026-10-27", 400n)] } = {}) {
  const operations = Object.freeze({
    create: "11111111-1111-4111-8111-111111111111",
    ready: "22222222-2222-4222-8222-222222222222",
    reveal: "33333333-3333-4333-8333-333333333333",
  });
  return {
    beforeRows,
    afterRows,
    operations,
    expectedParts: [
      { applicationDate: "2026-10-26", durationMilliseconds: 400n },
      { applicationDate: "2026-10-27", durationMilliseconds: 400n },
    ],
    receipts: [
      { operation_id: operations.create, operation_type: "CREATE", credited_milliseconds: 0n },
      { operation_id: operations.ready, operation_type: "READY", credited_milliseconds: 0n },
      { operation_id: operations.reveal, operation_type: "INTERACTION", credited_milliseconds: 800n },
    ],
  };
}

function dayRow(activityDate, activeMilliseconds) {
  return { activity_date: new Date(`${activityDate}T00:00:00.000Z`), active_milliseconds: activeMilliseconds };
}

function envBinding() { return { DAILY_GOAL_DG2_OPERATION: DG2_OPERATION, DAILY_GOAL_DG2_AUTHORIZED: "true", DAILY_GOAL_DG2_REPOSITORY: DG2_REPOSITORY, DAILY_GOAL_DG2_SOURCE_SHA: SHA, DAILY_GOAL_DG2_SOURCE_REF: DG2_REF, DAILY_GOAL_DG2_WORKFLOW_SHA: SHA, DAILY_GOAL_DG2_RUN_ID: "401", DAILY_GOAL_DG2_RUN_ATTEMPT: "2", DAILY_GOAL_DG2_POSTGRESQL_MAJOR: "17" }; }
function fakeAdapter(calls, options = {}) { return { async assertPrepared() { calls.push("prepared"); }, async generateClient() { calls.push("generated"); }, async runRepository() { calls.push("repository"); if (options.repositoryError) throw options.repositoryError; return repositoryCategories(); }, async runHttp() { calls.push("http"); return { httpAuthorization: pass(3), httpConflicts: pass(4) }; }, async cleanup() { calls.push("cleanup"); if (options.cleanupError) throw new Error("secret cleanup path"); } }; }
function repositoryCategories() { return { sameUserContention: pass(3), differentUserIndependence: pass(2), ownershipTransfer: pass(6), staleGeneration: pass(2), replay: pass(8), rollback: pass(4), fkCleanup: pass(7), sleepOffline: pass(2), vietnamMidnight: pass(9), noFabrication: pass(5) }; }
function pass(assertions) { return { status: "PASS", assertions }; }
function fixtureSeedPrisma(options = {}) {
  const learningFailurePresent = Object.prototype.hasOwnProperty.call(options, "learningFailure");
  const { learningFailure, cleanupFailure } = options;
  const calls = [];
  const cleanupWhere = [];
  let learningData;
  const cleanupDelegate = (name) => ({ async deleteMany({ where }) { calls.push(`${name}:deleteMany`); cleanupWhere.push({ name, where }); if (name === "receipt" && cleanupFailure) throw cleanupFailure; return { count: 0 }; } });
  const userCleanup = cleanupDelegate("user");
  const prisma = {
    dAILY_GOAL_OPERATION_RECEIPT: cleanupDelegate("receipt"),
    dAILY_GOAL_OWNER: cleanupDelegate("owner"),
    dAILY_GOAL_TRACKING_SESSION: cleanupDelegate("tracking"),
    dAILY_GOAL_DAY: cleanupDelegate("day"),
    aUTH_SESSION: cleanupDelegate("auth"),
    uSER: {
      async create() { calls.push("user:create"); return { id: "fixture-user" }; },
      deleteMany: userCleanup.deleteMany,
    },
    lEARNING_SESSION: {
      async create({ data }) { calls.push("learning:create"); learningData = data; if (learningFailurePresent) throw learningFailure; return { id: "fixture-learning", ...data }; },
      ...cleanupDelegate("learning"),
    },
  };
  return { prisma, calls, cleanupWhere, get learningData() { return learningData; } };
}
function assertFixtureCleanupIsScoped(cleanupWhere, userId) {
  assert.equal(cleanupWhere.length, 7);
  for (const { name, where } of cleanupWhere) {
    assert.deepEqual(where, name === "user" ? { id: { in: [userId] } } : { user_id: { in: [userId] } });
  }
}
function fingerprintMismatchFixture() {
  const reads = { owner: 0, sessions: 0, days: 0, receipts: 0 };
  const state = {
    owner: { user_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", tracking_session_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", generation: 5n },
    sessions: [{ id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", status: "ACTIVE" }],
    days: [{ user_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", active_milliseconds: 20_000n }],
    receipts: [{ operation_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", operation_type: "HEARTBEAT" }],
  };
  return {
    events: [],
    reads,
    prisma: {
      dAILY_GOAL_OWNER: { async findUnique() { reads.owner += 1; return structuredClone(state.owner); } },
      dAILY_GOAL_TRACKING_SESSION: { async findMany() { reads.sessions += 1; return structuredClone(state.sessions); } },
      dAILY_GOAL_DAY: { async findMany() { reads.days += 1; return structuredClone(state.days); } },
      dAILY_GOAL_OPERATION_RECEIPT: { async findMany() { reads.receipts += 1; return structuredClone(state.receipts); } },
    },
  };
}
function fakeInteractiveTransactions({ sequential = false, rejectFirstBeforeCallback = false } = {}) {
  const stats = { calls: 0, starts: 0, active: 0, maxActive: 0 };
  let tail = Promise.resolve();
  const client = {
    $transaction(callback) {
      stats.calls += 1;
      if (rejectFirstBeforeCallback && stats.calls === 1) return Promise.reject(new Error("Injected transaction start failure."));
      const execute = async () => {
        stats.starts += 1;
        stats.active += 1;
        stats.maxActive = Math.max(stats.maxActive, stats.active);
        try { return await callback(Object.freeze({ transaction: stats.starts })); }
        finally { stats.active -= 1; }
      };
      if (!sequential) return Promise.resolve().then(execute);
      const current = tail.then(execute);
      tail = current.catch(() => {});
      return current;
    },
  };
  return { client, stats };
}
function localUrl() { return "postgresql://daily_goal_ephemeral:local-only@127.0.0.1:5432/daily_goal_ephemeral"; }
function section(source, start, end) { const from = source.indexOf(start); assert.notEqual(from, -1); const until = end ? source.indexOf(end, from + start.length) : source.length; assert.notEqual(until, -1); return source.slice(from, until); }
