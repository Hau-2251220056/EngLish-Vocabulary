import assert from "node:assert/strict";
import test from "node:test";
import {
  DAILY_GOAL_PRISMA_TRANSACTION_LIMITS,
  runDailyGoalPrismaReadOnlyObservation,
} from "./daily-goal-prisma-read-only-binding.js";
import { DAILY_GOAL_READ_ONLY_QUERIES } from "./daily-goal-read-only-observer.js";
import { runDailyGoalPhaseBObservation } from "./daily-goal-phase-b-runner.js";

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
  await assert.rejects(() => run(fixture), safeError);
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
  await assert.rejects(() => run(rollbackFailure), safeError);
  assert.equal(rollbackFailure.calls.includes("disconnect"), true);

  const queryFailure = prismaFixture({ queryFailure: true });
  await assert.rejects(() => run(queryFailure), safeError);
  assert.equal(queryFailure.calls.includes("rollback"), true);
  assert.equal(queryFailure.calls.includes("disconnect"), true);
});

test("transaction acquisition, loader, constructor and disconnect failures remain redacted", async () => {
  const acquisitionFailure = prismaFixture({ acquisitionFailure: true });
  await assert.rejects(() => run(acquisitionFailure), safeError);
  assert.equal(acquisitionFailure.calls.at(-1), "disconnect");

  await assert.rejects(() => runDailyGoalPrismaReadOnlyObservation({
    authorization,
    expectedTarget,
    operation: async () => {},
    loadPrismaClient: async () => { throw new Error(`load ${OBSERVER_URL}`); },
  }), safeError);

  const disconnectFailure = prismaFixture({ disconnectFailure: true });
  await assert.rejects(() => run(disconnectFailure), safeError);
  assert.equal(disconnectFailure.calls.at(-1), "disconnect");
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

function run(fixture) {
  return runDailyGoalPrismaReadOnlyObservation({
    authorization,
    expectedTarget,
    loadPrismaClient: async () => fixture.PrismaClient,
    operation: async () => "ok",
  });
}

function prismaFixture({
  transactionReadOnly = "on",
  queryFailure = false,
  rollbackFailure = false,
  acquisitionFailure = false,
  disconnectFailure = false,
} = {}) {
  const calls = [];
  const instances = [];
  const transactionClients = new Set();
  let options;

  class PrismaClient {
    constructor({ datasourceUrl }) {
      calls.push(`construct:${new URL(datasourceUrl).username}`);
      instances.push(this);
    }

    async $transaction(callback, receivedOptions) {
      calls.push("transaction");
      options = receivedOptions;
      if (acquisitionFailure) throw new Error(`acquire ${OBSERVER_URL}`);
      const transaction = {
        async $executeRawUnsafe(sql) {
          calls.push(`execute:${sql}`);
          assert.equal(sql, "SET TRANSACTION READ ONLY");
          return 0;
        },
        async $queryRawUnsafe(sql) {
          transactionClients.add(transaction);
          if (sql === "SHOW transaction_read_only") {
            calls.push("query:SHOW transaction_read_only");
            return [{ transaction_read_only: transactionReadOnly }];
          }
          if (sql === DAILY_GOAL_READ_ONLY_QUERIES.TARGET_OBSERVATION) {
            calls.push("query:target");
            if (queryFailure) throw new Error(`query ${OBSERVER_URL}`);
            return [{
              database_name: "postgres",
              server_endpoint: "10.0.0.8",
              server_port: "5432",
              schema_name: "public",
              ownership_marker: MARKER,
            }];
          }
          if (sql === DAILY_GOAL_READ_ONLY_QUERIES.MIGRATION_HISTORY) {
            calls.push("query:history");
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

function safeError(error) {
  assert.equal(error.code, "DAILY_GOAL_PRISMA_READ_ONLY_BINDING_FAILED");
  assert.doesNotMatch(error.message, /postgres(?:ql)?:\/\//i);
  assert.doesNotMatch(error.message, /secret|SET|SHOW|SELECT/i);
  return true;
}

function hasExecutableCapability(value, seen = new Set()) {
  if (typeof value === "function") return true;
  if (!value || typeof value !== "object" || seen.has(value)) return false;
  seen.add(value);
  return Reflect.ownKeys(value).some((key) => hasExecutableCapability(value[key], seen));
}
