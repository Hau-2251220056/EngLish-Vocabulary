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
  buildRepositoryEvidenceForTest,
  createAbortableBarrier,
  runAtConcurrentTransactionStart,
} from "./daily-goal-dg2-repository.integration.test.js";

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
  const result = await runAtConcurrentTransactionStart({
    prisma: fake.client,
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
  assert.match(repository, /cleanupExpiredOperationalState/);
  assert.match(http, /startHttpTestServer\(createApp/);
  for (const status of [401, 403, 404, 409, 400]) assert.match(http, new RegExp(`status, ${status}`));
  assert.match(http, /durableSnapshot\(prisma, user\.id\)/);
  assert.match(http, /IDLE_RESUME_REQUIRED/);
  assert.match(http, /terminalReceipt\.credited_milliseconds, 20_000n/);
});

function binding() { return { operation: DG2_OPERATION, authorized: "true", repository: DG2_REPOSITORY, sourceSha: SHA, sourceRef: DG2_REF, workflowSha: SHA, runId: "401", runAttempt: "2", postgresqlMajor: "17" }; }
function envBinding() { return { DAILY_GOAL_DG2_OPERATION: DG2_OPERATION, DAILY_GOAL_DG2_AUTHORIZED: "true", DAILY_GOAL_DG2_REPOSITORY: DG2_REPOSITORY, DAILY_GOAL_DG2_SOURCE_SHA: SHA, DAILY_GOAL_DG2_SOURCE_REF: DG2_REF, DAILY_GOAL_DG2_WORKFLOW_SHA: SHA, DAILY_GOAL_DG2_RUN_ID: "401", DAILY_GOAL_DG2_RUN_ATTEMPT: "2", DAILY_GOAL_DG2_POSTGRESQL_MAJOR: "17" }; }
function fakeAdapter(calls, options = {}) { return { async assertPrepared() { calls.push("prepared"); }, async generateClient() { calls.push("generated"); }, async runRepository() { calls.push("repository"); if (options.repositoryError) throw options.repositoryError; return repositoryCategories(); }, async runHttp() { calls.push("http"); return { httpAuthorization: pass(3), httpConflicts: pass(4) }; }, async cleanup() { calls.push("cleanup"); if (options.cleanupError) throw new Error("secret cleanup path"); } }; }
function repositoryCategories() { return { sameUserContention: pass(3), differentUserIndependence: pass(2), ownershipTransfer: pass(6), staleGeneration: pass(2), replay: pass(8), rollback: pass(4), fkCleanup: pass(7), sleepOffline: pass(2), vietnamMidnight: pass(3), noFabrication: pass(5) }; }
function pass(assertions) { return { status: "PASS", assertions }; }
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
