import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  APPROVED_INTEGRATED_HISTORY_TARGET,
  IntegratedHistoryVerificationError,
  assertIntegratedHistoryVerificationAuthorization,
  assertIntegratedSchemaOwnership,
  assertIntegratedScopedEnvironment,
  buildIntegratedSchemaContext,
  integratedHistoryDiscoveryPattern,
  scopedIntegratedDatabaseUrl,
  verifyHistoricalIntegratedCandidates,
} from "./streak-integrated-safety.js";

const workflowUrl = new URL("../../../.github/workflows/ci-integration.yml", import.meta.url);
const configUrl = new URL("../../../frontend/playwright.streak-integration.config.js", import.meta.url);
const baseConfigUrl = new URL("../../../frontend/playwright.integration.config.js", import.meta.url);
const setupUrl = new URL("../../../frontend/e2e/integration/streak-global-setup.js", import.meta.url);
const specUrl = new URL("../../../frontend/e2e/integration/streak-real-stack.spec.js", import.meta.url);
const harnessUrl = new URL("./streak-integrated-harness.js", import.meta.url);
const historyHarnessUrl = new URL("./streak-integrated-history-verification.js", import.meta.url);
const historyWorkflowUrl = new URL(
  "../../../.github/workflows/streak-integrated-history-verification.yml",
  import.meta.url,
);
const packageUrl = new URL("../../package.json", import.meta.url);
const prismaConfigUrl = new URL("../../prisma.config.ts", import.meta.url);
const serverUrl = new URL("../scripts/start-integration-server.js", import.meta.url);

const authorizedEnvironment = Object.freeze({
  CI: "true",
  GITHUB_ACTIONS: "true",
  NODE_ENV: "test",
  TEST_DATABASE_ALLOW_RESET: "true",
  STREAK_MIGRATION_HARNESS_ALLOW: "true",
  STREAK_INTEGRATED_HARNESS_ALLOW: "true",
  CI_TEST_DATABASE_IDENTITY: "ci.example.test:5432/elvocab_test",
  STREAK_MIGRATION_APPROVED_TARGET_IDENTITY: "ci.example.test:5432/elvocab_test",
  TEST_DATABASE_URL: "postgresql://user:secret@ci.example.test:5432/elvocab_test",
  GITHUB_REPOSITORY: "owner/elvocab",
  GITHUB_RUN_ID: "249001",
  GITHUB_RUN_ATTEMPT: "2",
});

test("TASK-249 workflow is affirmative dispatch-only and mutually exclusive", async () => {
  const workflow = await readFile(workflowUrl, "utf8");
  const jobStart = workflow.indexOf("  streak-integrated-verification:");
  const summaryStart = workflow.indexOf("  integration-summary:", jobStart);
  assert.ok(jobStart >= 0 && summaryStart > jobStart);
  const job = workflow.slice(jobStart, summaryStart);

  assert.match(workflow, /run_streak_integrated_verification:\r?\n[\s\S]*?default: false/);
  assert.match(job, /github\.event_name == 'workflow_dispatch'/);
  assert.match(job, /inputs\.run_streak_integrated_verification == true/);
  for (const conflictingMode of [
    "run_xp_migration_harness",
    "run_streak_migration_harness",
    "run_streak_migration_cleanup",
    "run_streak_foundation_harness",
  ]) assert.match(job, new RegExp(`inputs\\.${conflictingMode} == false`));
  assert.match(job, /inputs\.streak_cleanup_target_run_id == ''/);
  assert.match(job, /inputs\.streak_cleanup_target_run_attempt == ''/);
  assert.doesNotMatch(job, /pull_request|push:/);
});

test("TASK-249 workflow delegates only to the owned-schema harness", async () => {
  const [workflow, setup, harness, packageJson, prismaConfig, server] = await Promise.all([
    readFile(workflowUrl, "utf8"),
    readFile(setupUrl, "utf8"),
    readFile(harnessUrl, "utf8"),
    readFile(packageUrl, "utf8"),
    readFile(prismaConfigUrl, "utf8"),
    readFile(serverUrl, "utf8"),
  ]);
  for (const source of [workflow, setup]) {
    assert.match(source, /STREAK_INTEGRATED_HARNESS_ALLOW/);
  }
  assert.match(harness, /buildIntegratedSchemaContext/);
  for (const source of [workflow, setup]) {
    assert.match(source, /CI_TEST_DATABASE_IDENTITY/);
    assert.match(source, /STREAK_MIGRATION_APPROVED_TARGET_IDENTITY/);
    assert.match(source, /GITHUB_REPOSITORY/);
    assert.match(source, /GITHUB_RUN_ID/);
    assert.match(source, /GITHUB_RUN_ATTEMPT/);
    assert.match(source, /parsed\.hostname/);
  }
  assert.match(workflow, /npm run test:streak-integrated:ci/);
  assert.match(packageJson, /test:streak-integrated:ci/);
  assert.doesNotMatch(workflow.slice(workflow.indexOf("  streak-integrated-verification:")), /createTestDatabase|database\.reset\(\)/);
  assert.doesNotMatch(setup, /migrate["', ]+deploy|baseGlobalSetup/);
  assert.match(harness, /scopedIntegratedDatabaseUrl/);
  assert.match(harness, /STREAK_INTEGRATED_SCHEMA_NAME/);
  assert.match(harness, /STREAK_INTEGRATED_SCHEMA_MARKER/);
  assert.match(harness, /\[prismaCli, "migrate", "deploy"\][\s\S]*scopedEnvironment/);
  assert.match(harness, /playwright[\s\S]*scopedEnvironment/);
  assert.match(prismaConfig, /url: env\("DATABASE_URL"\)/);
  assert.match(server, /new PrismaClient\(\)/);
  assert.match(setup, /assertIntegratedScopedEnvironment/);
  assert.match(setup, /new PrismaClient\(\{ datasourceUrl: environment\.TEST_DATABASE_URL \}\)/);
  assert.match(harness, /finally[\s\S]*dropOwnedSchema/);
  assert.match(harness, /cleanupError[\s\S]*process\.exitCode = 1/);
  assert.match(harness, /async function dropOwnedSchema[\s\S]*assertIntegratedSchemaOwnership[\s\S]*DROP SCHEMA/);
  assert.match(harness, /if \(!row\) return/);
  assert.doesNotMatch(harness, /createTestDatabase|database\.reset\(/);
});

test("TASK-249 scoped environment rejects base, missing and mismatched ownership", () => {
  assert.throws(() => buildIntegratedSchemaContext({
    ...authorizedEnvironment,
    STREAK_INTEGRATED_HARNESS_ALLOW: undefined,
  }, "a1b2c3d4"));
  assert.throws(() => buildIntegratedSchemaContext({
    ...authorizedEnvironment,
    STREAK_MIGRATION_APPROVED_TARGET_IDENTITY: "other.example.test:5432/elvocab_test",
  }, "a1b2c3d4"));
  const context = buildIntegratedSchemaContext(authorizedEnvironment, "a1b2c3d4");
  const scopedUrl = scopedIntegratedDatabaseUrl(
    authorizedEnvironment.TEST_DATABASE_URL,
    context.schemaName,
  );
  const scoped = {
    ...authorizedEnvironment,
    TEST_DATABASE_URL: scopedUrl,
    DATABASE_URL: scopedUrl,
    STREAK_INTEGRATED_SCHEMA_NAME: context.schemaName,
    STREAK_INTEGRATED_SCHEMA_MARKER: context.marker,
  };
  assert.deepEqual(assertIntegratedScopedEnvironment(scoped).ownership, context.ownership);
  assert.throws(() => assertIntegratedScopedEnvironment({
    ...scoped,
    TEST_DATABASE_URL: authorizedEnvironment.TEST_DATABASE_URL,
    DATABASE_URL: authorizedEnvironment.TEST_DATABASE_URL,
  }));
  assert.throws(() => assertIntegratedScopedEnvironment({
    ...scoped,
    STREAK_INTEGRATED_SCHEMA_MARKER: undefined,
  }));
  assert.throws(() => assertIntegratedScopedEnvironment({
    ...scoped,
    STREAK_INTEGRATED_SCHEMA_NAME: "public",
  }));
  assert.throws(() => assertIntegratedSchemaOwnership({
    schemaName: context.schemaName,
    currentSchema: context.schemaName,
    marker: context.marker.replace(/.$/, "x"),
    ownership: context.ownership,
  }));
});

test("TASK-249 Playwright config runs only the focused real-stack Streak spec", async () => {
  const [config, baseConfig, spec] = await Promise.all([
    readFile(configUrl, "utf8"),
    readFile(baseConfigUrl, "utf8"),
    readFile(specUrl, "utf8"),
  ]);
  assert.match(config, /testMatch: "streak-real-stack\.spec\.js"/);
  assert.match(config, /globalSetup: "\.\/e2e\/integration\/streak-global-setup\.js"/);
  assert.match(config, /workers: 1/);
  assert.match(baseConfig, /testIgnore: "streak-real-stack\.spec\.js"/);
  assert.match(spec, /NORMAL, SRS and zero-correct Quiz qualify once while Speaking remains non-qualifying/);
  assert.match(spec, /\/api\/users\/me\/streak/);
  assert.match(spec, /sTREAK_DAY\.count/);
  assert.match(spec, /lEARNING_SESSION\.count/);
});

const historyEnvironment = Object.freeze({
  CI: "true",
  GITHUB_ACTIONS: "true",
  NODE_ENV: "test",
  STREAK_MIGRATION_HARNESS_ALLOW: "true",
  STREAK_INTEGRATED_HISTORY_VERIFY_ALLOW: "true",
  CI_TEST_DATABASE_IDENTITY: "ci.example.test:5432/elvocab_test",
  STREAK_MIGRATION_APPROVED_TARGET_IDENTITY: "ci.example.test:5432/elvocab_test",
  TEST_DATABASE_URL: "postgresql://user:secret@ci.example.test:5432/elvocab_test",
  GITHUB_REPOSITORY: "owner/elvocab",
  GITHUB_RUN_ID: "30000000",
  GITHUB_RUN_ATTEMPT: "1",
  STREAK_INTEGRATED_APPROVED_RUN_ID: "39278326097",
  STREAK_INTEGRATED_APPROVED_RUN_ATTEMPT: "1",
  STREAK_INTEGRATED_TARGET_RUN_ID: "39278326097",
  STREAK_INTEGRATED_TARGET_RUN_ATTEMPT: "1",
});

function historicalContext(overrides = {}) {
  return buildIntegratedSchemaContext({
    ...authorizedEnvironment,
    GITHUB_RUN_ID: "39278326097",
    GITHUB_RUN_ATTEMPT: "1",
    ...overrides,
  }, "a1b2c3d4");
}

function assertHistoryError(action, code) {
  assert.throws(action, (error) => {
    assert.equal(error instanceof IntegratedHistoryVerificationError, true);
    assert.equal(error.code, code);
    return true;
  });
}

test("historical integrated verification requires read-only authorization and exact target", () => {
  const authorized = assertIntegratedHistoryVerificationAuthorization(historyEnvironment);
  assert.deepEqual(authorized.targetIdentityForRun, {
    repository: "owner/elvocab",
    runId: "39278326097",
    attempt: "1",
  });
  assert.deepEqual(APPROVED_INTEGRATED_HISTORY_TARGET, {
    runId: "39278326097",
    attempt: "1",
  });
  assert.equal(
    integratedHistoryDiscoveryPattern("39278326097", "1"),
    "elvocab\\_streak\\_integrated\\_39278326097\\_1\\_%",
  );
  for (const environment of [
    { ...historyEnvironment, STREAK_INTEGRATED_HISTORY_VERIFY_ALLOW: undefined },
    { ...historyEnvironment, TEST_DATABASE_ALLOW_RESET: "true" },
    { ...historyEnvironment, STREAK_MIGRATION_CLEANUP_ALLOW: "true" },
    { ...historyEnvironment, STREAK_INTEGRATED_TARGET_RUN_ID: "" },
    { ...historyEnvironment, STREAK_INTEGRATED_TARGET_RUN_ID: "0" },
    { ...historyEnvironment, STREAK_INTEGRATED_TARGET_RUN_ID: "039278326097" },
    { ...historyEnvironment, STREAK_INTEGRATED_TARGET_RUN_ID: "3927832609739278326097" },
    { ...historyEnvironment, STREAK_INTEGRATED_TARGET_RUN_ID: "not-a-run" },
    { ...historyEnvironment, STREAK_INTEGRATED_TARGET_RUN_ATTEMPT: "" },
    { ...historyEnvironment, STREAK_INTEGRATED_TARGET_RUN_ATTEMPT: "0" },
    { ...historyEnvironment, STREAK_INTEGRATED_TARGET_RUN_ATTEMPT: "01" },
    { ...historyEnvironment, STREAK_INTEGRATED_TARGET_RUN_ATTEMPT: "attempt-1" },
    { ...historyEnvironment, STREAK_INTEGRATED_TARGET_RUN_ID: "39278326098" },
    { ...historyEnvironment, STREAK_INTEGRATED_TARGET_RUN_ATTEMPT: "2" },
    { ...historyEnvironment, STREAK_INTEGRATED_APPROVED_RUN_ID: "39278326098" },
    { ...historyEnvironment, STREAK_INTEGRATED_APPROVED_RUN_ATTEMPT: "2" },
    { ...historyEnvironment, STREAK_MIGRATION_APPROVED_TARGET_IDENTITY: "wrong.example:5432/elvocab_test" },
  ]) assert.throws(() => assertIntegratedHistoryVerificationAuthorization(environment));
});

test("historical integrated candidates distinguish absence and exact ownership", () => {
  const context = historicalContext();
  const identity = { repository: "owner/elvocab", runId: "39278326097", attempt: "1" };
  assert.deepEqual(verifyHistoricalIntegratedCandidates([], identity), { status: "ABSENT" });
  assert.deepEqual(
    verifyHistoricalIntegratedCandidates([
      { nspname: context.schemaName, marker: context.marker },
    ], identity),
    { status: "OWNED_SCHEMA_PRESENT", schemaName: context.schemaName, ownership: context.ownership },
  );
});

test("historical integrated candidates fail closed for missing or mismatched markers", () => {
  const context = historicalContext();
  const identity = { repository: "owner/elvocab", runId: "39278326097", attempt: "1" };
  assertHistoryError(
    () => verifyHistoricalIntegratedCandidates([{ nspname: context.schemaName, marker: null }], identity),
    "OWNERSHIP_MARKER_MISSING",
  );
  const wrongRunMarker = historicalContext({ GITHUB_RUN_ID: "39278326098" }).marker;
  assertHistoryError(
    () => verifyHistoricalIntegratedCandidates([
      { nspname: context.schemaName, marker: wrongRunMarker },
    ], identity),
    "OWNERSHIP_MARKER_MISMATCH",
  );
  const wrongAttemptMarker = historicalContext({ GITHUB_RUN_ATTEMPT: "2" }).marker;
  assertHistoryError(
    () => verifyHistoricalIntegratedCandidates([
      { nspname: context.schemaName, marker: wrongAttemptMarker },
    ], identity),
    "OWNERSHIP_MARKER_MISMATCH",
  );
  const wrongRepository = historicalContext({ GITHUB_REPOSITORY: "other/elvocab" }).marker;
  assertHistoryError(
    () => verifyHistoricalIntegratedCandidates([
      { nspname: context.schemaName, marker: wrongRepository },
    ], identity),
    "OWNERSHIP_MARKER_MISMATCH",
  );
});

test("historical integrated candidates reject wrong identity, malformed, mixed and base schemas", () => {
  const context = historicalContext();
  const identity = { repository: "owner/elvocab", runId: "39278326097", attempt: "1" };
  for (const row of [
    { nspname: "elvocab_streak_integrated_39278326098_1_a1b2c3d4", marker: context.marker },
    { nspname: "elvocab_streak_integrated_39278326097_2_a1b2c3d4", marker: context.marker },
    { nspname: "elvocab_streak_integrated_39278326097_1_bad", marker: context.marker },
    { nspname: "public", marker: context.marker },
  ]) assertHistoryError(
    () => verifyHistoricalIntegratedCandidates([row], identity),
    "INVALID_OR_AMBIGUOUS_CANDIDATES",
  );
  assertHistoryError(
    () => verifyHistoricalIntegratedCandidates([
      { nspname: context.schemaName, marker: context.marker },
      { nspname: "elvocab_streak_integrated_39278326097_1_deadbeef", marker: context.marker },
    ], identity),
    "INVALID_OR_AMBIGUOUS_CANDIDATES",
  );
});

test("historical integrated workflow and harness are dispatch-only and read-only", async () => {
  const [workflow, harness, safety, packageJsonSource] = await Promise.all([
    readFile(historyWorkflowUrl, "utf8"),
    readFile(historyHarnessUrl, "utf8"),
    readFile(new URL("./streak-integrated-safety.js", import.meta.url), "utf8"),
    readFile(packageUrl, "utf8"),
  ]);
  const packageJson = JSON.parse(packageJsonSource);
  assert.match(workflow, /^name: TASK-249 Historical Integrated Schema Verification/m);
  assert.match(workflow, /on:\r?\n\s+workflow_dispatch:/);
  assert.doesNotMatch(workflow, /pull_request:|push:/);
  assert.match(workflow, /authorize_read_only_verification:[\s\S]*?default: false/);
  assert.match(workflow, /if: inputs\.authorize_read_only_verification == true/);
  assert.match(workflow, /group: elvocab-ci-test-db/);
  assert.match(workflow, /TEST_DATABASE_ALLOW_RESET, undefined/);
  assert.match(workflow, /STREAK_INTEGRATED_APPROVED_RUN_ID: "39278326097"/);
  assert.match(workflow, /STREAK_INTEGRATED_APPROVED_RUN_ATTEMPT: "1"/);
  assert.match(workflow, /STREAK_INTEGRATED_TARGET_RUN_ID, environment\.STREAK_INTEGRATED_APPROVED_RUN_ID/);
  assert.match(workflow, /STREAK_INTEGRATED_TARGET_RUN_ATTEMPT, environment\.STREAK_INTEGRATED_APPROVED_RUN_ATTEMPT/);
  assert.doesNotMatch(workflow, /STREAK_MIGRATION_CLEANUP_ALLOW:\s*"true"/);
  assert.match(workflow, /npm run test:streak-integrated:history:ci/);
  assert.equal(
    packageJson.scripts["test:streak-integrated:history:ci"],
    "node test/streak/streak-integrated-history-verification.js",
  );
  assert.match(harness, /FROM pg_namespace/);
  assert.match(harness, /\$queryRaw`/);
  const authorizeAt = harness.indexOf("assertIntegratedHistoryVerificationAuthorization(process.env)");
  const importAt = harness.indexOf("await import(\"../../src/generated/prisma/client.ts\")");
  const connectAt = harness.indexOf("new PrismaClient", importAt);
  const queryAt = harness.indexOf("prisma.$queryRaw`", connectAt);
  assert.ok(authorizeAt >= 0 && importAt > authorizeAt && connectAt > importAt && queryAt > connectAt);
  const staticHarnessImports = [...harness.matchAll(/^import[\s\S]*?from\s+"([^"]+)";/gm)]
    .map((match) => match[1]);
  assert.deepEqual(staticHarnessImports, ["./streak-integrated-safety.js"]);
  const staticSafetyImports = [...safety.matchAll(/^import[\s\S]*?from\s+"([^"]+)";/gm)]
    .map((match) => match[1]);
  assert.deepEqual(staticSafetyImports, ["node:assert/strict", "./streak-migration-safety.js"]);
  assert.doesNotMatch(safety, /PrismaClient|src\/generated\/prisma|\$connect|\$disconnect|\$queryRaw/);
  for (const source of [workflow, harness, safety]) {
    assert.doesNotMatch(source, /DROP\s+SCHEMA|CREATE\s+SCHEMA|\$executeRaw|migrate\s+deploy|database\.reset|seed/i);
  }
});
