import assert from "node:assert/strict";
import test from "node:test";
import {
  formatDailyGoalPhaseBFailure,
  readExpectedTarget,
  runDailyGoalPhaseBCli,
  runDailyGoalPhaseBMain,
} from "./daily-goal-phase-b-cli.js";
import {
  createDailyGoalPhaseBFailure,
  DAILY_GOAL_PHASE_B_FAILURE_CODES,
  getDailyGoalPhaseBFailureCode,
} from "./daily-goal-phase-b-diagnostics.js";

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
    assert.throws(() => readExpectedTarget(candidate), (error) => {
      assert.equal(
        getDailyGoalPhaseBFailureCode(error),
        DAILY_GOAL_PHASE_B_FAILURE_CODES.CONFIG_REJECTED,
      );
      return safeError(error);
    });
  }
  assert.throws(() => readExpectedTarget({
    ...environment, DAILY_GOAL_EXPECTED_OWNERSHIP_MARKER: `${MARKER}-extra`,
  }), (error) => {
    assert.equal(
      getDailyGoalPhaseBFailureCode(error),
      DAILY_GOAL_PHASE_B_FAILURE_CODES.CONFIG_REJECTED,
    );
    return safeError(error);
  });
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

test("CLI accepts only the private createSummary result without changing its schema", async () => {
  const output = [];
  const result = await runDailyGoalPhaseBCli({
    environment,
    writeOutput: (value) => output.push(value),
    runObservation: async ({ operation }) => operation(snapshot()),
  });
  assert.deepEqual(Object.keys(result), [
    "status", "target", "readOnlyTransactionVerified", "migrationHistory",
  ]);
  assert.deepEqual(JSON.parse(output[0]), result);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.target), true);
  assert.equal(Object.isFrozen(result.migrationHistory), true);
});

test("CLI rejects every unbranded or replaced runner result before serialization", async () => {
  const leakedUrl = environment.DAILY_GOAL_OBSERVER_DATABASE_URL;
  let hostileSerializationCalls = 0;
  const hostile = {
    status: "PASS",
    target: { identity: IDENTITY },
    toJSON() {
      hostileSerializationCalls += 1;
      return { leakedUrl };
    },
  };
  const candidates = [
    {},
    { status: "PASS", target: {}, readOnlyTransactionVerified: true, migrationHistory: [] },
    { leakedUrl },
    null,
    undefined,
    true,
    1,
    "PASS",
    [],
    hostile,
  ];

  for (const candidate of candidates) {
    const output = [];
    await assert.rejects(() => runDailyGoalPhaseBCli({
      environment,
      writeOutput: (value) => output.push(value),
      runObservation: async () => candidate,
    }), (error) => {
      assert.equal(
        getDailyGoalPhaseBFailureCode(error),
        DAILY_GOAL_PHASE_B_FAILURE_CODES.UNKNOWN_PHASE_B_FAILURE,
      );
      return safeError(error);
    });
    assert.deepEqual(output, []);
  }
  assert.equal(hostileSerializationCalls, 0);

  await assert.rejects(() => runDailyGoalPhaseBCli({
    environment,
    writeOutput: () => assert.fail("replaced summary must not be serialized"),
    runObservation: async ({ operation }) => ({ ...operation(snapshot()) }),
  }), (error) => {
    assert.equal(
      getDailyGoalPhaseBFailureCode(error),
      DAILY_GOAL_PHASE_B_FAILURE_CODES.UNKNOWN_PHASE_B_FAILURE,
    );
    return safeError(error);
  });

  let priorSummary;
  await runDailyGoalPhaseBCli({
    environment,
    writeOutput: () => {},
    runObservation: async ({ operation }) => {
      priorSummary = operation(snapshot());
      return priorSummary;
    },
  });
  await assert.rejects(() => runDailyGoalPhaseBCli({
    environment,
    writeOutput: () => assert.fail("stale summary must not be serialized"),
    runObservation: async () => priorSummary,
  }), (error) => {
    assert.equal(
      getDailyGoalPhaseBFailureCode(error),
      DAILY_GOAL_PHASE_B_FAILURE_CODES.UNKNOWN_PHASE_B_FAILURE,
    );
    return safeError(error);
  });
});

test("private diagnostic stages resist external property spoofing", () => {
  const forgedValues = [
    Object.freeze({ code: "DAILY_GOAL_PHASE_B_FAILED", failureCode: "DISCONNECT_FAILED" }),
    Object.seal(Object.assign(new Error("forged"), {
      code: "DAILY_GOAL_PHASE_B_FAILED",
      failureCode: "TARGET_VERIFICATION_FAILED",
      stage: "ROLLBACK_FAILED",
    })),
    null,
    undefined,
    true,
    1,
    "TARGET_OBSERVATION_FAILED",
  ];
  for (const value of forgedValues) {
    assert.equal(
      getDailyGoalPhaseBFailureCode(value),
      DAILY_GOAL_PHASE_B_FAILURE_CODES.UNKNOWN_PHASE_B_FAILURE,
    );
  }
  const invalidTrustedRequest = createDailyGoalPhaseBFailure("NOT_ALLOWLISTED");
  assert.equal(
    getDailyGoalPhaseBFailureCode(invalidTrustedRequest),
    DAILY_GOAL_PHASE_B_FAILURE_CODES.UNKNOWN_PHASE_B_FAILURE,
  );
});

test("CLI preserves trusted stage tags but rejects forged diagnostic properties", async () => {
  const trusted = createDailyGoalPhaseBFailure(
    DAILY_GOAL_PHASE_B_FAILURE_CODES.TARGET_VERIFICATION_FAILED,
  );
  await assert.rejects(() => runDailyGoalPhaseBCli({
    environment,
    writeOutput: () => {},
    runObservation: async () => { throw trusted; },
  }), (error) => {
    assert.equal(
      getDailyGoalPhaseBFailureCode(error),
      DAILY_GOAL_PHASE_B_FAILURE_CODES.TARGET_VERIFICATION_FAILED,
    );
    return true;
  });

  for (const forged of [
    { code: "TARGET_VERIFICATION_FAILED" },
    Object.assign(new Error(`raw ${environment.DAILY_GOAL_OBSERVER_DATABASE_URL}`), {
      code: "DAILY_GOAL_PHASE_B_FAILED",
      failureCode: "DISCONNECT_FAILED",
    }),
  ]) {
    await assert.rejects(() => runDailyGoalPhaseBCli({
      environment,
      writeOutput: () => {},
      runObservation: async () => { throw forged; },
    }), (error) => {
      assert.equal(
        getDailyGoalPhaseBFailureCode(error),
        DAILY_GOAL_PHASE_B_FAILURE_CODES.UNKNOWN_PHASE_B_FAILURE,
      );
      assert.equal(
        formatDailyGoalPhaseBFailure(error),
        "Daily Goal Phase B observation failed. Code: UNKNOWN_PHASE_B_FAILURE",
      );
      return safeError(error);
    });
  }
});

test("Phase B main emits one safe code and exits nonzero for every failure stage", async () => {
  const failures = [
    ...Object.values(DAILY_GOAL_PHASE_B_FAILURE_CODES)
      .filter((code) => code !== DAILY_GOAL_PHASE_B_FAILURE_CODES.UNKNOWN_PHASE_B_FAILURE)
      .map((code) => createDailyGoalPhaseBFailure(code)),
    new Error(`driver ${environment.DAILY_GOAL_OBSERVER_DATABASE_URL} SELECT secret`),
  ];

  for (const failure of failures) {
    const errors = [];
    const exitCodes = [];
    await runDailyGoalPhaseBMain({
      runCli: async () => { throw failure; },
      writeError: (value) => errors.push(value),
      setExitCode: (value) => exitCodes.push(value),
    });
    const stage = getDailyGoalPhaseBFailureCode(failure);
    assert.deepEqual(errors, [
      `Daily Goal Phase B observation failed. Code: ${stage}`,
    ]);
    assert.deepEqual(exitCodes, [1]);
    assert.doesNotMatch(
      errors[0],
      /postgres(?:ql)?:\/\/|secret|SELECT|elvocab_daily_goal_observer/i,
    );
  }
});

test("Phase B main establishes nonzero exit before diagnostic output", async () => {
  const events = [];
  await runDailyGoalPhaseBMain({
    runCli: async () => { throw new Error(`raw ${environment.DAILY_GOAL_OBSERVER_DATABASE_URL}`); },
    setExitCode: (value) => events.push(`exit:${value}`),
    writeError: (value) => events.push(`write:${value}`),
  });
  assert.deepEqual(events, [
    "exit:1",
    "write:Daily Goal Phase B observation failed. Code: UNKNOWN_PHASE_B_FAILURE",
  ]);
});

test("diagnostic writer failures retain nonzero exit and never expose their exceptions", async () => {
  const secret = environment.DAILY_GOAL_OBSERVER_DATABASE_URL;
  for (const writeError of [
    () => { throw new Error(`sync writer ${secret}`); },
    async () => { throw new Error(`async writer ${secret}`); },
    () => Promise.reject(Object.assign(new Error(`malicious ${secret}`), {
      code: "TARGET_VERIFICATION_FAILED",
      failureCode: "DISCONNECT_FAILED",
    })),
  ]) {
    const exitCodes = [];
    await assert.doesNotReject(() => runDailyGoalPhaseBMain({
      runCli: async () => { throw new Error(`primary ${secret}`); },
      setExitCode: (value) => exitCodes.push(value),
      writeError,
    }));
    assert.deepEqual(exitCodes, [1]);
  }
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
