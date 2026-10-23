import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  assertCiExclusiveDatabaseAuthorization,
  assertConnectedDatabaseIdentity,
  CI_DATABASE_OPERATIONS,
} from "../helpers/test-environment.js";
import { prepareDailyGoalDatabase } from "./daily-goal-database-preparation.js";

const SECRET = "never-print-this-secret";
const CI_IDENTITY = "ci-db.example.invalid:5432/elvocab_ci";
const legacyPreparationPath = fileURLToPath(
  new URL("../scripts/prepare-test-database.js", import.meta.url),
);
const dailyGoalPreparationPath = fileURLToPath(
  new URL("./daily-goal-database-preparation.js", import.meta.url),
);
const packagePath = fileURLToPath(new URL("../../package.json", import.meta.url));
const authorized = Object.freeze({
  CI: "true",
  GITHUB_ACTIONS: "true",
  NODE_ENV: "test",
  DAILY_GOAL_DATABASE_TARGET_CLASS: "CI_EXCLUSIVE",
  CI_TEST_DATABASE_URL: `postgresql://ci_user:${SECRET}@ci-db.example.invalid:5432/elvocab_ci`,
  CI_TEST_DATABASE_IDENTITY: CI_IDENTITY,
  DAILY_GOAL_APPROVED_TARGET_IDENTITY: CI_IDENTITY,
  DAILY_GOAL_MIGRATION_ALLOW: "true",
});

function reject(environment, operation = CI_DATABASE_OPERATIONS.MIGRATION) {
  let error;
  try {
    assertCiExclusiveDatabaseAuthorization(environment, { operation });
  } catch (caught) {
    error = caught;
  }
  assert.ok(error);
  assert.equal(error.code, "UNSAFE_TEST_DATABASE_CONFIGURATION");
  assert.doesNotMatch(error.message, new RegExp(SECRET));
  assert.doesNotMatch(error.message, /postgres(?:ql)?:\/\//i);
}

test("accepts a simulated exact CI-exclusive migration target without connecting", () => {
  const authorization = assertCiExclusiveDatabaseAuthorization(authorized, {
      operation: CI_DATABASE_OPERATIONS.MIGRATION,
    });
  assert.deepEqual(
    authorization,
    {
      databaseUrl: authorized.CI_TEST_DATABASE_URL,
      targetIdentity: CI_IDENTITY,
      operation: CI_DATABASE_OPERATIONS.MIGRATION,
    },
  );
  assert.equal(
    assertConnectedDatabaseIdentity(authorization, { targetIdentity: CI_IDENTITY }),
    CI_IDENTITY,
  );
});

test("rejects a connected-target observation that differs from authorization", () => {
  const authorization = assertCiExclusiveDatabaseAuthorization(authorized, {
    operation: CI_DATABASE_OPERATIONS.MIGRATION,
  });
  assert.throws(() =>
    assertConnectedDatabaseIdentity(authorization, {
      targetIdentity: "other.example.invalid:5432/elvocab_ci",
    }),
  );
  assert.throws(() => assertConnectedDatabaseIdentity(authorization, {}));
});

test("fails closed when required CI identity or authorization inputs are missing", () => {
  for (const key of [
    "CI",
    "GITHUB_ACTIONS",
    "NODE_ENV",
    "DAILY_GOAL_DATABASE_TARGET_CLASS",
    "CI_TEST_DATABASE_URL",
    "CI_TEST_DATABASE_IDENTITY",
    "DAILY_GOAL_APPROVED_TARGET_IDENTITY",
    "DAILY_GOAL_MIGRATION_ALLOW",
  ]) {
    const environment = { ...authorized };
    delete environment[key];
    reject(environment);
  }
});

test("rejects malformed, non-PostgreSQL, identity-mismatched and unlabeled targets", () => {
  for (const environment of [
    { ...authorized, CI_TEST_DATABASE_URL: "not-a-url" },
    { ...authorized, CI_TEST_DATABASE_URL: "mysql://ci-db.example.invalid/elvocab_ci" },
    { ...authorized, CI_TEST_DATABASE_URL: "postgresql://ci-db.example.invalid/" },
    { ...authorized, CI_TEST_DATABASE_URL: "postgresql://other.example.invalid/elvocab_ci" },
    { ...authorized, CI_TEST_DATABASE_IDENTITY: "other.example.invalid:5432/elvocab_ci" },
    { ...authorized, DAILY_GOAL_APPROVED_TARGET_IDENTITY: "other.example.invalid:5432/elvocab_ci" },
    { ...authorized, DAILY_GOAL_DATABASE_TARGET_CLASS: "test" },
  ]) reject(environment);
});

test("rejects Preview, Production, shared development and manual TEST identities", () => {
  for (const segment of ["preview", "production", "shared-dev", "manual-test", "main"]) {
    const identity = `ci-db.example.invalid:5432/elvocab_${segment}`;
    reject({
      ...authorized,
      CI_TEST_DATABASE_URL: `postgresql://ci_user:${SECRET}@ci-db.example.invalid:5432/elvocab_${segment}`,
      CI_TEST_DATABASE_IDENTITY: identity,
      DAILY_GOAL_APPROVED_TARGET_IDENTITY: identity,
    });
  }
});

test("rejects generic or legacy database URL injection and permits no fallback", () => {
  reject({ ...authorized, DATABASE_URL: authorized.CI_TEST_DATABASE_URL });
  reject({ ...authorized, TEST_DATABASE_URL: authorized.CI_TEST_DATABASE_URL });
  const missing = { ...authorized, DATABASE_URL: "postgresql://unsafe.invalid/prod" };
  delete missing.CI_TEST_DATABASE_URL;
  reject(missing);
});

test("requires exactly the permission matching migration, reset or state change", () => {
  const cases = [
    [CI_DATABASE_OPERATIONS.RESET, "DAILY_GOAL_RESET_ALLOW"],
    [CI_DATABASE_OPERATIONS.STATE_CHANGE, "DAILY_GOAL_STATE_CHANGE_ALLOW"],
  ];
  for (const [operation, permission] of cases) {
    const environment = { ...authorized };
    delete environment.DAILY_GOAL_MIGRATION_ALLOW;
    environment[permission] = "true";
    assert.equal(
      assertCiExclusiveDatabaseAuthorization(environment, { operation }).operation,
      operation,
    );
    reject({ ...environment, [permission]: "false" }, operation);
  }
  reject(authorized, CI_DATABASE_OPERATIONS.RESET);
  reject({ ...authorized, DAILY_GOAL_RESET_ALLOW: "true" });
  reject(authorized, "unknown");
});

test("all rejection diagnostics remain credential-safe", () => {
  for (const environment of [
    { ...authorized, DAILY_GOAL_MIGRATION_ALLOW: "false" },
    { ...authorized, CI_TEST_DATABASE_IDENTITY: SECRET },
    { ...authorized, CI_TEST_DATABASE_URL: `postgresql://user:${SECRET}@preview.invalid/prod` },
  ]) reject(environment);
});

test("Daily Goal preparation executes only after authorization and connected identity", async () => {
  const calls = [];
  const result = await prepareDailyGoalDatabase({
    environment: authorized,
    operation: CI_DATABASE_OPERATIONS.MIGRATION,
    observeConnectedIdentity: async ({ databaseUrl }) => {
      calls.push("observe");
      assert.equal(databaseUrl, authorized.CI_TEST_DATABASE_URL);
      return { targetIdentity: CI_IDENTITY };
    },
    executeProtectedOperation: async ({ targetIdentity, operation }) => {
      calls.push("execute");
      assert.equal(targetIdentity, CI_IDENTITY);
      assert.equal(operation, CI_DATABASE_OPERATIONS.MIGRATION);
      return "simulated-only";
    },
  });
  assert.equal(result, "simulated-only");
  assert.deepEqual(calls, ["observe", "execute"]);
});

test("Daily Goal preparation never observes or mutates after failed authorization", async () => {
  let observed = false;
  let executed = false;
  await assert.rejects(() =>
    prepareDailyGoalDatabase({
      environment: { ...authorized, CI: undefined },
      operation: CI_DATABASE_OPERATIONS.MIGRATION,
      observeConnectedIdentity: async () => {
        observed = true;
      },
      executeProtectedOperation: async () => {
        executed = true;
      },
    }),
  );
  assert.equal(observed, false);
  assert.equal(executed, false);
});

test("Daily Goal preparation never mutates when connected identity is absent or mismatched", async () => {
  for (const observation of [
    {},
    { targetIdentity: "other.example.invalid:5432/elvocab_ci" },
  ]) {
    let executed = false;
    await assert.rejects(() =>
      prepareDailyGoalDatabase({
        environment: authorized,
        operation: CI_DATABASE_OPERATIONS.MIGRATION,
        observeConnectedIdentity: async () => observation,
        executeProtectedOperation: async () => {
          executed = true;
        },
      }),
    );
    assert.equal(executed, false);
  }
});

test("Daily Goal preparation requires explicit observer and operation callbacks", async () => {
  await assert.rejects(() =>
    prepareDailyGoalDatabase({
      environment: authorized,
      operation: CI_DATABASE_OPERATIONS.MIGRATION,
      executeProtectedOperation: async () => {},
    }),
  );
  await assert.rejects(() =>
    prepareDailyGoalDatabase({
      environment: authorized,
      operation: CI_DATABASE_OPERATIONS.MIGRATION,
      observeConnectedIdentity: async () => ({ targetIdentity: CI_IDENTITY }),
    }),
  );
});

test("shared legacy preparation remains intact and Daily Goal orchestration has no DB runner", async () => {
  const [legacySource, dailyGoalSource, packageSource] = await Promise.all([
    readFile(legacyPreparationPath, "utf8"),
    readFile(dailyGoalPreparationPath, "utf8"),
    readFile(packagePath, "utf8"),
  ]);
  assert.match(legacySource, /configureTestEnvironment\(\{ requireReset: true \}\)/);
  assert.match(legacySource, /\[prismaCli, "migrate", "deploy"\]/);
  assert.doesNotMatch(legacySource, /assertCiExclusiveDatabaseAuthorization/);
  const packageJson = JSON.parse(packageSource);
  assert.equal(
    packageJson.scripts["test:db:prepare"],
    "node --env-file=.env.test test/scripts/prepare-test-database.js",
  );
  assert.equal(
    packageJson.scripts["test:db:prepare:ci"],
    "node test/scripts/prepare-test-database.js",
  );
  assert.doesNotMatch(dailyGoalSource, /node:child_process|Prisma|migrate\s+deploy|\.env\.test/);
});
