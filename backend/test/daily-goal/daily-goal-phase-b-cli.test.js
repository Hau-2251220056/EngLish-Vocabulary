import assert from "node:assert/strict";
import test from "node:test";
import { readExpectedTarget, runDailyGoalPhaseBCli } from "./daily-goal-phase-b-cli.js";

const IDENTITY = "ci-db.example.invalid:5432/postgres";
const MARKER = `elvocab-ci-exclusive:v1:${IDENTITY}`;
const SECRET = "observer-secret-value";
const environment = Object.freeze({
  CI: "true", GITHUB_ACTIONS: "true", NODE_ENV: "test",
  DAILY_GOAL_DATABASE_TARGET_CLASS: "CI_EXCLUSIVE",
  DAILY_GOAL_OBSERVER_DATABASE_URL: `postgresql://elvocab_daily_goal_observer.fmosmonrivuoacjfbmov:${SECRET}@ci-db.example.invalid:5432/postgres`,
  CI_TEST_DATABASE_IDENTITY: IDENTITY,
  DAILY_GOAL_APPROVED_TARGET_IDENTITY: IDENTITY,
  DAILY_GOAL_OBSERVATION_ALLOW: "true",
  DAILY_GOAL_EXPECTED_DATABASE_NAME: "postgres",
  DAILY_GOAL_EXPECTED_SCHEMA_NAME: "public",
  DAILY_GOAL_EXPECTED_OWNERSHIP_MARKER: MARKER,
});

test("CLI passes the complete approved target to the existing guarded runner", async () => {
  const output = [];
  let received;
  const result = await runDailyGoalPhaseBCli({
    environment,
    writeOutput: (value) => output.push(value),
    runObservation: async (input) => {
      received = input;
      return input.operation(snapshot());
    },
  });
  assert.deepEqual(received.expectedTarget, {
    targetIdentity: IDENTITY, databaseName: "postgres",
    schemaName: "public", ownershipMarker: MARKER,
  });
  assert.equal(received.environment, environment);
  assert.equal(result.status, "PASS");
  assert.equal(result.target.ownershipMarkerVerified, true);
  assert.deepEqual(JSON.parse(output[0]), result);
});

test("expected target fails closed when any approved field is absent or marker differs", () => {
  for (const name of [
    "DAILY_GOAL_APPROVED_TARGET_IDENTITY", "DAILY_GOAL_EXPECTED_DATABASE_NAME",
    "DAILY_GOAL_EXPECTED_SCHEMA_NAME", "DAILY_GOAL_EXPECTED_OWNERSHIP_MARKER",
  ]) {
    const candidate = { ...environment };
    delete candidate[name];
    assert.throws(() => readExpectedTarget(candidate), safeError);
  }
  assert.throws(() => readExpectedTarget({
    ...environment, DAILY_GOAL_EXPECTED_OWNERSHIP_MARKER: `${MARKER}-extra`,
  }), safeError);
});

test("backend diagnostics come only from connected observation and remain allowlisted", async () => {
  assert.equal(Object.hasOwn(readExpectedTarget(environment), "serverEndpoint"), false);
  const result = await runDailyGoalPhaseBCli({
    environment,
    writeOutput: () => {},
    runObservation: async ({ operation }) => operation(snapshot({
      serverEndpoint: "2001:db8::25", serverPort: "6543",
    })),
  });
  assert.equal(result.target.serverEndpoint, "2001:db8::25");
  assert.equal(result.target.serverPort, "6543");
  assert.ok(Object.isFrozen(result.target));
});

test("CLI output is allowlisted and failures redact credentials and raw errors", async () => {
  const output = [];
  const result = await runDailyGoalPhaseBCli({
    environment,
    writeOutput: (value) => output.push(value),
    runObservation: async ({ operation }) => operation(snapshot()),
  });
  const serialized = JSON.stringify(result);
  assert.doesNotMatch(serialized, /postgres(?:ql)?:\/\//i);
  assert.doesNotMatch(serialized, /observer|secret|logs/i);
  assert.equal(Object.hasOwn(result, "targetBinding"), false);
  await assert.rejects(() => runDailyGoalPhaseBCli({
    environment,
    writeOutput: (value) => output.push(value),
    runObservation: async () => { throw new Error(`driver ${environment.DAILY_GOAL_OBSERVER_DATABASE_URL}`); },
  }), safeError);
  assert.equal(output.length, 1);
});

function snapshot(diagnostics = {}) {
  return Object.freeze({
    observation: Object.freeze({
      targetIdentity: IDENTITY, databaseName: "postgres", serverEndpoint: "10.0.0.8",
      serverPort: "5432", schemaName: "public", ownershipMarker: MARKER,
      ...diagnostics,
    }),
    readOnlyEvidence: Object.freeze({ enforced: true, transactionReadOnly: true }),
    history: Object.freeze([Object.freeze({
      name: "20260101000000_base", checksum: "a".repeat(64), status: "APPLIED",
      logs: "must-not-leak",
    })]),
  });
}

function safeError(error) {
  assert.equal(error.code, "DAILY_GOAL_PHASE_B_FAILED");
  assert.doesNotMatch(error.message, /postgres(?:ql)?:\/\//i);
  assert.doesNotMatch(error.message, /secret|driver|SELECT|SET|SHOW/i);
  return true;
}
