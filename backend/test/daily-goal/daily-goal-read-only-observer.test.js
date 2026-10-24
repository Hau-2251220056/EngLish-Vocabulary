import assert from "node:assert/strict";
import test from "node:test";
import {
  assertCiExclusiveDatabaseAuthorization,
  CI_DATABASE_OPERATIONS,
} from "../helpers/test-environment.js";
import {
  assertReadOnlyObservationQueries,
  CI_EXCLUSIVE_OWNERSHIP_PREFIX,
  createDailyGoalReadOnlyObserver,
  DAILY_GOAL_READ_ONLY_QUERIES,
  mapPrismaMigrationHistory,
  READ_ONLY_EVIDENCE_SOURCE,
} from "./daily-goal-read-only-observer.js";
import {
  createDailyGoalPhaseBFailure,
  DAILY_GOAL_PHASE_B_FAILURE_CODES,
  getDailyGoalPhaseBFailureCode,
} from "./daily-goal-phase-b-diagnostics.js";

const SECRET = "must-not-appear";
const IDENTITY = "ci-db.example.invalid:5432/elvocab_ci";
const OWNERSHIP = `${CI_EXCLUSIVE_OWNERSHIP_PREFIX}${IDENTITY}`;
const environment = Object.freeze({
  CI: "true",
  GITHUB_ACTIONS: "true",
  NODE_ENV: "test",
  DAILY_GOAL_DATABASE_TARGET_CLASS: "CI_EXCLUSIVE",
  CI_TEST_DATABASE_URL: `postgresql://ci:${SECRET}@ci-db.example.invalid:5432/elvocab_ci`,
  DAILY_GOAL_OBSERVER_DATABASE_URL: `postgresql://elvocab_daily_goal_observer.fmosmonrivuoacjfbmov:${SECRET}@ci-db.example.invalid:5432/elvocab_ci`,
  CI_TEST_DATABASE_IDENTITY: IDENTITY,
  DAILY_GOAL_APPROVED_TARGET_IDENTITY: IDENTITY,
  DAILY_GOAL_OBSERVATION_ALLOW: "true",
});
const expectedTarget = Object.freeze({
  targetIdentity: IDENTITY,
  databaseName: "elvocab_ci",
  serverEndpoint: "10.0.0.7",
  serverPort: "5432",
  schemaName: "public",
  ownershipMarker: OWNERSHIP,
});

test("module import creates no connection and SQL allowlist contains reads only", () => {
  assertReadOnlyObservationQueries();
  for (const sql of Object.values(DAILY_GOAL_READ_ONLY_QUERIES)) {
    assert.match(sql, /^SELECT/);
    assert.doesNotMatch(sql, /\b(?:ALTER|CREATE|DELETE|DROP|INSERT|TRUNCATE|UPDATE)\b/i);
  }
  assert.throws(() => assertReadOnlyObservationQueries({ unsafe: "DELETE FROM users" }), /SELECT\/CTE/);
  assert.throws(() => assertReadOnlyObservationQueries({ unsafe: "SELECT 1; DROP TABLE users" }), /prohibited/);
});

test("target observation reads the current database shared-object comment", () => {
  const targetQuery = DAILY_GOAL_READ_ONLY_QUERIES.TARGET_OBSERVATION;
  const normalizedTargetQuery = targetQuery.replace(/\s+/g, " ").trim();
  assert.equal(
    normalizedTargetQuery,
    "SELECT current_database()::text AS database_name, host(inet_server_addr()) AS server_endpoint, inet_server_port()::text AS server_port, current_schema()::text AS schema_name, shobj_description( (SELECT oid FROM pg_database WHERE datname = current_database()), 'pg_database' )::text AS ownership_marker",
  );
  assert.doesNotMatch(targetQuery, /inet_server_addr\(\)::text AS server_endpoint/);
  assert.match(
    targetQuery,
    /shobj_description\(\s*\(SELECT oid FROM pg_database WHERE datname = current_database\(\)\),\s*'pg_database'\s*\)::text AS ownership_marker/s,
  );
  assert.doesNotMatch(targetQuery, /\bobj_description\s*\(/i);
  assert.match(
    targetQuery,
    /SELECT oid FROM pg_database WHERE datname = current_database\(\)/,
  );
  assert.equal(Object.keys(DAILY_GOAL_READ_ONLY_QUERIES).length, 2);
});

test("Context A migration history uses only the exact schema-qualified public relation", () => {
  const normalizedHistoryQuery = DAILY_GOAL_READ_ONLY_QUERIES.MIGRATION_HISTORY
    .replace(/\s+/g, " ")
    .trim();
  assert.equal(
    normalizedHistoryQuery,
    'SELECT migration_name, checksum, finished_at, rolled_back_at, logs FROM "public"."_prisma_migrations" ORDER BY started_at ASC, migration_name ASC',
  );
  assert.doesNotMatch(
    DAILY_GOAL_READ_ONLY_QUERIES.MIGRATION_HISTORY,
    /FROM\s+"_prisma_migrations"/i,
  );
  assert.doesNotMatch(
    DAILY_GOAL_READ_ONLY_QUERIES.MIGRATION_HISTORY,
    /\b(?:search_path|current_schema|pg_temp|format|quote_ident)\b/i,
  );
});

test("another-schema and temporary shadow relations cannot redirect Context A history", async () => {
  const calls = [];
  const observer = createDailyGoalReadOnlyObserver({
    openConnection: async () => mockConnection({
      calls,
      publicHistoryRows: [migrationRow({
        migration_name: "20260101000000_public_history",
        finished_at: "2026-01-01",
      })],
      shadowHistoryRows: [migrationRow({
        migration_name: "20260101000000_shadow_history",
        finished_at: "2026-01-01",
      })],
    }),
  });

  const observedHistory = await observer.withObservation({
    authorization: authorize(),
    expectedTarget,
    operation: async (snapshot) => snapshot.history,
  });

  assert.deepEqual(observedHistory, [{
    name: "20260101000000_public_history",
    checksum: "a".repeat(64),
    status: "APPLIED",
  }]);
  assert.deepEqual(calls, [
    "verify-read-only",
    "target-query",
    "public-history-query",
    "close",
  ]);
  assert.equal(calls.includes("shadow-history-query"), false);
});

test("observer verifies read-only state, returns an immutable snapshot, then closes safely", async () => {
  const authorization = authorize();
  const calls = [];
  const connection = mockConnection({ calls });
  const observer = createDailyGoalReadOnlyObserver({
    openConnection: async ({ databaseUrl, requiredMode }) => {
      calls.push("open");
      assert.equal(databaseUrl, environment.DAILY_GOAL_OBSERVER_DATABASE_URL);
      assert.equal(requiredMode, "READ_ONLY");
      return connection;
    },
  });
  const result = await observer.withObservation({
    authorization,
    expectedTarget,
    operation: async (snapshot) => {
      calls.push("operation");
      assert.equal(Object.hasOwn(snapshot, "targetHandle"), false);
      assert.equal(Object.hasOwn(snapshot, "connection"), false);
      assert.equal(Object.hasOwn(snapshot, "openConnection"), false);
      assert.equal(hasExecutableCapability(snapshot), false);
      assert.deepEqual(snapshot.history, [{ name: "20260101000000_base", checksum: "a".repeat(64), status: "APPLIED" }]);
      assert.deepEqual(snapshot.readOnlyEvidence, readOnlyEvidence());
      assert.equal(Object.isFrozen(snapshot), true);
      assert.equal(Object.isFrozen(snapshot.observation), true);
      assert.equal(Object.isFrozen(snapshot.history), true);
      assert.equal(Object.isFrozen(snapshot.history[0]), true);
      assert.equal(Object.isFrozen(snapshot.readOnlyEvidence), true);
      assert.throws(() => { snapshot.observation.targetIdentity = "changed"; }, TypeError);
      return "observed";
    },
  });
  assert.equal(result, "observed");
  assert.deepEqual(calls, ["open", "verify-read-only", "target-query", "history-query", "operation", "close"]);
});

test("observer errors and cleanup diagnostics do not expose secrets", async () => {
  const observer = createDailyGoalReadOnlyObserver({
    openConnection: async () => ({
      establishAndVerifyReadOnly: async () => readOnlyEvidence(),
      query: async () => { throw new Error(`connection failed: ${environment.DAILY_GOAL_OBSERVER_DATABASE_URL}`); },
      close: async () => { throw new Error(`close failed: ${SECRET}`); },
    }),
  });
  await assert.rejects(
    () => observer.withObservation({ authorization: authorize(), expectedTarget, operation: async () => {} }),
    (error) => {
      assert.equal(error.code, "DAILY_GOAL_READ_ONLY_OBSERVATION_FAILED");
      assert.doesNotMatch(error.message, new RegExp(SECRET));
      assert.doesNotMatch(error.message, /postgres(?:ql)?:\/\//i);
      return true;
    },
  );
});

test("a close failure after successful observation fails closed and stays redacted", async () => {
  const observer = createDailyGoalReadOnlyObserver({
    openConnection: async () => mockConnection({ closeError: new Error(`close failed: ${SECRET}`) }),
  });
  await assert.rejects(
    () => observer.withObservation({
      authorization: authorize(), expectedTarget, operation: async () => "must-not-succeed",
    }),
    (error) => {
      assert.equal(error.code, "DAILY_GOAL_READ_ONLY_OBSERVATION_FAILED");
      assert.equal(
        getDailyGoalPhaseBFailureCode(error),
        DAILY_GOAL_PHASE_B_FAILURE_CODES.OBSERVER_CLEANUP_FAILED,
      );
      assert.doesNotMatch(error.message, new RegExp(SECRET));
      return true;
    },
  );
});

test("missing, read-write, or failed read-only verification stops before observation queries", async () => {
  const missingCalls = [];
  const missingVerifier = createDailyGoalReadOnlyObserver({
    openConnection: async () => ({
      query: async () => { missingCalls.push("query"); return { rows: [] }; },
      close: async () => { missingCalls.push("close"); },
    }),
  });
  await assert.rejects(() => missingVerifier.withObservation({
    authorization: authorize(), expectedTarget, operation: async () => {},
  }), (error) => {
    assert.equal(
      getDailyGoalPhaseBFailureCode(error),
      DAILY_GOAL_PHASE_B_FAILURE_CODES.UNKNOWN_PHASE_B_FAILURE,
    );
    return true;
  });
  assert.deepEqual(missingCalls, ["close"]);

  for (const readOnlyResult of [
    null,
    { enforced: false, transactionReadOnly: false, evidenceSource: READ_ONLY_EVIDENCE_SOURCE },
    { enforced: true, transactionReadOnly: false, evidenceSource: READ_ONLY_EVIDENCE_SOURCE },
    { enforced: true, transactionReadOnly: true, evidenceSource: "CLIENT_ASSERTION" },
  ]) {
    const calls = [];
    const observer = createDailyGoalReadOnlyObserver({
      openConnection: async () => mockConnection({ calls, readOnlyResult }),
    });
    await assert.rejects(() => observer.withObservation({
      authorization: authorize(), expectedTarget, operation: async () => {},
    }), (error) => {
      assert.equal(
        getDailyGoalPhaseBFailureCode(error),
        DAILY_GOAL_PHASE_B_FAILURE_CODES.READ_ONLY_ENFORCEMENT_FAILED,
      );
      return true;
    });
    assert.deepEqual(calls, ["verify-read-only", "close"]);
  }

  const calls = [];
  const observer = createDailyGoalReadOnlyObserver({
    openConnection: async () => mockConnection({
      calls,
      readOnlyError: new Error(`verification failed: ${SECRET}`),
    }),
  });
  await assert.rejects(
    () => observer.withObservation({ authorization: authorize(), expectedTarget, operation: async () => {} }),
    (error) => {
      assert.doesNotMatch(error.message, new RegExp(SECRET));
      return true;
    },
  );
  assert.deepEqual(calls, ["verify-read-only", "close"]);
});

test("observer classifies read-only, target, verification, history, and callback boundaries", async () => {
  const cases = [
    {
      stage: DAILY_GOAL_PHASE_B_FAILURE_CODES.READ_ONLY_ENFORCEMENT_FAILED,
      connection: mockConnection({ readOnlyError: new Error(`read-only ${SECRET}`) }),
    },
    {
      stage: DAILY_GOAL_PHASE_B_FAILURE_CODES.TARGET_OBSERVATION_FAILED,
      connection: mockConnection({ targetError: new Error(`target ${SECRET}`) }),
    },
    {
      stage: DAILY_GOAL_PHASE_B_FAILURE_CODES.TARGET_OBSERVATION_FAILED,
      connection: mockConnection({ targetRow: observationRow({ server_endpoint: null }) }),
    },
    {
      stage: DAILY_GOAL_PHASE_B_FAILURE_CODES.TARGET_IDENTITY_MISMATCH,
      connection: mockConnection({
        targetRow: observationRow({
          ownership_marker: `${CI_EXCLUSIVE_OWNERSHIP_PREFIX}other.invalid:5432/elvocab_ci`,
        }),
      }),
    },
    {
      stage: DAILY_GOAL_PHASE_B_FAILURE_CODES.HISTORY_READ_FAILED,
      connection: mockConnection({ historyError: new Error(`history ${SECRET}`) }),
    },
  ];

  for (const { stage, connection } of cases) {
    const observer = createDailyGoalReadOnlyObserver({ openConnection: async () => connection });
    await assert.rejects(
      () => observer.withObservation({
        authorization: authorize(), expectedTarget, operation: async () => "not-reached",
      }),
      (error) => {
        assert.equal(getDailyGoalPhaseBFailureCode(error), stage);
        assert.doesNotMatch(error.message, new RegExp(SECRET));
        return true;
      },
    );
  }

  const observer = createDailyGoalReadOnlyObserver({
    openConnection: async () => mockConnection(),
  });
  await assert.rejects(
    () => observer.withObservation({
      authorization: authorize(),
      expectedTarget,
      operation: async () => { throw new Error(`callback ${SECRET}`); },
    }),
    (error) => {
      assert.equal(
        getDailyGoalPhaseBFailureCode(error),
        DAILY_GOAL_PHASE_B_FAILURE_CODES.UNKNOWN_PHASE_B_FAILURE,
      );
      assert.doesNotMatch(error.message, new RegExp(SECRET));
      return true;
    },
  );
});

test("endpoint and port diagnostics fail before Context A history while valid evidence continues", async () => {
  const invalidCases = [
    { endpoint: null, port: "5432", stage: DAILY_GOAL_PHASE_B_FAILURE_CODES.TARGET_OBSERVATION_FAILED },
    { endpoint: "", port: "5432", stage: DAILY_GOAL_PHASE_B_FAILURE_CODES.TARGET_OBSERVATION_FAILED },
    { endpoint: "10.0.0.8/32", port: "5432", stage: DAILY_GOAL_PHASE_B_FAILURE_CODES.ENDPOINT_DIAGNOSTIC_INVALID },
    { endpoint: "2001:db8::8/128", port: "5432", stage: DAILY_GOAL_PHASE_B_FAILURE_CODES.ENDPOINT_DIAGNOSTIC_INVALID },
    { endpoint: "pooler.example.invalid", port: "5432", stage: DAILY_GOAL_PHASE_B_FAILURE_CODES.ENDPOINT_DIAGNOSTIC_INVALID },
    { endpoint: "10.0.0.8", port: "0", stage: DAILY_GOAL_PHASE_B_FAILURE_CODES.PORT_DIAGNOSTIC_INVALID },
  ];

  for (const { endpoint, port, stage } of invalidCases) {
    const calls = [];
    const observer = createDailyGoalReadOnlyObserver({
      openConnection: async () => mockConnection({
        calls,
        targetRow: observationRow({ server_endpoint: endpoint, server_port: port }),
      }),
    });
    await assert.rejects(() => observer.withObservation({
      authorization: authorize(),
      expectedTarget,
      operation: async () => assert.fail("invalid diagnostics must not reach success"),
    }), (error) => {
      assert.equal(getDailyGoalPhaseBFailureCode(error), stage);
      assert.doesNotMatch(error.message, /10\.0\.0\.8|2001:db8|pooler\.example/i);
      return true;
    });
    assert.deepEqual(calls, ["verify-read-only", "target-query", "close"]);
  }

  for (const endpoint of ["10.0.0.8", "2001:db8::8", "::ffff:10.0.0.8"]) {
    const calls = [];
    const observer = createDailyGoalReadOnlyObserver({
      openConnection: async () => mockConnection({
        calls,
        targetRow: observationRow({ server_endpoint: endpoint }),
      }),
    });
    assert.equal(await observer.withObservation({
      authorization: authorize(),
      expectedTarget,
      operation: async () => "success",
    }), "success");
    assert.deepEqual(calls, ["verify-read-only", "target-query", "history-query", "close"]);
  }
});

test("unknown target-verification exceptions retain the generic safe fallback", async () => {
  for (const hostileError of [
    new Error(`hostile expected target ${SECRET}`),
    createDailyGoalPhaseBFailure(DAILY_GOAL_PHASE_B_FAILURE_CODES.HISTORY_READ_FAILED),
  ]) {
    const calls = [];
    const expectedWithHostileGetter = { ...expectedTarget };
    Object.defineProperty(expectedWithHostileGetter, "targetIdentity", {
      enumerable: true,
      get() { throw hostileError; },
    });
    const observer = createDailyGoalReadOnlyObserver({
      openConnection: async () => mockConnection({ calls }),
    });

    await assert.rejects(() => observer.withObservation({
      authorization: authorize(),
      expectedTarget: expectedWithHostileGetter,
      operation: async () => assert.fail("history/success must not be reached"),
    }), (error) => {
      assert.equal(
        getDailyGoalPhaseBFailureCode(error),
        DAILY_GOAL_PHASE_B_FAILURE_CODES.TARGET_VERIFICATION_FAILED,
      );
      assert.doesNotMatch(error.message, new RegExp(SECRET));
      return true;
    });
    assert.deepEqual(calls, ["verify-read-only", "target-query", "close"]);
  }
});

test("caller cannot provide SQL or reach direct or indirect query execution", async () => {
  const calls = [];
  const observer = createDailyGoalReadOnlyObserver({
    openConnection: async () => mockConnection({ calls }),
  });
  await observer.withObservation({
    authorization: authorize(),
    expectedTarget,
    sql: "SELECT mutating_function(); DROP TABLE users",
    operation: async (snapshot) => {
      assert.equal(hasExecutableCapability(snapshot), false);
      assert.equal("sql" in snapshot, false);
    },
  });
  assert.deepEqual(calls, ["verify-read-only", "target-query", "history-query", "close"]);
});

test("connection is closed when the downstream callback fails without leaking the connection", async () => {
  const calls = [];
  const connection = mockConnection({ calls });
  const observer = createDailyGoalReadOnlyObserver({ openConnection: async () => connection });
  await assert.rejects(() => observer.withObservation({
    authorization: authorize(),
    expectedTarget,
    operation: async (snapshot) => {
      assert.equal(hasExecutableCapability(snapshot), false);
      throw new Error("callback failure");
    },
  }), (error) => {
    assert.equal(
      getDailyGoalPhaseBFailureCode(error),
      DAILY_GOAL_PHASE_B_FAILURE_CODES.UNKNOWN_PHASE_B_FAILURE,
    );
    return true;
  });
  assert.deepEqual(calls, ["verify-read-only", "target-query", "history-query", "close"]);
});

test("missing ownership evidence and connected identity mismatch fail closed", async () => {
  for (const targetRow of [
    observationRow({ ownership_marker: null }),
    observationRow({ ownership_marker: `${CI_EXCLUSIVE_OWNERSHIP_PREFIX}other.invalid:5432/elvocab_ci` }),
    observationRow({ ownership_marker: `${OWNERSHIP}:unexpected-suffix` }),
  ]) {
    let operationCalled = false;
    const observer = createDailyGoalReadOnlyObserver({
      openConnection: async () => mockConnection({ targetRow }),
    });
    await assert.rejects(() => observer.withObservation({
      authorization: authorize(),
      expectedTarget,
      operation: async () => { operationCalled = true; },
    }));
    assert.equal(operationCalled, false);
  }
});

test("observer refuses non-observation authorization before opening a connection", async () => {
  let opened = false;
  const observer = createDailyGoalReadOnlyObserver({
    openConnection: async () => { opened = true; return mockConnection(); },
  });
  await assert.rejects(() => observer.withObservation({
    authorization: { ...authorize(), operation: "migration" },
    expectedTarget,
    operation: async () => {},
  }), (error) => {
    assert.match(error.message, /Observation authorization/);
    assert.equal(
      getDailyGoalPhaseBFailureCode(error),
      DAILY_GOAL_PHASE_B_FAILURE_CODES.CONFIG_REJECTED,
    );
    return true;
  });
  assert.equal(opened, false);
});

test("Prisma migration history mapping distinguishes applied, failed and incomplete", () => {
  assert.deepEqual(mapPrismaMigrationHistory([
    migrationRow({ migration_name: "20260101000000_applied", finished_at: "2026-01-01", logs: "" }),
    migrationRow({ migration_name: "20260102000000_failed", logs: "failure" }),
    migrationRow({ migration_name: "20260103000000_rolled_back", rolled_back_at: "2026-01-03" }),
    migrationRow({ migration_name: "20260104000000_incomplete" }),
  ]), [
    { name: "20260101000000_applied", checksum: "a".repeat(64), status: "APPLIED" },
    { name: "20260102000000_failed", checksum: "a".repeat(64), status: "FAILED" },
    { name: "20260103000000_rolled_back", checksum: "a".repeat(64), status: "FAILED" },
    { name: "20260104000000_incomplete", checksum: "a".repeat(64), status: "INCOMPLETE" },
  ]);
});

function authorize() {
  return assertCiExclusiveDatabaseAuthorization(environment, {
    operation: CI_DATABASE_OPERATIONS.OBSERVATION,
  });
}

function mockConnection({
  calls = [],
  targetRow = observationRow(),
  publicHistoryRows = [migrationRow({ finished_at: "2026-01-01" })],
  shadowHistoryRows = [],
  readOnlyResult = readOnlyEvidence(),
  readOnlyError,
  targetError,
  historyError,
  closeError,
} = {}) {
  return {
    async establishAndVerifyReadOnly() {
      calls.push("verify-read-only");
      if (readOnlyError) throw readOnlyError;
      return readOnlyResult;
    },
    async query(sql) {
      if (sql === DAILY_GOAL_READ_ONLY_QUERIES.TARGET_OBSERVATION) {
        calls.push("target-query");
        if (targetError) throw targetError;
        return { rows: [targetRow] };
      }
      if (sql === DAILY_GOAL_READ_ONLY_QUERIES.MIGRATION_HISTORY) {
        calls.push(shadowHistoryRows.length > 0 ? "public-history-query" : "history-query");
        if (historyError) throw historyError;
        return { rows: publicHistoryRows };
      }
      if (/FROM\s+(?:"shadow"\.|"pg_temp"\.)?"_prisma_migrations"/i.test(sql)) {
        calls.push("shadow-history-query");
        return { rows: shadowHistoryRows };
      }
      throw new Error("Unexpected query.");
    },
    async close() {
      calls.push("close");
      if (closeError) throw closeError;
    },
  };
}

function readOnlyEvidence() {
  return {
    enforced: true,
    transactionReadOnly: true,
    evidenceSource: READ_ONLY_EVIDENCE_SOURCE,
  };
}

function hasExecutableCapability(value, seen = new Set()) {
  if (typeof value === "function") return true;
  if (!value || typeof value !== "object" || seen.has(value)) return false;
  seen.add(value);
  return Reflect.ownKeys(value).some((key) => hasExecutableCapability(value[key], seen));
}

function observationRow(overrides = {}) {
  return {
    database_name: "elvocab_ci",
    server_endpoint: "10.0.0.7",
    server_port: "5432",
    schema_name: "public",
    ownership_marker: OWNERSHIP,
    ...overrides,
  };
}

function migrationRow(overrides = {}) {
  return {
    migration_name: "20260101000000_base",
    checksum: "a".repeat(64),
    finished_at: null,
    rolled_back_at: null,
    logs: null,
    ...overrides,
  };
}
