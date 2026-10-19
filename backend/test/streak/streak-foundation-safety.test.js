import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assertOwnedTestSchema } from "../helpers/test-database.js";
import {
  assertFoundationAuthorization,
  assertFoundationSchemaOwnership,
  buildFoundationObserverDatabaseUrl,
  buildFoundationSchemaContext,
  CONTENTION_OBSERVER_MIN_LIFECYCLE_BUDGET_MS,
  connectFoundationObserver,
  contentionObserverTransactionPolicy,
  describeContentionWaitStates,
  FoundationObserverSetupError,
  observeBoundedContention,
  runFoundationCleanup,
  runSanitizedContentionObserver,
  runWithGuaranteedRelease,
  SanitizedContentionObserverError,
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

const approvedSchema = "elvocab_streak_foundation_39050020669_2_deadbeef";
const approvedScoped = Object.freeze({
  ...approved,
  TEST_DATABASE_URL: `${approved.TEST_DATABASE_URL}?schema=${approvedSchema}`,
  STREAK_FOUNDATION_SCHEMA_NAME: approvedSchema,
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

test("dedicated observer URL stays on the authorized run-owned schema with one bounded connection", () => {
  const observerUrl = new URL(buildFoundationObserverDatabaseUrl(approvedScoped));
  assert.equal(observerUrl.protocol, "postgresql:");
  assert.equal(observerUrl.hostname, "ci-db.example.invalid");
  assert.equal(observerUrl.pathname, "/elvocab_ci");
  assert.equal(observerUrl.searchParams.get("schema"), approvedSchema);
  assert.equal(observerUrl.searchParams.get("connection_limit"), "1");
  assert.equal(observerUrl.searchParams.get("connect_timeout"), "5");
  assert.equal(observerUrl.searchParams.get("pool_timeout"), "5");
});

test("dedicated observer URL validation fails closed without exposing connection secrets", () => {
  for (const environment of [
    { ...approvedScoped, TEST_DATABASE_URL: "not a database URL containing secret-value" },
    { ...approvedScoped, TEST_DATABASE_URL: `${approved.TEST_DATABASE_URL}?schema=public` },
    { ...approvedScoped, TEST_DATABASE_URL: `mysql://user:secret-value@ci-db.example.invalid/elvocab_ci?schema=${approvedSchema}` },
  ]) {
    assert.throws(() => buildFoundationObserverDatabaseUrl(environment), (error) => {
      assert.equal(error.message.includes("secret-value"), false);
      assert.equal(error.message.includes(approvedScoped.TEST_DATABASE_URL), false);
      return true;
    });
  }
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
    assert.equal(
      error.message,
      "Primary operation failed: primary assertion; cleanup=operation-1=rejected(Error)",
    );
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
    assert.equal(
      error.message,
      "Primary operation failed: primary assertion; cleanup=request-1=rejected(Error code=P2034)",
    );
    assert.equal(error.message.includes("secret"), false);
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
    assert.equal(
      error.message,
      "Primary operation failed: primary assertion; cleanup=holder=timeout",
    );
    return true;
  });
  assert.equal(released, true);
});

test("successful primary reports every cleanup failure with bounded sanitized identities", async () => {
  const observed = [];
  const sensitive = Object.assign(new Error("postgresql://secret SELECT private_sql fixture-id"), {
    code: "P2034",
  });
  const maliciousCode = Object.assign(new Error("credential-value"), {
    name: "Unsafe Name",
    code: "P2028 secret-url",
  });
  await assert.rejects(runWithGuaranteedRelease({
    action: async () => "ok",
    release: () => { observed.push("release"); },
    held: [
      { label: "holder", promise: Promise.reject(sensitive).finally(() => observed.push("holder")) },
      { label: "request-1", promise: Promise.reject(maliciousCode).finally(() => observed.push("request-1")) },
      { label: "request-2", promise: new Promise(() => {}).finally(() => observed.push("request-2")) },
    ],
    settleTimeoutMs: 10,
  }), (error) => {
    assert.equal(error instanceof AggregateError, true);
    assert.equal(error.errors.length, 3);
    assert.equal(error.errors[0].message, "Held operation holder rejected (Error code=P2034).");
    assert.equal(error.errors[1].message, "Held operation request-1 rejected (Error).");
    assert.equal(error.errors[2].message, "Timed out settling held operation request-2.");
    assert.equal(
      error.message,
      "Held operation cleanup failed: holder=rejected(Error code=P2034); request-1=rejected(Error); request-2=timeout.",
    );
    for (const privateValue of ["secret", "private_sql", "fixture-id", "credential-value", "secret-url"]) {
      assert.equal(error.message.includes(privateValue), false);
    }
    return true;
  });
  assert.deepEqual(observed.slice(0, 3).sort(), ["holder", "release", "request-1"]);
});

test("release failure summary is sanitized and held cleanup still completes", async () => {
  const releaseError = Object.assign(new Error("postgresql://secret release payload"), {
    code: "P2034",
  });
  let heldSettled = false;
  await assert.rejects(runWithGuaranteedRelease({
    action: async () => "ok",
    release: () => { throw releaseError; },
    held: [Promise.resolve().then(() => { heldSettled = true; })],
    settleTimeoutMs: 100,
  }), (error) => {
    assert.equal(error instanceof AggregateError, true);
    assert.equal(error.errors.length, 1);
    assert.equal(error.errors[0], releaseError);
    assert.equal(error.message, "Held operation cleanup failed: release=release-failed(Error code=P2034).");
    assert.equal(error.message.includes("secret"), false);
    return true;
  });
  assert.equal(heldSettled, true);
});

test("hostile release error properties cannot interrupt held settlement", async () => {
  for (const hostileProperty of ["name", "code"]) {
    const releaseError = new Error("postgresql://secret release payload");
    Object.defineProperty(releaseError, hostileProperty, {
      configurable: true,
      get() { throw new Error(`sensitive-${hostileProperty}`); },
    });
    const settled = [];
    await assert.rejects(runWithGuaranteedRelease({
      action: async () => "ok",
      release: () => { throw releaseError; },
      held: [
        Promise.resolve().then(() => settled.push("before")),
        Promise.resolve().then(() => settled.push("after")),
      ],
      settleTimeoutMs: 100,
    }), (error) => {
      assert.equal(error instanceof AggregateError, true);
      assert.deepEqual(error.errors, [releaseError]);
      assert.equal(
        error.message,
        "Held operation cleanup failed: release=release-failed(Error).",
      );
      assert.equal(error.message.includes("secret"), false);
      assert.equal(error.message.includes(`sensitive-${hostileProperty}`), false);
      return true;
    });
    assert.deepEqual(settled, ["before", "after"]);
  }
});

test("hostile held rejection and malformed metadata remain isolated and sanitized", async () => {
  const hostileRejection = new Proxy(new Error("postgresql://secret held payload"), {
    get(target, property, receiver) {
      if (property === "name" || property === "code") throw new Error(`sensitive-${String(property)}`);
      return Reflect.get(target, property, receiver);
    },
  });
  const hostileValidationError = {};
  Object.defineProperties(hostileValidationError, {
    name: { get() { throw new Error("sensitive-validation-name"); } },
    code: { get() { throw new Error("sensitive-validation-code"); } },
  });
  const malformedEntry = {
    get label() { throw hostileValidationError; },
    promise: Promise.resolve(),
  };
  const settled = [];
  await assert.rejects(runWithGuaranteedRelease({
    action: async () => "ok",
    release: () => {},
    held: [
      Promise.resolve().then(() => settled.push("before")),
      Promise.reject(hostileRejection),
      malformedEntry,
      Promise.resolve().then(() => settled.push("after")),
    ],
    settleTimeoutMs: 100,
  }), (error) => {
    assert.equal(error instanceof AggregateError, true);
    assert.equal(error.errors.length, 2);
    assert.equal(error.errors[0], hostileRejection);
    assert.equal(error.errors[1], hostileValidationError);
    assert.equal(
      error.message,
      "Held operation cleanup failed: operation-2=rejected(Error); operation-3=rejected(Error).",
    );
    for (const sensitive of ["secret", "sensitive-name", "sensitive-code", "sensitive-validation"]) {
      assert.equal(error.message.includes(sensitive), false);
    }
    return true;
  });
  assert.deepEqual(settled, ["before", "after"]);
});

test("primary failure remains aggregated with hostile cleanup metadata", async () => {
  const primary = new Error("primary assertion");
  const cleanup = new Proxy(new Error("postgresql://secret cleanup payload"), {
    get(target, property, receiver) {
      if (property === "name" || property === "code") throw new Error("sensitive-accessor");
      return Reflect.get(target, property, receiver);
    },
  });
  await assert.rejects(runWithGuaranteedRelease({
    action: async () => { throw primary; },
    release: () => {},
    held: [Promise.reject(cleanup)],
    settleTimeoutMs: 100,
  }), (error) => {
    assert.equal(error instanceof AggregateError, true);
    assert.equal(error.errors[0], primary);
    assert.equal(error.errors[1], cleanup);
    assert.equal(
      error.message,
      "Primary operation failed: primary assertion; cleanup=operation-1=rejected(Error)",
    );
    assert.equal(error.message.includes("secret"), false);
    assert.equal(error.message.includes("sensitive-accessor"), false);
    return true;
  });
});

test("cleanup summary is capped while every held failure remains preserved", async () => {
  const failures = Array.from({ length: 12 }, (_, index) => new Error(`private-${index + 1}`));
  const settled = [];
  await assert.rejects(runWithGuaranteedRelease({
    action: async () => "ok",
    release: () => {},
    held: failures.map((failure, index) => Promise.reject(failure)
      .finally(() => settled.push(index + 1))),
    settleTimeoutMs: 100,
  }), (error) => {
    assert.equal(error instanceof AggregateError, true);
    assert.equal(error.errors.length, 12);
    assert.deepEqual(error.errors, failures);
    assert.equal(
      error.message,
      "Held operation cleanup failed: operation-1=rejected(Error); operation-2=rejected(Error); operation-3=rejected(Error); operation-4=rejected(Error); operation-5=rejected(Error); operation-6=rejected(Error); operation-7=rejected(Error); operation-8=rejected(Error); additional=4.",
    );
    for (const failure of failures) assert.equal(error.message.includes(failure.message), false);
    return true;
  });
  assert.deepEqual(settled.sort((left, right) => left - right), Array.from({ length: 12 }, (_, index) => index + 1));
});

test("malformed held entries are isolated at every position while valid neighbors settle", async () => {
  for (const malformedIndex of [0, 1, 2]) {
    const released = { value: false };
    let releaseGate;
    const gate = new Promise((resolve) => { releaseGate = resolve; });
    const settled = [];
    const validationErrors = [];
    const entries = [0, 1, 2].map((index) => {
      if (index === malformedIndex) return { label: "unsafe-label", promise: Promise.resolve() };
      return gate.then(() => {
        assert.equal(released.value, true);
        settled.push(index);
      });
    });
    await assert.rejects(runWithGuaranteedRelease({
      action: async () => { throw new Error("primary assertion"); },
      release: () => {
        released.value = true;
        releaseGate();
      },
      held: entries,
      settleTimeoutMs: 100,
    }), (error) => {
      assert.equal(error instanceof AggregateError, true);
      assert.equal(error.errors.length, 2);
      assert.equal(error.errors[0].message, "primary assertion");
      assert.equal(error.errors[1].name, "AssertionError");
      validationErrors.push(error.errors[1]);
      assert.equal(
        error.message,
        `Primary operation failed: primary assertion; cleanup=operation-${malformedIndex + 1}=rejected(AssertionError code=ERR_ASSERTION)`,
      );
      assert.equal(error.message.includes("unsafe-label"), false);
      return true;
    });
    assert.equal(validationErrors.length, 1);
    assert.deepEqual(settled.sort(), [0, 1, 2].filter((index) => index !== malformedIndex));
  }
});

test("foundation cleanup attempts eligible resources in order and skips absent resources", async () => {
  const calls = [];
  await runFoundationCleanup({
    operations: [
      null,
      async () => { calls.push("observer"); },
      undefined,
      async () => { calls.push("peer"); },
      async () => { calls.push("database"); },
    ],
  });
  assert.deepEqual(calls, ["observer", "peer", "database"]);
});

test("foundation cleanup preserves one disconnect failure while completing later cleanup", async () => {
  const observerFailure = new Error("observer disconnect failed");
  const calls = [];
  await assert.rejects(runFoundationCleanup({
    operations: [
      async () => { calls.push("observer"); throw observerFailure; },
      async () => { calls.push("peer"); },
      async () => { calls.push("database"); },
    ],
  }), (error) => error === observerFailure);
  assert.deepEqual(calls, ["observer", "peer", "database"]);
});

test("foundation cleanup aggregates two and three disconnect failures without replacement", async () => {
  for (const failingResources of [
    ["observer", "peer"],
    ["observer", "peer", "database"],
  ]) {
    const calls = [];
    const failures = failingResources.map((resource) => new Error(`${resource} failure`));
    let failureIndex = 0;
    await assert.rejects(runFoundationCleanup({
      operations: ["observer", "peer", "database"].map((resource) => async () => {
        calls.push(resource);
        if (failingResources.includes(resource)) throw failures[failureIndex++];
      }),
    }), (error) => {
      assert.equal(error instanceof AggregateError, true);
      assert.deepEqual(error.errors, failures);
      return true;
    });
    assert.deepEqual(calls, ["observer", "peer", "database"]);
  }
});

test("foundation cleanup preserves a primary failure with later cleanup failures", async () => {
  const primaryFailure = new Error("setup failed");
  const cleanupFailure = new Error("observer cleanup failed");
  const calls = [];
  await assert.rejects(runFoundationCleanup({
    primaryError: primaryFailure,
    operations: [
      async () => { calls.push("observer"); throw cleanupFailure; },
      async () => { calls.push("peer"); },
    ],
  }), (error) => {
    assert.equal(error instanceof AggregateError, true);
    assert.deepEqual(error.errors, [primaryFailure, cleanupFailure]);
    return true;
  });
  assert.deepEqual(calls, ["observer", "peer"]);
});

test("failed observer connect with successful cleanup clears the reference without duplicate disconnect", async () => {
  const connectionFailure = new Error("observer connection failed");
  const calls = [];
  let observerReference;
  const partialObserver = {
    async $connect() {
      calls.push("connect");
      throw connectionFailure;
    },
    async $disconnect() {
      calls.push("disconnect");
    },
  };
  observerReference = partialObserver;
  await assert.rejects(connectFoundationObserver(partialObserver, {
    onDisconnected: () => { observerReference = undefined; },
  }), (error) => {
    assert.equal(error instanceof FoundationObserverSetupError, true);
    assert.equal(error.disconnectCompleted, true);
    assert.deepEqual(error.errors, [connectionFailure]);
    return true;
  });
  assert.equal(observerReference, undefined);
  await runFoundationCleanup({
    operations: [observerReference ? () => observerReference.$disconnect() : null],
  });
  assert.deepEqual(calls, ["connect", "disconnect"]);
});

test("successful observer connection retains its reference for one normal teardown", async () => {
  const calls = [];
  let observerReference;
  const observer = {
    async $connect() { calls.push("connect"); },
    async $disconnect() { calls.push("disconnect"); },
  };
  observerReference = observer;
  assert.equal(await connectFoundationObserver(observer, {
    onDisconnected: () => { observerReference = undefined; },
  }), observer);
  assert.equal(observerReference, observer);
  await runFoundationCleanup({
    operations: [() => observerReference.$disconnect()],
  });
  assert.deepEqual(calls, ["connect", "disconnect"]);
});

test("failed observer connect and disconnect retains reference for final teardown", async () => {
  const connectionFailure = new Error("observer connection failed");
  const immediateDisconnectFailure = new Error("partial observer disconnect failed");
  const finalDisconnectFailure = new Error("final observer disconnect failed");
  const calls = [];
  let disconnectAttempts = 0;
  let observerReference;
  const partialObserver = {
    async $connect() {
      calls.push("connect");
      throw connectionFailure;
    },
    async $disconnect() {
      calls.push("disconnect");
      disconnectAttempts += 1;
      throw disconnectAttempts === 1 ? immediateDisconnectFailure : finalDisconnectFailure;
    },
  };
  observerReference = partialObserver;
  let setupFailure;
  await assert.rejects(connectFoundationObserver(partialObserver, {
    onDisconnected: () => { observerReference = undefined; },
  }), (error) => {
    setupFailure = error;
    assert.equal(error instanceof FoundationObserverSetupError, true);
    assert.equal(error.disconnectCompleted, false);
    assert.deepEqual(error.errors, [connectionFailure, immediateDisconnectFailure]);
    return true;
  });
  assert.equal(observerReference, partialObserver);
  await assert.rejects(runFoundationCleanup({
    primaryError: setupFailure,
    operations: [
      () => observerReference.$disconnect(),
      async () => { calls.push("peer"); },
      async () => { calls.push("database"); },
    ],
  }), (error) => {
    assert.equal(error instanceof AggregateError, true);
    assert.deepEqual(error.errors, [setupFailure, finalDisconnectFailure]);
    assert.deepEqual(setupFailure.errors, [connectionFailure, immediateDisconnectFailure]);
    return true;
  });
  assert.deepEqual(calls, ["connect", "disconnect", "disconnect", "peer", "database"]);
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

test("contention observer reports bounded lifecycle phases without sensitive error text", async () => {
  const cases = [
    ["transaction-acquisition", () => {}],
    ["statement-timeout-started", (phase) => {
      phase.callbackEntered();
      phase.statementTimeoutStarted();
    }],
    ["blocking-query-started", (phase) => {
      phase.callbackEntered();
      phase.statementTimeoutStarted();
      phase.statementTimeoutCompleted();
      phase.blockingQueryStarted();
    }],
    ["transaction-closure", (phase) => {
      phase.callbackEntered();
      phase.statementTimeoutStarted();
      phase.statementTimeoutCompleted();
      phase.blockingQueryStarted();
      phase.blockingQueryCompleted();
      phase.callbackReturned();
    }],
  ];
  for (const [expectedPhase, advancePhase] of cases) {
    const sensitive = Object.assign(new SimulatedPrismaClientKnownRequestError(
      "postgresql://secret@database.invalid SELECT private_sql fixture-user-id",
    ), { code: "P2028" });
    const times = [0, 149];
    await assert.rejects(runSanitizedContentionObserver((phase) => {
      advancePhase(phase);
      throw sensitive;
    }, simulatedPrismaErrorTypes, {
      now: () => times.shift(),
    }), (error) => {
      assert.equal(error.safePhase, expectedPhase);
      assert.equal(error.elapsedBucket, "50-149ms");
      assert.equal(error.retryable, true);
      for (const privateValue of ["secret", "database.invalid", "SELECT", "fixture-user-id"]) {
        assert.equal(error.message.includes(privateValue), false);
      }
      return true;
    });
  }
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
  const summary = await observeBoundedContention({
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
  assert.deepEqual(summary, {
    attempts: 2,
    successfulSamples: 1,
    insufficientSamples: 0,
    retryableP2028Failures: 1,
  });
});

test("contention observer policy reserves the hosted-CI closure lifecycle budget", async () => {
  assert.equal(CONTENTION_OBSERVER_MIN_LIFECYCLE_BUDGET_MS, 4_000);
  assert.throws(
    () => contentionObserverTransactionPolicy(3_999),
    { name: "AssertionError" },
  );
  for (const remainingMs of [4_000, 5_000]) {
    const policy = contentionObserverTransactionPolicy(remainingMs);
    assert.deepEqual(policy, {
      maxWait: 2_000,
      timeout: 1_500,
      statementTimeoutMs: 150,
      completionMarginMs: 500,
    });
    assert.equal(policy.maxWait + policy.timeout + policy.completionMarginMs <= remainingMs, true);
    assert.equal(policy.statementTimeoutMs <= policy.timeout - 150, true);
  }

  let currentTime = 0;
  const observedBudgets = [];
  const retryable = new SanitizedContentionObserverError(
    "PrismaClientKnownRequestError",
    "P2028",
    true,
    "transaction-closure",
    "750ms-or-more",
  );
  await assert.rejects(observeBoundedContention({
    expectedCount: 2,
    message: "bounded acquisition",
    readSample: async (remainingMs) => {
      observedBudgets.push(remainingMs);
      contentionObserverTransactionPolicy(remainingMs);
      currentTime += 3_500;
      throw retryable;
    },
    describeRows: (rows) => rows,
    now: () => currentTime,
    pause: async (milliseconds) => { currentTime += milliseconds; },
    observationDeadlineMs: 5_000,
    minimumLifecycleBudgetMs: CONTENTION_OBSERVER_MIN_LIFECYCLE_BUDGET_MS,
  }), /bounded acquisition/);
  assert.deepEqual(observedBudgets, [5_000]);
  assert.equal(observedBudgets.every(
    (budget) => budget >= CONTENTION_OBSERVER_MIN_LIFECYCLE_BUDGET_MS,
  ), true);
});

test("extended contention observation survives request-arrival delay and remains bounded", async () => {
  let currentTime = 0;
  const observedBudgets = [];
  let reads = 0;
  const summary = await observeBoundedContention({
    expectedCount: 2,
    message: "delayed contention",
    readSample: async (remainingMs) => {
      observedBudgets.push(remainingMs);
      reads += 1;
      currentTime += reads < 3 ? 2_500 : 500;
      return reads < 3 ? [] : [{}, {}];
    },
    describeRows: (rows) => rows,
    now: () => currentTime,
    pause: async (milliseconds) => { currentTime += milliseconds; },
    observationDeadlineMs: 10_000,
    maximumSamples: 200,
    minimumLifecycleBudgetMs: CONTENTION_OBSERVER_MIN_LIFECYCLE_BUDGET_MS,
  });
  assert.deepEqual(summary, {
    attempts: 3,
    successfulSamples: 3,
    insufficientSamples: 2,
    retryableP2028Failures: 0,
  });
  assert.deepEqual(observedBudgets, [10_000, 7_475, 4_950]);
  assert.equal(observedBudgets.every(
    (budget) => budget >= CONTENTION_OBSERVER_MIN_LIFECYCLE_BUDGET_MS,
  ), true);
  assert.equal(currentTime > 5_000, true);

  currentTime = 0;
  const emptyBudgets = [];
  await assert.rejects(observeBoundedContention({
    expectedCount: 2,
    message: "bounded empty contention",
    readSample: async (remainingMs) => {
      emptyBudgets.push(remainingMs);
      currentTime += 2_500;
      return [];
    },
    describeRows: (rows) => rows,
    now: () => currentTime,
    pause: async (milliseconds) => { currentTime += milliseconds; },
    observationDeadlineMs: 10_000,
    maximumSamples: 200,
    minimumLifecycleBudgetMs: CONTENTION_OBSERVER_MIN_LIFECYCLE_BUDGET_MS,
  }), /samples=3; successful_samples=3; insufficient_samples=3/);
  assert.deepEqual(emptyBudgets, [10_000, 7_475, 4_950]);
  assert.equal(emptyBudgets.every(
    (budget) => budget >= CONTENTION_OBSERVER_MIN_LIFECYCLE_BUDGET_MS,
  ), true);
});

test("bounded contention counts successful insufficient observations and caps repeated P2028", async () => {
  await assert.rejects(observeBoundedContention({
    expectedCount: 2,
    message: "insufficient contention",
    readSample: async () => [],
    describeRows: (rows) => rows,
    now: () => 0,
    pause: async () => {},
    maximumSamples: 1,
  }), (error) => {
    assert.match(error.message, /samples=1; successful_samples=1; insufficient_samples=1; retryable_p2028_failures=0/);
    return true;
  });

  const sensitive = Object.assign(new SimulatedPrismaClientKnownRequestError(
    "postgresql://secret@database.invalid SELECT private_sql fixture-user-id",
  ), { code: "P2028" });
  await assert.rejects(observeBoundedContention({
    expectedCount: 2,
    message: "retryable contention",
    readSample: async () => runSanitizedContentionObserver(
      (phase) => {
        phase.callbackEntered();
        phase.statementTimeoutStarted();
        throw sensitive;
      },
      simulatedPrismaErrorTypes,
      { now: (() => { const times = [0, 49]; return () => times.shift(); })() },
    ),
    describeRows: (rows) => rows,
    now: () => 0,
    pause: async () => {},
    maximumSamples: 3,
  }), (error) => {
    assert.match(error.message, /samples=3; successful_samples=0; insufficient_samples=0; retryable_p2028_failures=3/);
    assert.match(error.message, /observer_error=\{"name":"PrismaClientKnownRequestError","code":"P2028","phase":"statement-timeout-started","elapsed":"under-50ms"\}/);
    for (const privateValue of ["secret", "database.invalid", "SELECT", "fixture-user-id"]) {
      assert.equal(error.message.includes(privateValue), false);
    }
    return true;
  });
});

test("contention timeout diagnostics replace backend identifiers with bounded counts", async () => {
  const rows = [
    {
      pid: 73124,
      depth: 73125,
      state: "secret credential",
      wait_event_type: "postgresql://secret@database.invalid",
      wait_event: "fixture-user-id",
      blocking_pids: [73123, 73122, 73121, 73120],
    },
    {
      pid: 83124,
      depth: 2,
      state: "active",
      wait_event_type: "Lock",
      wait_event: "advisory",
      blocking_pids: [83123],
    },
  ];
  await assert.rejects(observeBoundedContention({
    expectedCount: 3,
    message: "sanitized contention",
    readSample: async () => rows,
    describeRows: (sample) => describeContentionWaitStates(sample, 3),
    now: () => 0,
    pause: async () => {},
    maximumSamples: 1,
  }), (error) => {
    assert.match(error.message, /"depth":null,"state_category":"unknown","wait_category":"unknown","wait_event_present":true,"blocking_count":3/);
    assert.match(error.message, /"depth":2,"state_category":"active","wait_category":"lock","wait_event_present":true,"blocking_count":1/);
    for (const privateValue of [
      "73124", "73125", "73123", "73122", "73121", "73120",
      "83124", "83123", "secret credential", "database.invalid", "fixture-user-id", "advisory",
    ]) {
      assert.equal(error.message.includes(privateValue), false);
    }
    assert.match(error.message, /samples=1; successful_samples=1; insufficient_samples=1; retryable_p2028_failures=0/);
    return true;
  });
  assert.deepEqual(rows[0], {
    pid: 73124,
    depth: 73125,
    state: "secret credential",
    wait_event_type: "postgresql://secret@database.invalid",
    wait_event: "fixture-user-id",
    blocking_pids: [73123, 73122, 73121, 73120],
  });

  const success = await observeBoundedContention({
    expectedCount: 1,
    message: "contention timeout",
    readSample: async () => rows,
    describeRows: (sample) => describeContentionWaitStates(sample, 1),
    now: () => 0,
    pause: async () => {},
  });
  assert.deepEqual(success, {
    attempts: 1,
    successfulSamples: 1,
    insufficientSamples: 0,
    retryableP2028Failures: 0,
  });

  let rejectHeld;
  const held = new Promise((_, reject) => { rejectHeld = reject; });
  await assert.rejects(runWithGuaranteedRelease({
    action: () => observeBoundedContention({
      expectedCount: 3,
      message: "sanitized contention",
      readSample: async () => rows,
      describeRows: (sample) => describeContentionWaitStates(sample, 3),
      now: () => 0,
      pause: async () => {},
      maximumSamples: 1,
    }),
    release: () => rejectHeld(Object.assign(new Error(
      "postgresql://secret@database.invalid fixture-user-id 73124",
    ), { code: "P2028" })),
    held: [{ label: "holder", promise: held }],
  }), (error) => {
    assert.equal(error instanceof AggregateError, true);
    const diagnostic = [error.message, ...error.errors.map((nested) => nested.message)].join(" ");
    for (const privateValue of ["73124", "database.invalid", "fixture-user-id"]) {
      assert.equal(diagnostic.includes(privateValue), false);
    }
    return true;
  });
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
    assert.match(error.message, /maximum_observed=0; samples=3; successful_samples=0; insufficient_samples=0; retryable_p2028_failures=3; wait_states=\[\]/);
    assert.match(error.message, /observer_error=\{"name":"PrismaClientKnownRequestError","code":"P2028","phase":"transaction-acquisition","elapsed":"under-50ms"\}/);
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
  const sharedLockTestStart = source.indexOf(
    'test("session-aware SRS waits for the shared advisory lock and releases after commit"',
  );
  const sharedLockTestEnd = source.indexOf(
    'test("injected terminal Streak failure',
    sharedLockTestStart,
  );
  const sharedLockTest = source.slice(sharedLockTestStart, sharedLockTestEnd);
  assert.match(sharedLockTest, /\{ label: "holder", promise: holder \}/);
  assert.match(sharedLockTest, /\{ label: "request-1", promise: pending\.then/);
  assert.match(sharedLockTest, /settleTimeoutMs: 5_000/);
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
  assert.match(contentionObserver, /observationDeadlineMs: 10_000/);
  assert.match(contentionObserver, /maximumSamples: 200/);
  assert.match(contentionObserver, /minimumLifecycleBudgetMs: CONTENTION_OBSERVER_MIN_LIFECYCLE_BUDGET_MS/);
  assert.match(contentionObserver, /contentionObserverTransactionPolicy\(remainingMs\)/);
  assert.match(contentionObserver, /wait_event_type/);
  assert.match(contentionObserver, /wait_event/);
  assert.match(contentionObserver, /describeContentionWaitStates\(rows, expectedCount\)/);
  assert.match(contentionObserver, /label: "holder"/);
  assert.match(contentionObserver, /label: `request-\$\{index \+ 1\}`/);
  assert.match(contentionObserver, /SELECT set_config\(/);
  assert.match(contentionObserver, /'statement_timeout'/);
  assert.match(contentionObserver, /\{ maxWait, timeout \}/);
  assert.match(contentionObserver, /runSanitizedContentionObserver/);
  assert.match(contentionObserver, /phase\.callbackEntered\(\)/);
  assert.match(contentionObserver, /phase\.statementTimeoutStarted\(\)/);
  assert.match(contentionObserver, /phase\.statementTimeoutCompleted\(\)/);
  assert.match(contentionObserver, /phase\.blockingQueryStarted\(\)/);
  assert.match(contentionObserver, /phase\.blockingQueryCompleted\(\)/);
  assert.match(contentionObserver, /phase\.callbackReturned\(\)/);
  assert.match(contentionObserver, /observer\.\$transaction/);
  assert.doesNotMatch(contentionObserver, /prisma\.\$transaction/);
  assert.doesNotMatch(contentionObserver, /activity\.query/);

  const suiteSetup = source.slice(source.indexOf("before(async () =>"), source.indexOf("afterEach(async () =>"));
  assert.ok(suiteSetup.indexOf("assertFoundationAuthorization(process.env)") < suiteSetup.indexOf('import("../../src/generated/prisma/client.ts")'));
  assert.ok(suiteSetup.indexOf('import("../../src/generated/prisma/client.ts")') < suiteSetup.indexOf("buildFoundationObserverDatabaseUrl(process.env)"));
  assert.match(suiteSetup, /observer = new PrismaClient\(\{ datasourceUrl: observerDatabaseUrl \}\)/);
  assert.match(suiteSetup, /await connectFoundationObserver\(observer, \{/);
  assert.match(suiteSetup, /onDisconnected: \(\) => \{ observer = undefined; \}/);
  const suiteTeardown = source.slice(source.indexOf("after(async () =>"), source.indexOf('test("full HTTP auth matrix'));
  assert.match(suiteTeardown, /runFoundationCleanup\(\{/);
  assert.ok(suiteTeardown.indexOf("database.reset()") < suiteTeardown.indexOf("http.close()"));
  assert.ok(suiteTeardown.indexOf("http.close()") < suiteTeardown.indexOf("observer.$disconnect()"));
  assert.ok(suiteTeardown.indexOf("observer.$disconnect()") < suiteTeardown.indexOf("peer.$disconnect()"));
  assert.ok(suiteTeardown.indexOf("peer.$disconnect()") < suiteTeardown.indexOf("database.disconnect()"));
  assert.doesNotMatch(suiteTeardown, /Promise\.race/);
});
