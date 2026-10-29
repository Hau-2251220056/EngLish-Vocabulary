import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import {
  createTask262Barrier,
  createTask262Harness,
  TASK262_CATEGORIES,
  TASK262_OPERATION,
  TASK262_REF,
  TASK262_REPOSITORY,
  task262RefusalEvidence,
  validateTask262Binding,
  validateTask262Categories,
} from "./daily-goal-task262-core.js";
import {
  bindingFromTask262Environment,
  createTask262SubprocessEnvironment,
  requireTask262JobLocalUrl,
  validateTask262PreparedDatabase,
} from "./daily-goal-task262-cli.js";
import { REVIEWED_INVENTORY } from "./daily-goal-ephemeral-migration-core.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(here, "../../..");
const workflowPath = path.join(repositoryRoot, ".github/workflows/daily-goal-task262-real-stack.yml");
const SHA = "a".repeat(40);

test("TASK-262 binding requires the exact operation, source, ref, workflow, run and PostgreSQL major", () => {
  const value = binding();
  const result = validateTask262Binding(value);
  assert.equal(result.sourceSha, SHA);
  assert.equal(result.workflowSha, SHA);
  for (const mutation of [
    { operation: "NOT_AUTHORIZED" }, { authorized: "false" }, { repository: "fork/repo" },
    { sourceSha: "bad" }, { sourceRef: "refs/heads/main" }, { workflowSha: "b".repeat(40) },
    { runId: "0" }, { runAttempt: "0" }, { postgresqlMajor: "16" },
  ]) assert.throws(() => validateTask262Binding({ ...value, ...mutation }));
});

test("authorization and result capabilities are single-use and cleanup always runs", async () => {
  const calls = [];
  const harness = createTask262Harness();
  const authorization = harness.issueAuthorization(binding());
  const trusted = await harness.run({ authorization, adapter: fakeAdapter(calls) });
  const evidence = harness.verifyResult({ trustedResult: trusted, authorization, expectedBinding: binding() });
  assert.equal(evidence.task262Passed, true);
  assert.equal(evidence.postgresqlVerified, true);
  assert.equal(evidence.dg3Authorized, false);
  assert.deepEqual(calls, ["prepared", "generated", "reward", "http", "compatibility", "cleanup"]);
  assert.throws(() => harness.verifyResult({ trustedResult: trusted, authorization, expectedBinding: binding() }));
  await assert.rejects(harness.run({ authorization, adapter: fakeAdapter([]) }));
});

test("missing, malformed, skipped, deferred and NOT_RUN categories cannot produce PASS", async () => {
  const complete = categories();
  assert.equal(Object.keys(validateTask262Categories(complete)).length, TASK262_CATEGORIES.length);
  for (const invalid of [undefined, null, { ...complete, firstSetup: undefined }, { ...complete, firstSetup: { status: "NOT_RUN", assertions: 1 } }, { ...complete, firstSetup: { status: "PASS", assertions: 0 } }, { ...complete, unexpected: pass(1) }]) {
    assert.throws(() => validateTask262Categories(invalid));
  }
  const harness = createTask262Harness();
  const authorization = harness.issueAuthorization(binding());
  await assert.rejects(harness.run({ authorization, adapter: fakeAdapter([], { reward: { firstSetup: { status: "NOT_RUN", assertions: 1 } } }) }));
});

test("failure output is bounded and redacts hostile errors", async () => {
  const harness = createTask262Harness();
  const authorization = harness.issueAuthorization(binding());
  await assert.rejects(harness.run({ authorization, adapter: fakeAdapter([], { error: new Error("postgresql://user:secret@external/db SELECT private") }) }), (error) => {
    const evidence = task262RefusalEvidence(error);
    const output = JSON.stringify(evidence);
    assert(!output.includes("secret"));
    assert(!output.includes("postgresql://"));
    assert(!output.includes("SELECT"));
    assert.equal(evidence.task262Passed, false);
    assert.equal(evidence.cleanupFailed, false);
    return true;
  });
});

test("primary failure is preserved when cleanup also fails and cleanup-only failure is terminal", async () => {
  const firstHarness = createTask262Harness();
  const firstAuthorization = firstHarness.issueAuthorization(binding());
  await assert.rejects(firstHarness.run({ authorization: firstAuthorization, adapter: fakeAdapter([], { error: new Error("primary"), cleanupError: true }) }), (error) => {
    const refusal = task262RefusalEvidence(error);
    return error.code === "TASK262_REWARD_SUITE_FAILED" && refusal.cleanupFailed === true;
  });
  const secondHarness = createTask262Harness();
  const secondAuthorization = secondHarness.issueAuthorization(binding());
  await assert.rejects(secondHarness.run({ authorization: secondAuthorization, adapter: fakeAdapter([], { cleanupError: true }) }), (error) => error.code === "TASK262_CLEANUP_FAILED");
  const incompleteCalls = [];
  const incompleteHarness = createTask262Harness();
  const incompleteAuthorization = incompleteHarness.issueAuthorization(binding());
  await assert.rejects(incompleteHarness.run({ authorization: incompleteAuthorization, adapter: { async cleanup() { incompleteCalls.push("cleanup"); } } }), (error) => error.code === "TASK262_ADAPTER_INCOMPLETE");
  assert.deepEqual(incompleteCalls, ["cleanup"]);
});

test("database URL guard accepts only the exact loopback job identity and never falls back", () => {
  assert.equal(requireTask262JobLocalUrl({ DAILY_GOAL_TASK262_JOB_DATABASE_URL: localUrl() }), localUrl());
  for (const value of [
    "postgresql://daily_goal_ephemeral:pw@localhost:5432/daily_goal_ephemeral",
    "postgresql://daily_goal_ephemeral:pw@example.com:5432/daily_goal_ephemeral",
    "postgresql://other:pw@127.0.0.1:5432/daily_goal_ephemeral",
    "postgresql://daily_goal_ephemeral:pw@127.0.0.1:5432/other",
    "postgresql://daily_goal_ephemeral:pw@127.0.0.1:5432/daily_goal_ephemeral?schema=public",
  ]) assert.throws(() => requireTask262JobLocalUrl({ DAILY_GOAL_TASK262_JOB_DATABASE_URL: value }));
  for (const key of ["DATABASE_URL", "TEST_DATABASE_URL", "CI_TEST_DATABASE_URL", "DAILY_GOAL_OBSERVER_DATABASE_URL"]) {
    assert.throws(() => requireTask262JobLocalUrl({ DAILY_GOAL_TASK262_JOB_DATABASE_URL: localUrl(), [key]: "postgresql://external" }));
  }
});

test("subprocess environment is minimal and strips unrelated or secret-bearing values", () => {
  const environment = createTask262SubprocessEnvironment({ PATH: "reviewed", CI: "true", NODE_OPTIONS: "--require hostile", AWS_SECRET_ACCESS_KEY: "secret", DATABASE_URL: "external" }, localUrl());
  assert.deepEqual(environment, { PATH: "reviewed", CI: "true", DAILY_GOAL_EPHEMERAL_JOB_DATABASE_URL: localUrl() });
});

test("migration inventory requires PostgreSQL 17 and the exact reviewed completed history", async () => {
  const complete = REVIEWED_INVENTORY.map(({ name, checksum }) => ({
    migration_name: name,
    checksum,
    finished_at: new Date(),
    rolled_back_at: null,
  }));
  const valid = fakePreparationPrisma(170001, complete);
  assert.equal((await validateTask262PreparedDatabase(valid)).postgresqlMajor, 17);
  await assert.rejects(validateTask262PreparedDatabase(fakePreparationPrisma(160001, complete)));
  await assert.rejects(validateTask262PreparedDatabase(fakePreparationPrisma(170001, complete.slice(1))));
  await assert.rejects(validateTask262PreparedDatabase(fakePreparationPrisma(170001, complete.map((row, index) => index === 0 ? { ...row, checksum: "changed" } : row))));
});

test("bounded barrier releases exact arrivals and refuses timeout or extra arrivals", async () => {
  const barrier = createTask262Barrier({ parties: 2, timeoutMilliseconds: 100 });
  const waiters = [barrier.arriveAndWait(), barrier.arriveAndWait()];
  barrier.release();
  await Promise.all(waiters);
  await assert.rejects(barrier.arriveAndWait());
  let timeoutCallback;
  const timed = createTask262Barrier({ parties: 1, timeoutMilliseconds: 1, setTimer(callback) { timeoutCallback = callback; return 1; }, clearTimer() {} });
  const waiting = timed.arriveAndWait();
  timeoutCallback();
  await assert.rejects(waiting, (error) => error.code === "TASK262_BARRIER_TIMEOUT");
});

test("workflow is manual-only, fail-closed, secret-free and ordered before database execution", async () => {
  const source = await readFile(workflowPath, "utf8");
  assert.match(source, /^on:\n  workflow_dispatch:/m);
  assert.doesNotMatch(source, /^\s+(push|pull_request|schedule):/m);
  assert.match(source, /default: NOT_AUTHORIZED/);
  assert.match(source, /default: false/);
  assert.match(source, /^name: Daily Goal TASK-262 Real Stack$/m);
  assert.equal((source.match(/image: postgres:17/g) ?? []).length, 1);
  assert.doesNotMatch(source, /secrets\.|^\s+(?:CI_TEST_DATABASE_URL|TEST_DATABASE_URL|DATABASE_URL):/m);
  assert.match(source, /EVENT_WORKFLOW: \$\{\{ github\.workflow \}\}/);
  assert.match(source, /EVENT_WORKFLOW_REF: \$\{\{ github\.workflow_ref \}\}/);
  assert.match(source, /\[\[ "\$EVENT_WORKFLOW" == "Daily Goal TASK-262 Real Stack" \]\]/);
  assert.match(source, /\[\[ "\$EVENT_WORKFLOW_REF" == "Hau-2251220056\/EngLish-Vocabulary\/\.github\/workflows\/daily-goal-task262-real-stack\.yml@\$EVENT_REF" \]\]/);
  assert.match(source, /\[\[ "\$WORKFLOW_SHA" == "\$EVENT_SHA" \]\]/);
  const attemptOneGuard = /\[\[ "\$EVENT_RUN_ATTEMPT" == "1" \]\] \|\| \{ echo "Refusal: workflow reruns are not authorized"; exit 1; \}/g;
  assert.equal((source.match(attemptOneGuard) ?? []).length, 2);
  const preflightJob = source.slice(source.indexOf("  preflight:"), source.indexOf("  task262-real-stack:"));
  const realStackJob = source.slice(source.indexOf("  task262-real-stack:"));
  assert.match(preflightJob, new RegExp(attemptOneGuard.source));
  assert.match(realStackJob, new RegExp(attemptOneGuard.source));
  assert.match(source, /ref: \$\{\{ github\.sha \}\}/);
  assert(source.indexOf("Refuse TASK-262 real-stack reruns before database-capable execution") < source.indexOf("Check out exact source revision"));
  assert.match(source, /Run TASK-262 source guards in real-stack job \(not offline-isolated\)/);
  assert(source.indexOf("Run TASK-262 source guards in real-stack job") < source.indexOf("Prepare exact reviewed 12-migration database"));
  assert.match(source, /name: Generate DG-1 raw-query client[\s\S]*?DAILY_GOAL_EPHEMERAL_JOB_DATABASE_URL: \$\{\{ env\.DAILY_GOAL_TASK262_JOB_DATABASE_URL \}\}/);
  assert(source.indexOf("Prepare exact reviewed 12-migration database") < source.indexOf("Generate guarded full-model client"));
  assert(source.indexOf("Generate guarded full-model client") < source.indexOf("Run guarded TASK-262 real-stack verification"));
});

test("integration source contract names all required reward and compatibility boundaries", async () => {
  const [reward, http, compatibility] = await Promise.all([
    readFile(path.join(here, "daily-goal-task262-reward.integration.test.js"), "utf8"),
    readFile(path.join(here, "daily-goal-task262-http.integration.test.js"), "utf8"),
    readFile(path.join(here, "daily-goal-task262-compatibility.integration.test.js"), "utf8"),
  ]);
  for (const token of ["599_999n", "600_000n", "runAtConcurrentTransactionStart", "transactionClientWithNotificationFailure", "dAILY_GOAL_REWARD", "uSER_NOTIFICATION", "projectXpLevel"]) assert.match(reward, new RegExp(token));
  for (const token of ["Promise.all", "OPERATION_CONFLICT", "durableSnapshot", "dAILY_GOAL_REWARD"]) assert.match(http, new RegExp(token.replace(".", "\\.")));
  for (const token of ["createLearningService", "createQuizService", "SRS_INITIAL", "SRS_DUE_REVIEW", "QUIZ_FIRST_CORRECT", "xP_REWARD", "sTREAK_DAY"]) assert.match(compatibility, new RegExp(token));
});

test("environment binding consumes every immutable identity field", () => {
  assert.deepEqual(bindingFromTask262Environment(environmentBinding()), binding());
});

function binding() {
  return { operation: TASK262_OPERATION, authorized: "true", repository: TASK262_REPOSITORY, sourceSha: SHA, sourceRef: TASK262_REF, workflowSha: SHA, runId: "501", runAttempt: "2", postgresqlMajor: "17" };
}
function environmentBinding() {
  return {
    DAILY_GOAL_TASK262_OPERATION: TASK262_OPERATION, DAILY_GOAL_TASK262_AUTHORIZED: "true",
    DAILY_GOAL_TASK262_REPOSITORY: TASK262_REPOSITORY, DAILY_GOAL_TASK262_SOURCE_SHA: SHA,
    DAILY_GOAL_TASK262_SOURCE_REF: TASK262_REF, DAILY_GOAL_TASK262_WORKFLOW_SHA: SHA,
    DAILY_GOAL_TASK262_RUN_ID: "501", DAILY_GOAL_TASK262_RUN_ATTEMPT: "2",
    DAILY_GOAL_TASK262_POSTGRESQL_MAJOR: "17",
  };
}
function categories() { return Object.fromEntries(TASK262_CATEGORIES.map((name) => [name, pass(1)])); }
function fakeAdapter(calls, options = {}) {
  const all = categories();
  const rewardCategories = [
    "firstSetup", "goalEdits", "heartbeatGoalRace", "rewardUniqueness",
    "notificationUniqueness", "levelProjection", "atomicRollback",
    "databaseUniqueness", "preGoalTime", "completionBoundary",
  ];
  return {
    async assertPrepared() { calls.push("prepared"); },
    async generateClient() { calls.push("generated"); },
    async runReward() { calls.push("reward"); if (options.error) throw options.error; return { ...pick(all, rewardCategories), ...options.reward }; },
    async runHttp() { calls.push("http"); return pick(all, ["replayConflictRetry"]); },
    async runCompatibility() { calls.push("compatibility"); return pick(all, ["srsCompatibility", "quizCompatibility", "streakIsolation"]); },
    async cleanup() { calls.push("cleanup"); if (options.cleanupError) throw new Error("hidden cleanup detail"); },
  };
}
function pick(source, keys) { return Object.fromEntries(keys.map((key) => [key, source[key]])); }
function pass(assertions) { return Object.freeze({ status: "PASS", assertions }); }
function localUrl() { return "postgresql://daily_goal_ephemeral:local-only@127.0.0.1:5432/daily_goal_ephemeral"; }
function fakePreparationPrisma(version, history) {
  let call = 0;
  return { async $queryRaw() { call += 1; return call === 1 ? [{ version }] : history; } };
}
