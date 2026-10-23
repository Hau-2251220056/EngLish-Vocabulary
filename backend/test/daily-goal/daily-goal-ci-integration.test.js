import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  assertCiExclusiveDatabaseAuthorization,
  CI_DATABASE_OPERATIONS,
} from "../helpers/test-environment.js";
import {
  createMigrationContextApproval,
  DAILY_GOAL_HISTORY_CONTEXTS,
  observeDailyGoalTarget,
  reviewMigrationHistoryContext,
} from "./daily-goal-ci-contract.js";

const IDENTITY = "ci-db.example.invalid:5432/elvocab_ci";
const DATABASE_URL_FIXTURE = "postgresql://ci-user:offline-only@ci-db.example.invalid:5432/elvocab_ci";
const OBSERVER_URL_FIXTURE = "postgresql://elvocab_daily_goal_observer.fmosmonrivuoacjfbmov:offline-only@ci-db.example.invalid:5432/elvocab_ci";
const baseEnvironment = Object.freeze({
  CI: "true",
  GITHUB_ACTIONS: "true",
  NODE_ENV: "test",
  DAILY_GOAL_DATABASE_TARGET_CLASS: "CI_EXCLUSIVE",
  CI_TEST_DATABASE_URL: DATABASE_URL_FIXTURE,
  DAILY_GOAL_OBSERVER_DATABASE_URL: OBSERVER_URL_FIXTURE,
  CI_TEST_DATABASE_IDENTITY: IDENTITY,
  DAILY_GOAL_APPROVED_TARGET_IDENTITY: IDENTITY,
});
const expectedTarget = Object.freeze({
  targetIdentity: IDENTITY,
  databaseName: "elvocab_ci",
  serverEndpoint: "10.0.0.8",
  serverPort: "5432",
  schemaName: "public",
  ownershipMarker: "human-confirmed-ci-exclusive",
});
const connectedObservation = Object.freeze({
  ...expectedTarget,
  evidenceSource: "CONNECTED_POSTGRESQL",
  derivedFromConfiguration: false,
});

test("observation permission authorizes only observation", () => {
  const observation = assertCiExclusiveDatabaseAuthorization({
    ...baseEnvironment,
    DAILY_GOAL_OBSERVATION_ALLOW: "true",
  }, { operation: CI_DATABASE_OPERATIONS.OBSERVATION });
  assert.equal(observation.operation, "observation");
  assert.equal(observation.databaseUrl, OBSERVER_URL_FIXTURE);

  for (const operation of [
    CI_DATABASE_OPERATIONS.MIGRATION,
    CI_DATABASE_OPERATIONS.RESET,
    CI_DATABASE_OPERATIONS.STATE_CHANGE,
  ]) {
    assert.throws(() => assertCiExclusiveDatabaseAuthorization({
      ...baseEnvironment,
      DAILY_GOAL_OBSERVATION_ALLOW: "true",
    }, { operation }), /not authorized|Ambiguous/);
  }
});

test("migration permission cannot authorize observation and contradictory flags fail closed", () => {
  assert.throws(() => assertCiExclusiveDatabaseAuthorization({
    ...baseEnvironment,
    DAILY_GOAL_MIGRATION_ALLOW: "true",
  }, { operation: CI_DATABASE_OPERATIONS.OBSERVATION }), /not authorized/);
  assert.throws(() => assertCiExclusiveDatabaseAuthorization({
    ...baseEnvironment,
    DAILY_GOAL_OBSERVATION_ALLOW: "true",
    DAILY_GOAL_MIGRATION_ALLOW: "true",
  }, { operation: CI_DATABASE_OPERATIONS.OBSERVATION }), /Ambiguous/);
});

test("observation keeps exact identity and no legacy URL fallback", () => {
  for (const override of [
    { CI_TEST_DATABASE_IDENTITY: "other.invalid:5432/elvocab_ci" },
    { DAILY_GOAL_APPROVED_TARGET_IDENTITY: "other.invalid:5432/elvocab_ci" },
    { DATABASE_URL: DATABASE_URL_FIXTURE },
    { TEST_DATABASE_URL: DATABASE_URL_FIXTURE },
  ]) {
    assert.throws(() => assertCiExclusiveDatabaseAuthorization({
      ...baseEnvironment,
      DAILY_GOAL_OBSERVATION_ALLOW: "true",
      ...override,
    }, { operation: CI_DATABASE_OPERATIONS.OBSERVATION }));
  }
  assert.throws(() => assertCiExclusiveDatabaseAuthorization({
    ...baseEnvironment,
    DAILY_GOAL_OBSERVER_DATABASE_URL: DATABASE_URL_FIXTURE,
    DAILY_GOAL_OBSERVATION_ALLOW: "true",
  }, { operation: CI_DATABASE_OPERATIONS.OBSERVATION }), /dedicated/);

  for (const username of ["observer", "postgres", "elvocab_daily_goal_observer.other-project"]) {
    assert.throws(() => assertCiExclusiveDatabaseAuthorization({
      ...baseEnvironment,
      DAILY_GOAL_OBSERVER_DATABASE_URL: `postgresql://${username}:offline-only@ci-db.example.invalid:5432/elvocab_ci`,
      DAILY_GOAL_OBSERVATION_ALLOW: "true",
    }, { operation: CI_DATABASE_OPERATIONS.OBSERVATION }), /approved dedicated observer principal/);
  }

  for (const observerUrl of [undefined, "not-a-url", "mysql://ci-db.example.invalid/elvocab_ci"]) {
    const candidate = { ...baseEnvironment, DAILY_GOAL_OBSERVATION_ALLOW: "true" };
    if (observerUrl === undefined) delete candidate.DAILY_GOAL_OBSERVER_DATABASE_URL;
    else candidate.DAILY_GOAL_OBSERVER_DATABASE_URL = observerUrl;
    assert.throws(() => assertCiExclusiveDatabaseAuthorization(candidate, {
      operation: CI_DATABASE_OPERATIONS.OBSERVATION,
    }));
  }
});

test("mocked observation requires independent connected evidence and no mutation capability", async () => {
  const authorization = assertCiExclusiveDatabaseAuthorization({
    ...baseEnvironment,
    DAILY_GOAL_OBSERVATION_ALLOW: "true",
  }, { operation: CI_DATABASE_OPERATIONS.OBSERVATION });
  const bindingToken = Object.freeze({ opaque: true });
  const verified = await observeDailyGoalTarget({
    authorization,
    expectedTarget,
    observationAdapter: async ({ requestedEvidenceSource }) => {
      assert.equal(requestedEvidenceSource, "CONNECTED_POSTGRESQL");
      return { observation: connectedObservation, targetBindingToken: bindingToken };
    },
  });
  assert.equal(verified.targetBindingToken, bindingToken);
  assert.equal(Object.hasOwn(verified, "execute"), false);
  assert.equal(hasExecutableCapability(verified.targetBindingToken), false);

  await assert.rejects(() => observeDailyGoalTarget({
    authorization,
    expectedTarget,
    observationAdapter: async () => ({
      observation: { ...connectedObservation, derivedFromConfiguration: true },
      targetBindingToken: bindingToken,
    }),
  }));
});

test("Context A and Context B approvals cannot be reused across destinations", () => {
  const migrations = [entry("20260101000000_base", "a"), entry("20261022000000_daily", "b")];
  const contextAApproval = createMigrationContextApproval({
    context: DAILY_GOAL_HISTORY_CONTEXTS.EXISTING_TARGET,
    targetIdentity: IDENTITY,
    schemaIdentity: "public",
    ownershipEvidence: "human-confirmed-ci-exclusive",
    pending: [migrations[1]],
  });
  const contextA = reviewMigrationHistoryContext({
    context: DAILY_GOAL_HISTORY_CONTEXTS.EXISTING_TARGET,
    targetIdentity: IDENTITY,
    schemaIdentity: "public",
    ownershipEvidence: "human-confirmed-ci-exclusive",
    reviewed: migrations,
    target: [{ ...migrations[0], status: "APPLIED" }],
    approval: contextAApproval,
  });
  assert.deepEqual(contextA.inventory.pending, [migrations[1]]);

  assert.throws(() => reviewMigrationHistoryContext({
    context: DAILY_GOAL_HISTORY_CONTEXTS.RUN_OWNED_SCHEMA,
    targetIdentity: IDENTITY,
    schemaIdentity: "elvocab_daily_goal_123_1_abcd1234",
    ownershipEvidence: "run-marker-123",
    reviewed: migrations,
    target: [],
    approval: contextAApproval,
  }), /does not belong/);
});

test("an empty run-owned schema requires the complete ordered migration history", () => {
  const migrations = [entry("20260101000000_base", "a"), entry("20261022000000_daily", "b")];
  const approval = createMigrationContextApproval({
    context: DAILY_GOAL_HISTORY_CONTEXTS.RUN_OWNED_SCHEMA,
    targetIdentity: IDENTITY,
    schemaIdentity: "elvocab_daily_goal_123_1_abcd1234",
    ownershipEvidence: "run-marker-123",
    pending: migrations,
  });
  const result = reviewMigrationHistoryContext({
    ...approval,
    reviewed: migrations,
    target: [],
    approval,
  });
  assert.deepEqual(result.inventory.pending, migrations);

  const dailyOnly = createMigrationContextApproval({ ...approval, pending: [migrations[1]] });
  assert.throws(() => reviewMigrationHistoryContext({
    ...approval,
    reviewed: migrations,
    target: [],
    approval: dailyOnly,
  }), /exactly match/);
});

test("history contexts reject extra, missing, divergent, failed, or unknown ownership state", () => {
  const migrations = [entry("20260101000000_base", "a"), entry("20261022000000_daily", "b")];
  const base = {
    context: DAILY_GOAL_HISTORY_CONTEXTS.EXISTING_TARGET,
    targetIdentity: IDENTITY,
    schemaIdentity: "public",
    ownershipEvidence: "human-confirmed-ci-exclusive",
  };
  const approval = createMigrationContextApproval({ ...base, pending: [migrations[1]] });
  for (const target of [
    [],
    [{ ...migrations[0], checksum: hash("x"), status: "APPLIED" }],
    [{ ...migrations[0], status: "FAILED" }],
    [{ ...entry("20260100500000_unknown", "z"), status: "APPLIED" }],
  ]) assert.throws(() => reviewMigrationHistoryContext({ ...base, reviewed: migrations, target, approval }));
  assert.throws(() => reviewMigrationHistoryContext({
    ...base,
    ownershipEvidence: "wrong-owner",
    reviewed: migrations,
    target: [{ ...migrations[0], status: "APPLIED" }],
    approval,
  }), /does not belong/);
});

test("workflow adds dormant Daily Goal modes without live database paths", async () => {
  const workflowPath = fileURLToPath(new URL("../../../.github/workflows/ci-integration.yml", import.meta.url));
  const workflow = await readFile(workflowPath, "utf8");
  assert.match(workflow, /run_daily_goal_migration_observation:/);
  assert.match(workflow, /run_daily_goal_migration_verification:/);
  assert.match(workflow, /daily_goal_approved_target_identity:/);
  assert.match(workflow, /group:\s*elvocab-ci-test-db/);

  for (const jobName of ["daily-goal-migration-observation", "daily-goal-migration-verification"]) {
    const job = extractJob(workflow, jobName);
    assert.match(job, /needs\.trust-gate\.outputs\.trusted == 'true'/);
    assert.match(job, /github\.event_name == 'workflow_dispatch'/);
    assert.match(job, /daily_goal_approved_target_identity == vars\.CI_TEST_DATABASE_IDENTITY/);
    assert.match(job, /&&\r?\n\s+false/);
    assert.doesNotMatch(job, /(?:^|\s)(?:CI_TEST_DATABASE_URL|TEST_DATABASE_URL):|migrate\s+(deploy|status)/im);
    if (jobName === "daily-goal-migration-observation") {
      assert.match(job, /DAILY_GOAL_OBSERVER_DATABASE_URL:\s*\$\{\{ secrets\.DAILY_GOAL_OBSERVER_DATABASE_URL \}\}/);
      assert.match(job, /run:\s*npm run test:daily-goal-phase-b:ci/);
      assert.match(job, /DAILY_GOAL_OBSERVATION_ALLOW:\s*"true"/);
      assert.doesNotMatch(job, /DAILY_GOAL_EXPECTED_SERVER_(?:ENDPOINT|PORT)|daily_goal_approved_server_endpoint/);
      assert.match(job, /DAILY_GOAL_EXPECTED_OWNERSHIP_MARKER:/);
      assert.doesNotMatch(job, /(?:CI_TEST_DATABASE_URL|TEST_DATABASE_URL):/);
    } else {
      assert.doesNotMatch(job, /DAILY_GOAL_OBSERVER_DATABASE_URL/);
    }
  }
});

test("workflow routes every guarded mode exclusively and ordinary events cannot select Daily Goal", async () => {
  const workflowPath = fileURLToPath(new URL("../../../.github/workflows/ci-integration.yml", import.meta.url));
  const workflow = await readFile(workflowPath, "utf8");
  const existingJobs = [
    "backend-db-integration", "real-stack-browser", "xp-migration-verification",
    "xp-migration-cleanup", "streak-migration-verification",
    "streak-migration-recovery-cleanup", "streak-foundation-verification",
    "streak-integrated-verification",
  ];
  for (const jobName of existingJobs) {
    const job = extractJob(workflow, jobName);
    assert.match(job, /run_daily_goal_migration_observation/);
    assert.match(job, /run_daily_goal_migration_verification/);
  }
  assert.match(workflow, /DAILY_GOAL_OBSERVATION_MODE/);
  assert.match(workflow, /DAILY_GOAL_VERIFICATION_MODE/);
  assert.match(workflow, /selected_modes/);
});

function entry(name, seed) {
  return { name, checksum: hash(seed) };
}

function hash(seed) {
  return createHash("sha256").update(seed).digest("hex");
}

function extractJob(workflow, jobName) {
  const escaped = jobName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = workflow.match(new RegExp(`^  ${escaped}:\\r?\\n([\\s\\S]*?)(?=^  [a-z][a-z0-9-]*:\\r?$|(?![\\s\\S]))`, "m"));
  assert.ok(match, `Expected workflow job ${jobName}.`);
  return match[0];
}

function hasExecutableCapability(value, seen = new Set()) {
  if (typeof value === "function") return true;
  if (!value || typeof value !== "object" || seen.has(value)) return false;
  seen.add(value);
  return Reflect.ownKeys(value).some((key) => hasExecutableCapability(value[key], seen));
}
