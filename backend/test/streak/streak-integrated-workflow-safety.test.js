import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  assertIntegratedSchemaOwnership,
  assertIntegratedScopedEnvironment,
  buildIntegratedSchemaContext,
  scopedIntegratedDatabaseUrl,
} from "./streak-integrated-safety.js";

const workflowUrl = new URL("../../../.github/workflows/ci-integration.yml", import.meta.url);
const configUrl = new URL("../../../frontend/playwright.streak-integration.config.js", import.meta.url);
const baseConfigUrl = new URL("../../../frontend/playwright.integration.config.js", import.meta.url);
const setupUrl = new URL("../../../frontend/e2e/integration/streak-global-setup.js", import.meta.url);
const specUrl = new URL("../../../frontend/e2e/integration/streak-real-stack.spec.js", import.meta.url);
const harnessUrl = new URL("./streak-integrated-harness.js", import.meta.url);
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
