import assert from "node:assert/strict";
import test from "node:test";
import {
  DAILY_GOAL_PRISMA_TRANSACTION_LIMITS,
  runDailyGoalPrismaReadOnlyObservation,
} from "./daily-goal-prisma-read-only-binding.js";
import { DAILY_GOAL_READ_ONLY_QUERIES } from "./daily-goal-read-only-observer.js";
import { runDailyGoalPhaseBObservation } from "./daily-goal-phase-b-runner.js";
import {
  DAILY_GOAL_PHASE_B_FAILURE_CODES,
  getDailyGoalPhaseBFailureCode,
} from "./daily-goal-phase-b-diagnostics.js";

const IDENTITY = "ci-db.example.invalid:5432/postgres";
const OBSERVER_URL = "postgresql://elvocab_daily_goal_observer.fmosmonrivuoacjfbmov:secret@ci-db.example.invalid:5432/postgres";
const WRITE_URL = "postgresql://writer:secret@ci-db.example.invalid:5432/postgres";
const MARKER = `elvocab-ci-exclusive:v1:${IDENTITY}`;
const authorization = Object.freeze({ operation: "observation", databaseUrl: OBSERVER_URL, targetIdentity: IDENTITY });
const expectedTarget = Object.freeze({
  targetIdentity: IDENTITY,
  databaseName: "postgres",
  serverEndpoint: "10.0.0.8",
  serverPort: "5432",
  schemaName: "public",
  ownershipMarker: MARKER,
});

test("Prisma binding enforces read-only first, uses one transaction, rolls back success, and disconnects", async () => {
  const fixture = prismaFixture();
  const result = await runDailyGoalPrismaReadOnlyObservation({
    authorization,
    expectedTarget,
    loadPrismaClient: async () => fixture.PrismaClient,
    operation: async (snapshot) => {
      assert.equal(hasExecutableCapability(snapshot), false);
      return snapshot.history[0].name;
    },
  });

  assert.equal(result, "20260101000000_base");
  assert.deepEqual(fixture.calls, [
    "construct:elvocab_daily_goal_observer.fmosmonrivuoacjfbmov",
    "transaction",
    "execute:SET TRANSACTION READ ONLY",
    "query:SHOW transaction_read_only",
    "query:target",
    "query:history",
    "rollback",
    "disconnect",
  ]);
  assert.deepEqual(fixture.options, DAILY_GOAL_PRISMA_TRANSACTION_LIMITS);
  assert.equal(fixture.transactionClients.size, 1);
});

test("read-write state fails before identity/history and still rolls back and disconnects", async () => {
  const fixture = prismaFixture({ transactionReadOnly: "off" });
  await assert.rejects(
    () => run(fixture),
    stageError(DAILY_GOAL_PHASE_B_FAILURE_CODES.READ_ONLY_ENFORCEMENT_FAILED),
  );
  assert.deepEqual(fixture.calls, [
    "construct:elvocab_daily_goal_observer.fmosmonrivuoacjfbmov",
    "transaction",
    "execute:SET TRANSACTION READ ONLY",
    "query:SHOW transaction_read_only",
    "rollback",
    "disconnect",
  ]);
});

test("rollback failure and unexpected driver errors cannot become successful sentinel results", async () => {
  const rollbackFailure = prismaFixture({ rollbackFailure: true });
  await assert.rejects(
    () => run(rollbackFailure),
    stageError(DAILY_GOAL_PHASE_B_FAILURE_CODES.ROLLBACK_FAILED),
  );
  assert.equal(rollbackFailure.calls.includes("disconnect"), true);

  const queryFailure = prismaFixture({ queryFailure: true });
  await assert.rejects(
    () => run(queryFailure),
    stageError(DAILY_GOAL_PHASE_B_FAILURE_CODES.TARGET_OBSERVATION_FAILED),
  );
  assert.equal(queryFailure.calls.includes("rollback"), true);
  assert.equal(queryFailure.calls.includes("disconnect"), true);
});

test("Prisma exception replacement cannot relabel an established callback stage", async () => {
  const cases = [
    {
      fixture: prismaFixture({ queryFailure: true, replaceCallbackFailure: true }),
      stage: DAILY_GOAL_PHASE_B_FAILURE_CODES.TARGET_OBSERVATION_FAILED,
    },
    {
      fixture: prismaFixture({ executeReadOnlyFailure: true, replaceCallbackFailure: true }),
      stage: DAILY_GOAL_PHASE_B_FAILURE_CODES.READ_ONLY_ENFORCEMENT_FAILED,
    },
  ];

  for (const { fixture, stage } of cases) {
    await assert.rejects(() => run(fixture), stageError(stage));
    assert.equal(fixture.calls.includes("replace-callback-failure"), true);
    assert.equal(fixture.calls.at(-1), "disconnect");
  }
});

test("unknown callback replacement remains unknown and never becomes rollback success", async () => {
  const fixture = prismaFixture({ replaceCallbackFailure: true });
  await assert.rejects(
    () => run(fixture, async () => { throw new Error(`raw callback ${OBSERVER_URL}`); }),
    stageError(DAILY_GOAL_PHASE_B_FAILURE_CODES.UNKNOWN_PHASE_B_FAILURE),
  );
  assert.equal(fixture.calls.includes("replace-callback-failure"), true);
  assert.equal(fixture.calls.at(-1), "disconnect");
});

test("only the exact rollback sentinel completes success", async () => {
  const exactSentinel = prismaFixture();
  assert.equal(await run(exactSentinel), "ok");

  const replacedSentinel = prismaFixture({ replaceCallbackFailure: true });
  await assert.rejects(
    () => run(replacedSentinel),
    stageError(DAILY_GOAL_PHASE_B_FAILURE_CODES.ROLLBACK_FAILED),
  );

  const unexpectedlyResolved = prismaFixture({ swallowCallbackFailure: true });
  await assert.rejects(
    () => run(unexpectedlyResolved),
    stageError(DAILY_GOAL_PHASE_B_FAILURE_CODES.ROLLBACK_FAILED),
  );
});

test("transaction acquisition, loader, constructor and disconnect failures remain redacted", async () => {
  const acquisitionFailure = prismaFixture({ acquisitionFailure: true });
  await assert.rejects(
    () => run(acquisitionFailure),
    stageError(DAILY_GOAL_PHASE_B_FAILURE_CODES.TRANSACTION_ACQUIRE_FAILED),
  );
  assert.equal(acquisitionFailure.calls.at(-1), "disconnect");

  await assert.rejects(() => runDailyGoalPrismaReadOnlyObservation({
    authorization,
    expectedTarget,
    operation: async () => {},
    loadPrismaClient: async () => { throw new Error(`load ${OBSERVER_URL}`); },
  }), stageError(DAILY_GOAL_PHASE_B_FAILURE_CODES.PRISMA_LOAD_FAILED));

  const constructorFailure = prismaFixture({ constructorFailure: true });
  await assert.rejects(
    () => run(constructorFailure),
    stageError(DAILY_GOAL_PHASE_B_FAILURE_CODES.PRISMA_LOAD_FAILED),
  );

  const disconnectFailure = prismaFixture({ disconnectFailure: true });
  await assert.rejects(
    () => run(disconnectFailure),
    stageError(DAILY_GOAL_PHASE_B_FAILURE_CODES.DISCONNECT_FAILED),
  );
  assert.equal(disconnectFailure.calls.at(-1), "disconnect");
});

test("controlled execution boundaries produce their exact trusted failure stages", async () => {
  const cases = [
    {
      stage: DAILY_GOAL_PHASE_B_FAILURE_CODES.TRANSACTION_ACQUIRE_FAILED,
      fixture: prismaFixture({ invalidTransactionClient: true }),
    },
    {
      stage: DAILY_GOAL_PHASE_B_FAILURE_CODES.READ_ONLY_ENFORCEMENT_FAILED,
      fixture: prismaFixture({ executeReadOnlyFailure: true }),
    },
    {
      stage: DAILY_GOAL_PHASE_B_FAILURE_CODES.READ_ONLY_ENFORCEMENT_FAILED,
      fixture: prismaFixture({ showReadOnlyFailure: true }),
    },
    {
      stage: DAILY_GOAL_PHASE_B_FAILURE_CODES.TARGET_OBSERVATION_FAILED,
      fixture: prismaFixture({ targetRow: observationRow({ ownership_marker: null }) }),
    },
    {
      stage: DAILY_GOAL_PHASE_B_FAILURE_CODES.TARGET_VERIFICATION_FAILED,
      fixture: prismaFixture({
        targetRow: observationRow({
          ownership_marker: "elvocab-ci-exclusive:v1:other.example.invalid:5432/postgres",
        }),
      }),
    },
    {
      stage: DAILY_GOAL_PHASE_B_FAILURE_CODES.HISTORY_READ_FAILED,
      fixture: prismaFixture({ historyQueryFailure: true }),
    },
    {
      stage: DAILY_GOAL_PHASE_B_FAILURE_CODES.ROLLBACK_FAILED,
      fixture: prismaFixture({ swallowCallbackFailure: true }),
    },
  ];

  for (const { stage, fixture } of cases) {
    await assert.rejects(() => run(fixture), stageError(stage));
    assert.equal(fixture.calls.at(-1), "disconnect");
  }
});

test("unknown callback failures and forged error codes remain unknown", async () => {
  for (const callbackError of [
    new Error(`raw Prisma ${OBSERVER_URL} SELECT password`),
    Object.assign(new Error("forged"), {
      code: "DAILY_GOAL_PRISMA_READ_ONLY_BINDING_FAILED",
      failureCode: "TARGET_VERIFICATION_FAILED",
    }),
  ]) {
    const fixture = prismaFixture();
    await assert.rejects(
      () => run(fixture, async () => { throw callbackError; }),
      stageError(DAILY_GOAL_PHASE_B_FAILURE_CODES.UNKNOWN_PHASE_B_FAILURE),
    );
  }
});

test("cleanup failure takes deterministic precedence over success or an earlier failure", async () => {
  const afterSuccess = prismaFixture({ disconnectFailure: true });
  await assert.rejects(
    () => run(afterSuccess),
    stageError(DAILY_GOAL_PHASE_B_FAILURE_CODES.DISCONNECT_FAILED),
  );

  const afterTargetFailure = prismaFixture({ queryFailure: true, disconnectFailure: true });
  await assert.rejects(
    () => run(afterTargetFailure),
    stageError(DAILY_GOAL_PHASE_B_FAILURE_CODES.DISCONNECT_FAILED),
  );
});

test("runner authorization rejection is classified as configuration without opening Prisma", async () => {
  let loaded = false;
  await assert.rejects(() => runDailyGoalPhaseBObservation({
    environment: {},
    expectedTarget,
    loadPrismaClient: async () => { loaded = true; },
    operation: async () => "not-reached",
  }), stageError(
    DAILY_GOAL_PHASE_B_FAILURE_CODES.CONFIG_REJECTED,
    "DAILY_GOAL_PHASE_B_FAILED",
  ));
  assert.equal(loaded, false);
});

test("each invocation creates fresh state and accepts no caller SQL or write credential fallback", async () => {
  const first = prismaFixture();
  const second = prismaFixture();
  assert.equal(await run(first), "ok");
  assert.equal(await run(second), "ok");
  assert.notEqual(first.instances[0], second.instances[0]);

  const environment = {
    CI: "true",
    GITHUB_ACTIONS: "true",
    NODE_ENV: "test",
    DAILY_GOAL_DATABASE_TARGET_CLASS: "CI_EXCLUSIVE",
    CI_TEST_DATABASE_URL: WRITE_URL,
    DAILY_GOAL_OBSERVER_DATABASE_URL: OBSERVER_URL,
    CI_TEST_DATABASE_IDENTITY: IDENTITY,
    DAILY_GOAL_APPROVED_TARGET_IDENTITY: IDENTITY,
    DAILY_GOAL_OBSERVATION_ALLOW: "true",
  };
  const runnerFixture = prismaFixture();
  await runDailyGoalPhaseBObservation({
    environment,
    expectedTarget,
    loadPrismaClient: async () => runnerFixture.PrismaClient,
    operation: async () => "runner-ok",
    sql: "DROP TABLE users",
  });
  assert.equal(runnerFixture.calls[0], "construct:elvocab_daily_goal_observer.fmosmonrivuoacjfbmov");
  assert.equal(runnerFixture.calls.some((entry) => /DROP|writer/i.test(entry)), false);
});

function run(fixture, operation = async () => "ok") {
  return runDailyGoalPrismaReadOnlyObservation({
    authorization,
    expectedTarget,
    loadPrismaClient: async () => fixture.PrismaClient,
    operation,
  });
}

function prismaFixture({
  transactionReadOnly = "on",
  queryFailure = false,
  historyQueryFailure = false,
  rollbackFailure = false,
  acquisitionFailure = false,
  disconnectFailure = false,
  constructorFailure = false,
  invalidTransactionClient = false,
  executeReadOnlyFailure = false,
  showReadOnlyFailure = false,
  swallowCallbackFailure = false,
  replaceCallbackFailure = false,
  targetRow = observationRow(),
} = {}) {
  const calls = [];
  const instances = [];
  const transactionClients = new Set();
  let options;

  class PrismaClient {
    constructor({ datasourceUrl }) {
      if (constructorFailure) throw new Error(`construct ${OBSERVER_URL}`);
      calls.push(`construct:${new URL(datasourceUrl).username}`);
      instances.push(this);
    }

    async $transaction(callback, receivedOptions) {
      calls.push("transaction");
      options = receivedOptions;
      if (acquisitionFailure) throw new Error(`acquire ${OBSERVER_URL}`);
      const transaction = invalidTransactionClient ? {} : {
        async $executeRawUnsafe(sql) {
          calls.push(`execute:${sql}`);
          assert.equal(sql, "SET TRANSACTION READ ONLY");
          if (executeReadOnlyFailure) throw new Error(`set read only ${OBSERVER_URL}`);
          return 0;
        },
        async $queryRawUnsafe(sql) {
          transactionClients.add(transaction);
          if (sql === "SHOW transaction_read_only") {
            calls.push("query:SHOW transaction_read_only");
            if (showReadOnlyFailure) throw new Error(`show read only ${OBSERVER_URL}`);
            return [{ transaction_read_only: transactionReadOnly }];
          }
          if (sql === DAILY_GOAL_READ_ONLY_QUERIES.TARGET_OBSERVATION) {
            calls.push("query:target");
            if (queryFailure) throw new Error(`query ${OBSERVER_URL}`);
            return [targetRow];
          }
          if (sql === DAILY_GOAL_READ_ONLY_QUERIES.MIGRATION_HISTORY) {
            calls.push("query:history");
            if (historyQueryFailure) throw new Error(`history ${OBSERVER_URL}`);
            return [{
              migration_name: "20260101000000_base",
              checksum: "a".repeat(64),
              finished_at: "2026-01-01",
              rolled_back_at: null,
              logs: null,
            }];
          }
          throw new Error("arbitrary SQL reached transaction");
        },
      };
      transactionClients.add(transaction);
      try {
        return await callback(transaction);
      } catch (error) {
        calls.push("rollback");
        if (rollbackFailure) throw new Error(`rollback ${OBSERVER_URL}`);
        if (swallowCallbackFailure) return undefined;
        if (replaceCallbackFailure) {
          calls.push("replace-callback-failure");
          throw new Error(`replacement ${OBSERVER_URL}`);
        }
        throw error;
      }
    }

    async $disconnect() {
      calls.push("disconnect");
      if (disconnectFailure) throw new Error(`disconnect ${OBSERVER_URL}`);
    }
  }

  return {
    PrismaClient,
    calls,
    instances,
    transactionClients,
    get options() { return options; },
  };
}

function safeError(error, expectedErrorCode = "DAILY_GOAL_PRISMA_READ_ONLY_BINDING_FAILED") {
  assert.equal(error.code, expectedErrorCode);
  assert.doesNotMatch(error.message, /postgres(?:ql)?:\/\//i);
  assert.doesNotMatch(error.message, /secret|SET|SHOW|SELECT/i);
  return true;
}

function stageError(
  expectedStage,
  expectedErrorCode = "DAILY_GOAL_PRISMA_READ_ONLY_BINDING_FAILED",
) {
  return (error) => {
    assert.equal(getDailyGoalPhaseBFailureCode(error), expectedStage);
    return safeError(error, expectedErrorCode);
  };
}

function observationRow(overrides = {}) {
  return {
    database_name: "postgres",
    server_endpoint: "10.0.0.8",
    server_port: "5432",
    schema_name: "public",
    ownership_marker: MARKER,
    ...overrides,
  };
}

function hasExecutableCapability(value, seen = new Set()) {
  if (typeof value === "function") return true;
  if (!value || typeof value !== "object" || seen.has(value)) return false;
  seen.add(value);
  return Reflect.ownKeys(value).some((key) => hasExecutableCapability(value[key], seen));
}
