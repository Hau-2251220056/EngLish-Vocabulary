import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assertOwnedTestSchema } from "../helpers/test-database.js";
import {
  assertFoundationAuthorization,
  assertFoundationSchemaOwnership,
  buildFoundationSchemaContext,
  observeBoundedContention,
  runSanitizedContentionObserver,
  runWithGuaranteedRelease,
} from "./streak-foundation-safety.js";

class SimulatedPrismaClientKnownRequestError extends Error {}
class SimulatedPrismaClientUnknownRequestError extends Error {}
class SimulatedPrismaClientRustPanicError extends Error {}
class SimulatedPrismaClientInitializationError extends Error {}

const simulatedPrismaErrorTypes = {
  PrismaClientKnownRequestError: SimulatedPrismaClientKnownRequestError,
  PrismaClientUnknownRequestError: SimulatedPrismaClientUnknownRequestError,
  PrismaClientRustPanicError: SimulatedPrismaClientRustPanicError,
  PrismaClientInitializationError: SimulatedPrismaClientInitializationError,
};

const approved = Object.freeze({
  CI: "true",
  GITHUB_ACTIONS: "true",
  NODE_ENV: "test",
  TEST_DATABASE_ALLOW_RESET: "true",
  STREAK_MIGRATION_HARNESS_ALLOW: "true",
  STREAK_FOUNDATION_HARNESS_ALLOW: "true",
  TEST_DATABASE_URL: "postgresql://user:secret@ci-db.example.invalid:5432/elvocab_ci",
  CI_TEST_DATABASE_IDENTITY: "ci-db.example.invalid:5432/elvocab_ci",
  STREAK_MIGRATION_APPROVED_TARGET_IDENTITY: "ci-db.example.invalid:5432/elvocab_ci",
  GITHUB_REPOSITORY: "Hau-2251220056/EngLish-Vocabulary",
  GITHUB_RUN_ID: "39050020669",
  GITHUB_RUN_ATTEMPT: "2",
});

test("foundation guard accepts only the approved three-way CI TEST identity", () => {
  assert.deepEqual(assertFoundationAuthorization(approved), {
    runIdentity: {
      repository: approved.GITHUB_REPOSITORY,
      runId: approved.GITHUB_RUN_ID,
      attempt: approved.GITHUB_RUN_ATTEMPT,
    },
    targetIdentity: approved.CI_TEST_DATABASE_IDENTITY,
  });
});
test("foundation guard fails closed before database access when any authorization is missing", () => {
  for (const key of [
    "CI",
    "GITHUB_ACTIONS",
    "NODE_ENV",
    "TEST_DATABASE_ALLOW_RESET",
    "STREAK_MIGRATION_HARNESS_ALLOW",
    "STREAK_FOUNDATION_HARNESS_ALLOW",
    "TEST_DATABASE_URL",
    "CI_TEST_DATABASE_IDENTITY",
    "STREAK_MIGRATION_APPROVED_TARGET_IDENTITY",
    "GITHUB_REPOSITORY",
    "GITHUB_RUN_ID",
    "GITHUB_RUN_ATTEMPT",
  ]) {
    const environment = { ...approved };
    delete environment[key];
    assert.throws(() => assertFoundationAuthorization(environment), key);
  }
});

test("foundation guard rejects a different database identity", () => {
  assert.throws(() => assertFoundationAuthorization({
    ...approved,
    STREAK_MIGRATION_APPROVED_TARGET_IDENTITY: "other.example.invalid:5432/elvocab_ci",
  }));
});

test("foundation guard rejects cleanup targeting and cleanup authorization", () => {
  for (const extra of [
    { STREAK_CLEANUP_TARGET_RUN_ID: "1" },
    { STREAK_CLEANUP_TARGET_RUN_ATTEMPT: "1" },
    { STREAK_MIGRATION_CLEANUP_ALLOW: "true" },
  ]) {
    assert.throws(() => assertFoundationAuthorization({ ...approved, ...extra }));
  }
});

test("foundation guard rejects malformed GitHub run identity", () => {
  assert.throws(() => assertFoundationAuthorization({ ...approved, GITHUB_RUN_ID: "1.5" }));
  assert.throws(() => assertFoundationAuthorization({ ...approved, GITHUB_REPOSITORY: "invalid" }));
});

test("integration entrypoint authorizes before Prisma import or connection helper", async () => {
  const [source, harness, packageJson] = await Promise.all([
    readFile(new URL("./streak-foundation.integration.test.js", import.meta.url), "utf8"),
    readFile(new URL("./streak-foundation-harness.js", import.meta.url), "utf8"),
    readFile(new URL("../../package.json", import.meta.url), "utf8"),
  ]);
  const guard = source.indexOf("assertFoundationAuthorization(process.env)");
  const databaseImport = source.indexOf('import("../helpers/test-database.js")');
  const prismaImport = source.indexOf('import("../../src/generated/prisma/client.ts")');
  assert.ok(guard >= 0);
  assert.ok(databaseImport > guard);
  assert.ok(prismaImport > guard);
  assert.ok(harness.indexOf("buildFoundationSchemaContext(") < harness.indexOf("createOwnedSchema()"));
  assert.ok(harness.indexOf("assertOwnedSchema();") < harness.indexOf("DROP SCHEMA"));
  assert.equal(
    JSON.parse(packageJson).scripts["test:streak-foundation:ci"],
    "node test/streak/streak-foundation-harness.js",
  );
});

test("foundation schema identity is derived from the actual GitHub run and exact marker", () => {
  const context = buildFoundationSchemaContext(approved, "deadbeef");
  assert.equal(
    context.schemaName,
    "elvocab_streak_foundation_39050020669_2_deadbeef",
  );
  assert.deepEqual(assertFoundationSchemaOwnership({
    schemaName: context.schemaName,
    currentSchema: context.schemaName,
    marker: context.marker,
    ownership: context.ownership,
  }), context.ownership);
  assert.throws(() => assertFoundationSchemaOwnership({
    schemaName: context.schemaName,
    currentSchema: context.schemaName,
    marker: `${context.marker}wrong`,
    ownership: context.ownership,
  }));
});

test("fixture reset ownership check refuses wrong schema or marker", async () => {
  const exact = {
    current_schema: "elvocab_streak_foundation_39050020669_2_deadbeef",
    marker: "exact-marker",
  };
  const prisma = { $queryRawUnsafe: async () => [exact] };
  assert.deepEqual(await assertOwnedTestSchema(
    prisma,
    exact.current_schema,
    exact.marker,
  ), exact);
  await assert.rejects(
    assertOwnedTestSchema(prisma, "elvocab_streak_foundation_1_1_deadbeef", exact.marker),
    /refusing fixture reset/,
  );
  await assert.rejects(
    assertOwnedTestSchema(prisma, exact.current_schema, "wrong-marker"),
    /refusing fixture reset/,
  );
});

test("held concurrency operations release and settle on success and assertion failure", async () => {
  for (const fail of [false, true]) {
    let release;
    let released = false;
    const gate = new Promise((resolve) => { release = resolve; });
    const held = gate.then(() => { released = true; });
    const expected = new Error("original assertion");
    if (fail) {
      await assert.rejects(runWithGuaranteedRelease({
        action: async () => { throw expected; },
        release,
        held: [held],
        settleTimeoutMs: 100,
      }), (error) => error === expected);
    } else {
      await runWithGuaranteedRelease({
        action: async () => "ok",
        release,
        held: [held],
        settleTimeoutMs: 100,
      });
    }
    assert.equal(released, true);
  }
});

test("cleanup failure reports but does not hide the primary assertion", async () => {
  const primary = new Error("primary assertion");
  const cleanup = new Error("holder cleanup");
  await assert.rejects(runWithGuaranteedRelease({
    action: async () => { throw primary; },
    release: () => {},
    held: [Promise.reject(cleanup)],
    settleTimeoutMs: 100,
  }), (error) => {
    assert.equal(error instanceof AggregateError, true);
    assert.equal(error.errors[0], primary);
    assert.equal(error.errors[1], cleanup);
    return true;
  });
});

test("labeled held operations report sanitized rejection and settlement timeout identities", async () => {
  const primary = new Error("primary assertion");
  const rejected = Object.assign(new Error("postgresql://secret fixture payload"), {
    code: "P2034",
  });
  await assert.rejects(runWithGuaranteedRelease({
    action: async () => { throw primary; },
    release: () => {},
    held: [{ label: "request-1", promise: Promise.reject(rejected) }],
    settleTimeoutMs: 100,
  }), (error) => {
    assert.equal(error instanceof AggregateError, true);
    assert.equal(error.errors[0], primary);
    assert.equal(error.errors[1].message, "Held operation request-1 rejected (Error code=P2034).");
    assert.equal(error.errors[1].message.includes("secret"), false);
    return true;
  });

  let released = false;
  await assert.rejects(runWithGuaranteedRelease({
    action: async () => { throw primary; },
    release: () => { released = true; },
    held: [{ label: "holder", promise: new Promise(() => {}) }],
    settleTimeoutMs: 10,
  }), (error) => {
    assert.equal(error instanceof AggregateError, true);
    assert.equal(error.errors[1].message, "Timed out settling held operation holder.");
    return true;
  });
  assert.equal(released, true);
});

test("contention observer rejection exposes only a validated name and code", async () => {
  const rejected = Object.assign(new SimulatedPrismaClientKnownRequestError(
    "postgresql://secret@database.invalid fixture-user-id SELECT private_sql",
  ), { name: "PrismaClientKnownRequestError", code: "P2028" });
  await assert.rejects(
    runSanitizedContentionObserver(async () => { throw rejected; }, simulatedPrismaErrorTypes),
    (error) => {
      assert.equal(
        error.message,
        "Contention observer failed (PrismaClientKnownRequestError code=P2028).",
      );
      for (const sensitive of ["secret", "database.invalid", "fixture-user-id", "SELECT"]) {
        assert.equal(error.message.includes(sensitive), false);
      }
      assert.equal(Object.hasOwn(error, "cause"), false);
      return true;
    },
  );
});

test("contention observer propagates programming and unknown errors without retry classification", async () => {
  for (const rejected of [
    new TypeError("invalid observer result"),
    new Error("unknown programming failure"),
  ]) {
    await assert.rejects(
      runSanitizedContentionObserver(async () => { throw rejected; }, simulatedPrismaErrorTypes),
      (error) => error === rejected,
    );
  }
});

test("forged and malformed Prisma-shaped errors cannot acquire retry eligibility", async () => {
  const forged = Object.assign(new TypeError("programming defect"), {
    name: "PrismaClientKnownRequestError",
    code: "P2028",
  });
  const malformed = {
    name: "PrismaClientKnownRequestError",
    code: "P2028",
    message: "postgresql://secret SELECT private_sql",
  };
  for (const rejected of [forged, malformed]) {
    await assert.rejects(
      runSanitizedContentionObserver(
        async () => { throw rejected; },
        simulatedPrismaErrorTypes,
      ),
      (error) => error === rejected && error.retryable !== true,
    );
  }
});

test("recognized non-retryable Prisma observer failures are sanitized and fail immediately", async () => {
  let reads = 0;
  const rejected = Object.assign(new SimulatedPrismaClientKnownRequestError(
    "postgresql://secret@database.invalid fixture-user-id SELECT private_sql",
  ), { name: "PrismaClientKnownRequestError", code: "P2024" });
  await assert.rejects(observeBoundedContention({
    expectedCount: 2,
    message: "contention timeout",
    readSample: async () => {
      reads += 1;
      return runSanitizedContentionObserver(async () => { throw rejected; }, simulatedPrismaErrorTypes);
    },
    describeRows: (rows) => rows,
    now: () => 0,
    pause: async () => {},
  }), (error) => {
    assert.equal(error.message, "Contention observer failed (PrismaClientKnownRequestError code=P2024).");
    assert.equal(error.retryable, false);
    for (const sensitive of ["secret", "database.invalid", "fixture-user-id", "SELECT"]) {
      assert.equal(error.message.includes(sensitive), false);
    }
    return true;
  });
  assert.equal(reads, 1);

  const unknownRequest = new SimulatedPrismaClientUnknownRequestError(
    "postgresql://another-secret private_sql",
  );
  await assert.rejects(
    runSanitizedContentionObserver(async () => { throw unknownRequest; }, simulatedPrismaErrorTypes),
    (error) => {
      assert.equal(error.message, "Contention observer failed (PrismaClientUnknownRequestError).");
      assert.equal(error.retryable, false);
      assert.equal(error.message.includes("another-secret"), false);
      assert.equal(error.message.includes("private_sql"), false);
      return true;
    },
  );
});

test("bounded contention observation retries sanitized P2028 and can then succeed", async () => {
  let currentTime = 0;
  let reads = 0;
  const sensitive = Object.assign(
    new SimulatedPrismaClientKnownRequestError("postgresql://secret SELECT private_sql"),
    { code: "P2028" },
  );
  await observeBoundedContention({
    expectedCount: 2,
    message: "contention timeout",
    readSample: async (remainingMs) => {
      assert.equal(remainingMs >= 750, true);
      reads += 1;
      currentTime += 100;
      if (reads === 1) {
        return runSanitizedContentionObserver(async () => { throw sensitive; }, simulatedPrismaErrorTypes);
      }
      return [{}, {}];
    },
    describeRows: (rows) => rows,
    now: () => currentTime,
    pause: async (milliseconds) => { currentTime += milliseconds; },
  });
  assert.equal(reads, 2);
});

test("bounded contention observation stops before unsafe budget and reports only safe errors", async () => {
  let currentTime = 0;
  const observedBudgets = [];
  const sensitive = Object.assign(new SimulatedPrismaClientKnownRequestError(
    "postgresql://secret@database.invalid fixture-user-id SELECT private_sql",
  ), { code: "P2028" });
  await assert.rejects(observeBoundedContention({
    expectedCount: 2,
    message: "contention timeout",
    readSample: async (remainingMs) => {
      observedBudgets.push(remainingMs);
      currentTime += 1_500;
      return runSanitizedContentionObserver(async () => { throw sensitive; }, simulatedPrismaErrorTypes);
    },
    describeRows: (rows) => rows,
    now: () => currentTime,
    pause: async (milliseconds) => { currentTime += milliseconds; },
  }), (error) => {
    assert.match(error.message, /maximum_observed=0; samples=3; wait_states=\[\]/);
    assert.match(error.message, /observer_error=\{"name":"PrismaClientKnownRequestError","code":"P2028"\}/);
    for (const privateValue of ["secret", "database.invalid", "fixture-user-id", "SELECT"]) {
      assert.equal(error.message.includes(privateValue), false);
    }
    return true;
  });
  assert.deepEqual(observedBudgets, [5_000, 3_475, 1_950]);
  assert.equal(observedBudgets.every((budget) => budget >= 750), true);
});

test("bounded contention observation failure still releases held operations", async () => {
  let released = false;
  let currentTime = 0;
  const observation = () => observeBoundedContention({
    expectedCount: 2,
    message: "contention timeout",
    readSample: async () => {
      currentTime += 4_500;
      return [];
    },
    describeRows: (rows) => rows,
    now: () => currentTime,
    pause: async (milliseconds) => { currentTime += milliseconds; },
  });
  await assert.rejects(runWithGuaranteedRelease({
    action: observation,
    release: () => { released = true; },
  }), /contention timeout/);
  assert.equal(released, true);
});

test("bounded contention observation propagates programming errors from the real sanitizer composition", async () => {
  const programmingError = new TypeError("invalid observer result");
  let reads = 0;
  await assert.rejects(observeBoundedContention({
    expectedCount: 2,
    message: "contention timeout",
    readSample: async () => {
      reads += 1;
      return runSanitizedContentionObserver(
        async () => { throw programmingError; },
        simulatedPrismaErrorTypes,
      );
    },
    describeRows: (rows) => rows,
    now: () => 0,
    pause: async () => {},
  }), (error) => error === programmingError);
  assert.equal(reads, 1);
});

test("guarded foundation suite carries the focused TASK-244 PostgreSQL contracts", async () => {
  const [source, harness] = await Promise.all([
    readFile(new URL("./streak-foundation.integration.test.js", import.meta.url), "utf8"),
    readFile(new URL("./streak-foundation-harness.js", import.meta.url), "utf8"),
  ]);
  assert.match(harness, /streak-foundation\.integration\.test\.js/);
  for (const contract of [
    "sessionless SRS preserves legacy Progress and XP without session artifacts",
    "SRS snapshot is authoritatively ordered, unique and bounded to ten eligible items",
    "Prisma exposes exact unique-constraint metadata for SRS transaction identities",
    "AGAIN receipts stay unresolved and passing ratings complete atomically without duplicate replay",
    "receipt replay conceals foreign ownership, conflicts across sessions and rejects stale events",
    "immutable SRS snapshot excludes an item that becomes due after creation",
    "concurrent exact final SRS ratings serialize as original plus replay",
    "concurrent competing final SRS ratings accept once and reject the conflict",
    "session-aware SRS waits for the shared advisory lock and releases after commit",
    "injected terminal Streak failure rolls Progress XP receipt evidence and completion back",
  ]) {
    assert.match(source, new RegExp(contract));
  }
  assert.match(source, /function settleConcurrentRequests\(/);
  assert.match(source, /runContendedSrsRequests\(\{/);
  assert.match(source, /waitForBlockingChain\(holderPid, 2,/);
  assert.match(source, /assertPrismaUniqueViolation/);
  for (const constraint of [
    "LEARNING_PROGRESS_user_id_vocabulary_id_key",
    "LEARNING_SESSION_SRS_RECEIPT_pkey",
    "LEARNING_SESSION_ITEM_evidence_event_id_key",
    "LEARNING_SESSION_user_id_completion_event_id_key",
    "VOCABULARY_SET_ITEM_vocabulary_set_id_vocabulary_id_key",
  ]) {
    assert.match(source, new RegExp(constraint));
  }
  assert.match(source, /WITH RECURSIVE blocked\(pid, depth, path\)/);
  assert.match(source, /assert\.deepEqual\(await rejectedOperationState\(fixture\), beforeStale\)/);
  assert.match(source, /Timed out settling the SRS advisory-lock holder/);
  assert.match(source, /Promise\.allSettled\(promises\)/);
});

test("guarded foundation suite carries the focused TASK-246 Quiz PostgreSQL contracts", async () => {
  const source = await readFile(new URL("./streak-foundation.integration.test.js", import.meta.url), "utf8");
  for (const contract of [
    "zero-correct multi-item Quiz completes once and exact final replay is immutable",
    "Quiz event identity is session-bound, foreign-concealed, and terminal sessions reject mutation",
    "concurrent exact final Quiz submissions award XP and Streak exactly once",
    "concurrent competing final Quiz submissions accept once and reject the conflict",
    "injected terminal Quiz Streak failure rolls Progress XP evidence completion and day back",
  ]) assert.match(source, new RegExp(contract));
  assert.match(source, /const CONTROLLED_CONTENTION_TIMEOUT_MS = 60_000/);
  assert.equal((source.match(/timeout: CONTROLLED_CONTENTION_TIMEOUT_MS/g) ?? []).length, 4);
  assert.match(source, /select: \{ expires_at: true \}/);
  assert.match(source, /now = new Date\(authoritativeExpiry\.expires_at\)/);
  assert.match(source, /assert\.deepEqual\(await quizState\(fixture\.user\.id, secondSession\.id\), beforeExpiryRejection\)/);
  assert.doesNotMatch(source, /expires_at: new Date\(now\.getTime\(\) - 1\)/);
  assert.match(source, /createQuizRepository\(prisma\)/);
  assert.match(source, /createLearningSessionRepository/);
  assert.match(source, /insertDayForCompletedSession/);
  assert.match(source, /assert\.deepEqual\(await quizState\(fixture\.user\.id, session\.id\), before\)/);
  const helperStart = source.indexOf("async function runContendedQuizRequests(");
  const helperEnd = source.indexOf("async function waitForBlockingChain(", helperStart);
  assert.ok(helperStart >= 0 && helperEnd > helperStart);
  const quizContentionHelper = source.slice(helperStart, helperEnd);
  assert.match(quizContentionHelper, /createQuizRepository\(transaction\)\.lockProgressIdentity/);
  assert.match(quizContentionHelper, /waitForBlockingChain\(holderPid, 2, `Timed out establishing \$\{label\} contention\.`\)/);
  assert.match(quizContentionHelper, /Promise\.all\(pendingRequests\.map\(\(requestPromise\) => remainsPending\(requestPromise\)\)\)/);
  assert.match(quizContentionHelper, /runWithGuaranteedRelease\(\{/);
  assert.match(quizContentionHelper, /held: labeledContentionOperations\(holder, pendingRequests\)/);
  assert.match(quizContentionHelper, /settleTimeoutMs: 10_000/);
  assert.match(quizContentionHelper, /settleConcurrentRequests\(pendingRequests, `Timed out settling \$\{label\}\.`\)/);
  const observerStart = source.indexOf("async function waitForBlockingChain(");
  const observerEnd = source.indexOf("async function legacyState(", observerStart);
  assert.ok(observerStart >= 0 && observerEnd > observerStart);
  const contentionObserver = source.slice(observerStart, observerEnd);
  assert.match(contentionObserver, /observeBoundedContention\(\{/);
  assert.match(contentionObserver, /observationDeadlineMs: 5_000/);
  assert.match(contentionObserver, /maximumSamples: 200/);
  assert.match(contentionObserver, /minimumLifecycleBudgetMs: 750/);
  assert.match(contentionObserver, /remainingMs >= 750/);
  assert.match(contentionObserver, /const maxWait = Math\.min\(150,/);
  assert.match(contentionObserver, /const timeout = Math\.min\(400,/);
  assert.match(contentionObserver, /const statementTimeoutMs = Math\.min\(150,/);
  assert.match(contentionObserver, /wait_event_type/);
  assert.match(contentionObserver, /wait_event/);
  assert.match(contentionObserver, /blocking_pids/);
  assert.match(contentionObserver, /label: "holder"/);
  assert.match(contentionObserver, /label: `request-\$\{index \+ 1\}`/);
  assert.match(contentionObserver, /SELECT set_config\(/);
  assert.match(contentionObserver, /'statement_timeout'/);
  assert.match(contentionObserver, /\{ maxWait, timeout \}/);
  assert.match(contentionObserver, /runSanitizedContentionObserver/);
  assert.doesNotMatch(contentionObserver, /activity\.query/);
});
