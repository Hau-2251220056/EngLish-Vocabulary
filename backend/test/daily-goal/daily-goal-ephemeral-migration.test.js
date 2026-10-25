import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { EventEmitter } from "node:events";
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  BASELINE_MIGRATIONS, createEphemeralVerificationHarness, createRefusalEvidence,
  EPHEMERAL_OPERATION, EphemeralMigrationFailure, MIGRATION_INVENTORY_DIGEST,
  migrationInventoryDigest, REVIEWED_INVENTORY, verifyCanonicalInventory,
} from "./daily-goal-ephemeral-migration-core.js";
import { MIGRATION_LOCK, withDailyGoalEphemeralWorkspace } from "./daily-goal-ephemeral-materialization.js";
import {
  buildPrismaCommandArguments, createPrismaSubprocessEnvironment,
  EPHEMERAL_PRISMA_CONFIG_PATH, EPHEMERAL_PRISMA_SCHEMA_PATH,
  parsePrismaPendingMigrations, runGuardedPrismaGenerate,
  runGuardedPrismaCommandSequenceForTest, runGuardedPrismaMigrationCommandForTest,
  verifyStaticPrismaInputs,
} from "./daily-goal-ephemeral-migration-cli.js";
import { normalizeCatalogEvidence, expectedCatalogEvidence, runRequiredBehaviorProbes } from "./daily-goal-ephemeral-schema-verifier.js";
import { DAILY_GOAL_MIGRATION, DAILY_GOAL_SCHEMA_EVIDENCE } from "./daily-goal-phase-d-offline.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const workflowPath = path.join(root, ".github/workflows/daily-goal-ephemeral-migration.yml");

test("authorization and result provenance are single-use and binding-exact", async () => {
  const harness = createEphemeralVerificationHarness();
  const input = bindingInput();
  const authorization = harness.issueAuthorization(input);
  const otherAuthorization = harness.issueAuthorization(input);
  const calls = [];
  const trustedResult = await harness.run({ authorization, adapter: fakeAdapter(calls), activate: fakeActivation(calls) });
  await assert.rejects(() => harness.run({ authorization, adapter: fakeAdapter([]), activate: fakeActivation([]) }), /AUTHORIZATION_INVALID_OR_CONSUMED/);
  assert.throws(() => harness.verifyResult({ trustedResult, authorization: otherAuthorization, expectedBinding: input }), /RESULT_AUTHORIZATION_MISMATCH/);
  assert.throws(() => harness.verifyResult({ trustedResult, authorization, expectedBinding: { ...input, runId: "124" } }), /RESULT_BINDING_MISMATCH/);
  assert.throws(() => harness.verifyResult({ trustedResult, authorization, expectedBinding: { ...input, runAttempt: "3" } }), /RESULT_BINDING_MISMATCH/);
  assert.throws(() => harness.verifyResult({ trustedResult, authorization, expectedBinding: { ...input, sourceSha: "b".repeat(40) } }), /RESULT_BINDING_MISMATCH/);
  assert.throws(() => harness.verifyResult({ trustedResult: Object.freeze({}), authorization, expectedBinding: input }), /RESULT_INVALID_OR_CONSUMED/);
  const evidence = harness.verifyResult({ trustedResult, authorization, expectedBinding: input });
  assert.equal(evidence.outcome, "PORTABLE_MIGRATION_VERIFICATION_PASS");
  assert.equal(evidence.dg1Passed, false);
  assert.equal(evidence.supabaseCompatibilityVerified, false);
  assert.equal(evidence.deploymentAuthorized, false);
  assert.throws(() => harness.verifyResult({ trustedResult, authorization, expectedBinding: input }), /RESULT_INVALID_OR_CONSUMED/);
});

test("exact orchestration is verify11 deploy11 history11 materialize verify12 pending12 deploy12 history12 zero-pending", async () => {
  const calls = [];
  const harness = createEphemeralVerificationHarness();
  const input = bindingInput();
  const authorization = harness.issueAuthorization(input);
  const result = await harness.run({ authorization, adapter: fakeAdapter(calls), activate: fakeActivation(calls) });
  harness.verifyResult({ trustedResult: result, authorization, expectedBinding: input });
  assert.deepEqual(calls, [
    "fresh", "extensions", "verify:11", "deploy:11", "history:11", "materialize",
    "verify:12", "pending:daily", "verify:12", "deploy:12", "history:12", "pending:none", "schema", "disconnect",
  ]);
});

test("Prisma-backed pending parser accepts only explicit status output", () => {
  assert.deepEqual(parsePrismaPendingMigrations("Following migration have not yet been applied:\n20261022000000_add_daily_goal_v1\n\n"), [DAILY_GOAL_MIGRATION.name]);
  assert.deepEqual(parsePrismaPendingMigrations("Database schema is up to date!"), []);
  assert.throws(() => parsePrismaPendingMigrations("unknown output"), /not recognized/);
  assert.throws(() => parsePrismaPendingMigrations("Following migrations have not yet been applied:\n../../bad\n\n"), /malformed/);
});

test("source canonical inventory enforces exact LF bytes, order and hashes", async () => {
  const fixture = await createRepositoryFixture();
  try {
    const migrationsPath = path.join(fixture, "backend/prisma/migrations");
    const draftPath = path.join(fixture, "backend/prisma/migration-drafts/daily-goal-v1", DAILY_GOAL_MIGRATION.name, "migration.sql");
    assert.equal((await verifyCanonicalInventory({ migrationsPath, draftPath })).length, 12);
    await writeFile(path.join(migrationsPath, BASELINE_MIGRATIONS[0].name, "migration.sql"), "changed\r\n");
    await assert.rejects(() => verifyCanonicalInventory({ migrationsPath, draftPath }), /NON_LF_MIGRATION_BYTES/);
  } finally { await rm(fixture, { recursive: true, force: true }); }
});

test("destination inventory verifies exact 11 then exact 12 and cleans once", async () => {
  const fixture = await createRepositoryFixture();
  let workspace;
  try {
    await withDailyGoalEphemeralWorkspace({ repositoryRoot: fixture, operation: async (activation) => {
      workspace = activation.workspace;
      const baseline = await activation.verifyBaselineDestination();
      assert.equal(baseline.digest, migrationInventoryDigest(BASELINE_MIGRATIONS));
      assert.deepEqual(baseline.migrationLock, { byteCount: MIGRATION_LOCK.byteCount, checksum: MIGRATION_LOCK.checksum });
      await activation.materializeDaily();
      const complete = await activation.verifyCompleteDestination();
      assert.equal(complete.digest, MIGRATION_INVENTORY_DIGEST);
      assert.deepEqual(complete.migrationLock, { byteCount: MIGRATION_LOCK.byteCount, checksum: MIGRATION_LOCK.checksum });
    }});
    await assert.rejects(() => readFile(workspace), { code: "ENOENT" });
  } finally { await rm(fixture, { recursive: true, force: true }); }
});

test("migration lock source and destination layout fail closed", async () => {
  for (const mutate of [
    async (lock) => rm(lock),
    async (lock) => writeFile(lock, "provider = \"sqlite\"\n"),
    async (lock) => writeFile(lock, "provider = \"postgresql\"\r\n"),
    async (lock) => { await rm(lock); await mkdir(lock); },
    async (_lock, migrationsPath) => writeFile(path.join(migrationsPath, "extra.txt"), "unexpected\n"),
    async (_lock, migrationsPath) => mkdir(path.join(migrationsPath, "20261021999999_extra")),
  ]) {
    const fixture = await createRepositoryFixture();
    try {
      await assert.rejects(() => withDailyGoalEphemeralWorkspace({ repositoryRoot: fixture, operation: async (activation) => {
        const lock = path.join(activation.migrationsPath, MIGRATION_LOCK.name);
        await mutate(lock, activation.migrationsPath);
        await activation.verifyBaselineDestination();
      }}), /migration|inventory|regular file|LF-only/i);
    } finally { await rm(fixture, { recursive: true, force: true }); }
  }

  const badSource = await createRepositoryFixture();
  try {
    await writeFile(path.join(badSource, "backend/prisma/migrations", MIGRATION_LOCK.name), "provider = \"postgresql\"\r\n");
    await assert.rejects(() => withDailyGoalEphemeralWorkspace({ repositoryRoot: badSource, operation: async () => {} }), /LF-only/);
  } finally { await rm(badSource, { recursive: true, force: true }); }
});

test("migration lock symlink is refused when the platform permits symlink creation", async (t) => {
  const fixture = await createRepositoryFixture();
  try {
    await withDailyGoalEphemeralWorkspace({ repositoryRoot: fixture, operation: async (activation) => {
      const lock = path.join(activation.migrationsPath, MIGRATION_LOCK.name);
      const target = path.join(activation.workspace, "lock-target.toml");
      await writeFile(target, canonicalMigrationLockBytes());
      await rm(lock);
      try { await symlink(target, lock, "file"); }
      catch (error) {
        if (process.platform === "win32" && ["EPERM", "EACCES", "ENOTSUP"].includes(error.code)) {
          t.skip(`symlink creation blocked by Windows: ${error.code}`);
          return;
        }
        throw error;
      }
      await assert.rejects(() => activation.verifyBaselineDestination(), /inventory|regular file/i);
    }});
  } finally { await rm(fixture, { recursive: true, force: true }); }
});

test("destination 11 and destination 12 hash mismatches fail closed", async () => {
  for (const phase of [11, 12]) {
    const fixture = await createRepositoryFixture();
    try {
      await assert.rejects(() => withDailyGoalEphemeralWorkspace({ repositoryRoot: fixture, operation: async (activation) => {
        if (phase === 11) {
          await writeFile(path.join(activation.migrationsPath, BASELINE_MIGRATIONS[0].name, "migration.sql"), "tampered\n");
          await activation.verifyBaselineDestination();
          return;
        }
        await activation.verifyBaselineDestination();
        await activation.materializeDaily();
        await writeFile(path.join(activation.migrationsPath, DAILY_GOAL_MIGRATION.name, "migration.sql"), "tampered\n");
        await activation.verifyCompleteDestination();
      }}), /checksum mismatch/);
    } finally { await rm(fixture, { recursive: true, force: true }); }
  }
});

test("catalog normalization rejects PK, CHECK, index and FK contract mismatches", () => {
  const expected = expectedCatalogEvidence();
  const rows = catalogRows();
  assert.deepEqual(normalizeCatalogEvidence(rows), expected);
  for (const mutate of [
    (value) => { value.primaryKeys[0].columns = ["wrong_column", ...value.primaryKeys[0].columns]; },
    (value) => { value.checks[0].definition = "CHECK (daily_goal_minutes < 999)"; },
    (value) => { const target = value.indexes.find((item) => /CREATE UNIQUE INDEX/.test(item.definition)); target.definition = target.definition.replace("UNIQUE ", ""); },
    (value) => { value.foreignKeys[0].source_columns = ["wrong_column"]; },
    (value) => { value.foreignKeys[0].target_columns = ["wrong_column"]; },
    (value) => { value.foreignKeys[0].delete_action = "r"; },
  ]) {
    const changed = structuredClone(rows); mutate(changed);
    assert.notDeepEqual(normalizeCatalogEvidence(changed), expected);
  }
});

test("daily goal minutes CHECK accepts only the PostgreSQL 17 catalog shape and exact bounds", () => {
  const expected = expectedCatalogEvidence();
  const rows = catalogRows();
  assert.deepEqual(normalizeCatalogEvidence(rows), expected);

  const observedDefinition = rows.checks.find(({ name }) => name === "USER_daily_goal_minutes_check").definition;
  for (const invalidDefinition of [
    observedDefinition.replace("<= 240", "<= 241"),
    observedDefinition.replace(">= 10", ">= 9"),
    observedDefinition.replaceAll("daily_goal_minutes", "daily_goal_seconds"),
    observedDefinition.replace(">= 10", "> 10"),
    observedDefinition.replace(") AND\n        (daily_goal_minutes <= 240", ") OR\n        (daily_goal_minutes <= 240"),
  ]) {
    const changed = structuredClone(rows);
    changed.checks.find(({ name }) => name === "USER_daily_goal_minutes_check").definition = invalidDefinition;
    assert.notDeepEqual(normalizeCatalogEvidence(changed), expected);
  }
});

test("required CASCADE, SET NULL and RESTRICT probes confirm rollback; rollback failure is terminal", async () => {
  const client = behaviorClient();
  assert.deepEqual(await runRequiredBehaviorProbes(client), [
    "CASCADE:USER->DAILY_GOAL_DAY",
    "SET_NULL:DAILY_GOAL_TRACKING_SESSION->DAILY_GOAL_OWNER",
    "RESTRICT:DAILY_GOAL_TRACKING_SESSION->DAILY_GOAL_OPERATION_RECEIPT",
  ]);
  assert.equal(client.transactionCount, 3);
  const rollbackFailure = behaviorClient({ failRollback: true });
  await assert.rejects(() => runRequiredBehaviorProbes(rollbackFailure), /rollback failed/);
});

test("failure evidence and success evidence always remain non-authorizing", async () => {
  const refusal = createRefusalEvidence(new Error("postgresql://user:secret@example.invalid/db"));
  assert.deepEqual([refusal.dg1Passed, refusal.supabaseCompatibilityVerified, refusal.deploymentAuthorized], [false, false, false]);
  assert.doesNotMatch(JSON.stringify(refusal), /postgresql|secret|example/i);
  const calls = [];
  const adapter = fakeAdapter(calls); adapter.assertFresh = async () => { throw new Error("password=secret"); };
  const harness = createEphemeralVerificationHarness();
  await assert.rejects(() => harness.run({ authorization: harness.issueAuthorization(bindingInput()), adapter, activate: fakeActivation(calls) }), (error) => {
    assert.deepEqual([error.dg1Passed, error.supabaseCompatibilityVerified, error.deploymentAuthorized], [false, false, false]);
    assert.doesNotMatch(error.message, /password|secret/); return true;
  });
});

test("Prisma subprocess environment strips forbidden ambient credentials and NODE_OPTIONS", () => {
  const localUrl = "postgresql://daily_goal_ephemeral:job@127.0.0.1:5432/daily_goal_ephemeral";
  const environment = createPrismaSubprocessEnvironment({
    PATH: "/bin", HOME: "/home/runner", NODE_OPTIONS: "--require evil",
    DATABASE_URL: "external", TEST_DATABASE_URL: "external", CI_TEST_DATABASE_URL: "external",
    DAILY_GOAL_OBSERVER_DATABASE_URL: "external", AWS_SECRET_ACCESS_KEY: "secret", GITHUB_TOKEN: "secret",
  }, localUrl);
  assert.deepEqual({ ...environment }, { PATH: "/bin", HOME: "/home/runner", DAILY_GOAL_EPHEMERAL_JOB_DATABASE_URL: localUrl });
});

test("Prisma commands use private config and schema copies with exact reviewed bytes", async () => {
  await verifyStaticPrismaInputs();
  const configBytes = await readFile(EPHEMERAL_PRISMA_CONFIG_PATH);
  const schemaBytes = await readFile(EPHEMERAL_PRISMA_SCHEMA_PATH);
  const invocations = [];
  const cleanup = [];
  await runGuardedPrismaGenerate({
    sourceEnvironment: prismaTestEnvironment(),
    spawnProcess: prismaSpawn(async ({ args }) => invocations.push(await inspectPrivatePrismaArgs(args, configBytes, schemaBytes))),
    testHooks: { onCleanupAttempt: ({ label }) => cleanup.push(label) },
  });
  assert.deepEqual(invocations.map((item) => item.operation), ["generate"]);
  assert.deepEqual(cleanup.sort(), ["config", "schema"]);
  assert.throws(() => buildPrismaCommandArguments({ repositoryRoot: path.dirname(root), configPath: "x", schemaPath: "y", operation: "deploy" }), /reviewed root/);
  assert.throws(() => buildPrismaCommandArguments({ repositoryRoot: root, configPath: "x", schemaPath: "y", operation: "dev" }), /not allowed/);
  assert.equal(EPHEMERAL_PRISMA_SCHEMA_PATH, path.join(root, "backend/test/daily-goal/ephemeral-prisma-schema.prisma"));
  const config = configBytes.toString("utf8");
  assert.match(config, /env\("DAILY_GOAL_EPHEMERAL_JOB_DATABASE_URL"\)/);
  assert.doesNotMatch(config, /env\("(?:DATABASE_URL|TEST_DATABASE_URL|CI_TEST_DATABASE_URL|DAILY_GOAL_OBSERVER_DATABASE_URL|[^"\n]*SUPABASE[^"\n]*)"\)/i);
});

test("generate binds validated bytes despite source replacement and cleans exactly once", async () => {
  const originalConfig = await readFile(EPHEMERAL_PRISMA_CONFIG_PATH);
  const originalSchema = await readFile(EPHEMERAL_PRISMA_SCHEMA_PATH);
  const cleanup = [];
  let inspected;
  try {
    await runGuardedPrismaGenerate({
      sourceEnvironment: prismaTestEnvironment(),
      testHooks: {
        afterConfigSourceRead: async ({ sourcePath }) => writeFile(sourcePath, "malicious config\n"),
        afterSchemaSourceRead: async ({ sourcePath }) => writeFile(sourcePath, "malicious schema\n"),
        onCleanupAttempt: ({ label }) => cleanup.push(label),
      },
      spawnProcess: prismaSpawn(async ({ args }) => { inspected = await inspectPrivatePrismaArgs(args, originalConfig, originalSchema); }),
    });
  } finally {
    await writeFile(EPHEMERAL_PRISMA_CONFIG_PATH, originalConfig);
    await writeFile(EPHEMERAL_PRISMA_SCHEMA_PATH, originalSchema);
  }
  assert.equal(inspected.operation, "generate");
  assert.deepEqual(cleanup.sort(), ["config", "schema"]);
});

test("deploy and status use private copies and never repository source paths", async () => {
  const fixture = await mkdtemp(path.join(os.tmpdir(), "daily-goal-prisma-command-"));
  const schemaDirectory = path.join(fixture, "prisma");
  const schemaPath = path.join(schemaDirectory, "schema.prisma");
  const configBytes = await readFile(EPHEMERAL_PRISMA_CONFIG_PATH);
  const schemaBytes = await readFile(EPHEMERAL_PRISMA_SCHEMA_PATH);
  try {
    await mkdir(schemaDirectory);
    await writeFile(schemaPath, schemaBytes);
    for (const operation of ["deploy", "status"]) {
      let inspected;
      await runGuardedPrismaMigrationCommandForTest({
        schemaPath, operation, sourceEnvironment: prismaTestEnvironment(),
        spawnProcess: prismaSpawn(async ({ args }) => { inspected = await inspectPrivatePrismaArgs(args, configBytes, schemaBytes); }, operation === "status" ? 0 : 0, operation === "status" ? "Database schema is up to date!" : ""),
      });
      assert.equal(inspected.operation, operation);
      assert.notEqual(inspected.schemaPath, schemaPath);
      assert.notEqual(inspected.configPath, EPHEMERAL_PRISMA_CONFIG_PATH);
    }
  } finally { await rm(fixture, { recursive: true, force: true }); }
});

test("each command revalidates reused private config and its exact private schema", async () => {
  const fixture = await createPrismaSchemaFixture();
  let spawnCount = 0;
  try {
    await runGuardedPrismaCommandSequenceForTest({
      commands: [
        { schemaPath: fixture.schemaPath, operation: "deploy" },
        { schemaPath: fixture.schemaPath, operation: "status" },
      ],
      sourceEnvironment: prismaTestEnvironment(),
      spawnProcess: prismaSpawn(async () => { spawnCount += 1; }, 0, "Database schema is up to date!"),
    });
    assert.equal(spawnCount, 2);
  } finally { await rm(fixture.root, { recursive: true, force: true }); }
});

test("final validation boundary is synchronous and contains no post-validation hook", async () => {
  const cli = await readFile(path.join(root, "backend/test/daily-goal/daily-goal-ephemeral-migration-cli.js"), "utf8");
  const boundary = /function spawnPrismaAfterFinalValidation\([^)]*\) \{([\s\S]*?)\n\}/.exec(cli)?.[1];
  assert.ok(boundary);
  assert.match(boundary, /^\n  privateConfig\.revalidateSync\(\);\n  privateSchema\.revalidateSync\(\);\n  return spawnPrisma\(spawnInput\);$/);
  assert.doesNotMatch(boundary, /await|testHooks|callback|Promise/);
  assert.doesNotMatch(cli, /onInvocationValidation/);
  assert.equal((cli.match(/await spawnPrismaAfterFinalValidation\(\{/g) ?? []).length, 2);
  assert.equal((cli.match(/return spawnPrisma\(spawnInput\)/g) ?? []).length, 1);
});

test("pre-validation attack on generate is refused with zero spawns", async () => {
  let spawnCount = 0;
  await assert.rejects(() => runGuardedPrismaGenerate({
    sourceEnvironment: prismaTestEnvironment(),
    testHooks: { beforeInvocationValidation: async ({ schemaPath }) => writeFile(schemaPath, "mutated before final validation\n") },
    spawnProcess: prismaSpawn(async () => { spawnCount += 1; }),
  }), /destination bytes mismatch/);
  assert.equal(spawnCount, 0);
});

test("private config mutation between commands refuses before a second spawn", async () => {
  const fixture = await createPrismaSchemaFixture();
  let spawnCount = 0;
  try {
    await assert.rejects(() => runGuardedPrismaCommandSequenceForTest({
      commands: [
        { schemaPath: fixture.schemaPath, operation: "deploy" },
        { schemaPath: fixture.schemaPath, operation: "status" },
      ],
      sourceEnvironment: prismaTestEnvironment(),
      testHooks: { beforeInvocationValidation: async ({ operation, configPath }) => {
        if (operation === "status") await writeFile(configPath, "mutated private config\n");
      } },
      spawnProcess: prismaSpawn(async () => { spawnCount += 1; }, 0, "Database schema is up to date!"),
    }), /destination bytes mismatch/);
    assert.equal(spawnCount, 1);
  } finally { await rm(fixture.root, { recursive: true, force: true }); }
});

test("private schema mutation for the next command refuses before spawn", async () => {
  const fixture = await createPrismaSchemaFixture();
  let spawnCount = 0;
  try {
    await assert.rejects(() => runGuardedPrismaCommandSequenceForTest({
      commands: [
        { schemaPath: fixture.schemaPath, operation: "deploy" },
        { schemaPath: fixture.schemaPath, operation: "status" },
      ],
      sourceEnvironment: prismaTestEnvironment(),
      testHooks: { beforeInvocationValidation: async ({ operation, schemaPath }) => {
        if (operation === "status") { await rm(schemaPath); await mkdir(schemaPath); }
      } },
      spawnProcess: prismaSpawn(async () => { spawnCount += 1; }, 0, "Database schema is up to date!"),
    }), /regular file/);
    assert.equal(spawnCount, 1);
  } finally { await rm(fixture.root, { recursive: true, force: true }); }
});

test("private creation is exclusive and cleanup failures are terminal", async () => {
  await assert.rejects(() => runGuardedPrismaGenerate({
    sourceEnvironment: prismaTestEnvironment(),
    spawnProcess: prismaSpawn(async () => {}),
    testHooks: { beforePrivateWrite: async ({ label, destination }) => { if (label === "config") await mkdir(destination); } },
  }), /EEXIST|EISDIR|illegal operation|directory/i);

  await assert.rejects(() => runGuardedPrismaGenerate({
    sourceEnvironment: prismaTestEnvironment(),
    spawnProcess: prismaSpawn(async () => {}),
    testHooks: { afterPrivateWrite: async ({ label, destination }) => {
      if (label === "config") { await rm(destination); await mkdir(destination); }
    } },
  }), /regular file/i);

  const cleanup = [];
  await assert.rejects(() => runGuardedPrismaGenerate({
    sourceEnvironment: prismaTestEnvironment(),
    spawnProcess: prismaSpawn(async () => {}),
    testHooks: { failCleanupLabel: "config", onCleanupAttempt: ({ label }) => cleanup.push(label) },
  }), /cleanup failed/);
  assert.deepEqual(cleanup.sort(), ["config", "schema"]);

  const failedCleanup = [];
  await assert.rejects(() => runGuardedPrismaGenerate({
    sourceEnvironment: prismaTestEnvironment(),
    spawnProcess: prismaSpawn(async () => {}, 2),
    testHooks: { onCleanupAttempt: ({ label }) => failedCleanup.push(label) },
  }), /command failed/);
  assert.deepEqual(failedCleanup.sort(), ["config", "schema"]);
});

test("workflow is manual-only, default-disabled, pinned and local-only", async () => {
  const workflow = await readFile(workflowPath, "utf8");
  const cli = await readFile(path.join(root, "backend/test/daily-goal/daily-goal-ephemeral-migration-cli.js"), "utf8");
  assert.match(workflow, /^on:\n  workflow_dispatch:/m);
  assert.doesNotMatch(workflow, /^\s+(push|pull_request|schedule|workflow_call):/m);
  assert.match(workflow, /default: false/);
  assert.match(workflow, /image: postgres:17/);
  assert.match(workflow, /expected_source_sha:\n\s+description:[^\n]+\n\s+required: true\n\s+type: string/);
  assert.match(workflow, /expected_source_ref:\n\s+description:[^\n]+\n\s+required: true\n\s+type: string/);
  assert.doesNotMatch(workflow, /expected_source_sha:[\s\S]*?default:/);
  assert.match(workflow, /\[\[ "\$EXPECTED_SOURCE_SHA" =~ \^\[0-9a-f\]\{40\}\$ \]\]/);
  assert.match(workflow, /\[\[ "\$EXPECTED_SOURCE_SHA" == "\$EVENT_SHA" \]\]/);
  assert.match(workflow, /\[\[ "\$EXPECTED_SOURCE_REF" == "\$EVENT_REF" \]\]/);
  assert.match(workflow, /\[\[ "\$EVENT_REF" == "refs\/heads\/feature\/daily-goal-v1" \]\]/);
  assert.match(workflow, /\[\[ "\$WORKFLOW_SHA" == "\$EVENT_SHA" \]\]/);
  assert.match(workflow, /ref: \$\{\{ github\.sha \}\}/);
  assert.match(workflow, /CHECKOUT_SHA="\$\(git rev-parse HEAD\)"/);
  assert.match(workflow, /\[\[ "\$CHECKOUT_SHA" == "\$EVENT_SHA" \]\]/);
  assert.match(workflow, /git symbolic-ref -q HEAD/);
  assert.match(workflow, /node test\/daily-goal\/daily-goal-ephemeral-migration-cli\.js --generate/);
  assert.doesNotMatch(workflow, /node node_modules\/prisma\/build\/index\.js generate/);
  assert.doesNotMatch(workflow, /\bnpx\b|secrets\.|postgres:latest/);
  const runBlocks = [...workflow.matchAll(/\n\s+run: \|\n((?:\s{10,}.*\n?)*)/g)].map((match) => match[1]);
  assert.ok(runBlocks.length >= 3);
  for (const runBlock of runBlocks) assert.doesNotMatch(runBlock, /\$\{\{\s*inputs\./);
  const jobs = workflow.slice(workflow.indexOf("\njobs:\n"));
  const jobIds = [...jobs.matchAll(/^  ([a-z0-9-]+):\n/gm)].map((match) => match[1]);
  assert.deepEqual(jobIds, ["preflight", "ephemeral-migration"]);
  const preflightStart = jobs.indexOf("  preflight:\n");
  const migrationStart = jobs.indexOf("  ephemeral-migration:\n");
  const preflight = jobs.slice(preflightStart, migrationStart);
  const migrationJob = jobs.slice(migrationStart);
  assert.doesNotMatch(preflight, /^\s{4}(if|services):/m);
  assert.doesNotMatch(preflight, /actions\/checkout|actions\/setup-node|npm ci|node --test|prisma|DATABASE_URL|postgres:17/);
  for (const guard of [
    /"\$EVENT_NAME" == "workflow_dispatch"/,
    /"\$EVENT_REPOSITORY" == "Hau-2251220056\/EngLish-Vocabulary"/,
    /"\$REQUESTED_OPERATION" == "DAILY_GOAL_DG1_EPHEMERAL_POSTGRESQL_17"/,
    /"\$REQUESTED_AUTHORIZATION" == "true"/,
    /"\$EXPECTED_SOURCE_SHA" =~ \^\[0-9a-f\]\{40\}\$/,
    /"\$EXPECTED_SOURCE_SHA" == "\$EVENT_SHA"/,
    /"\$EXPECTED_SOURCE_REF" == "\$EVENT_REF"/,
    /"\$EVENT_REF" == "refs\/heads\/feature\/daily-goal-v1"/,
    /"\$WORKFLOW_SHA" == "\$EVENT_SHA"/,
    /"\$EVENT_RUN_ID" =~ \^\[0-9\]\+\$/,
    /"\$EVENT_RUN_ATTEMPT" =~ \^\[0-9\]\+\$/,
  ]) {
    assert.match(preflight, guard);
  }
  assert.ok((preflight.match(/exit 1/g) ?? []).length >= 11);
  assert.match(migrationJob, /^    needs: preflight$/m);
  assert.doesNotMatch(migrationJob, /always\s*\(/);
  assert.match(migrationJob, /^    services:\n\s+postgres:\n\s+image: postgres:17$/m);
  assert.equal((jobs.match(/image: postgres:17/g) ?? []).length, 1);
  assert.equal((jobs.match(/^    services:/gm) ?? []).length, 1);
  const guardIndex = jobs.indexOf("Verify immutable dispatch binding");
  const checkoutIndex = workflow.indexOf("Check out exact source revision");
  const installIndex = workflow.indexOf("Install locked backend dependencies");
  const focusedIndex = workflow.indexOf("Run focused offline migration verification");
  const generateIndex = workflow.indexOf("Generate the job-local raw-query Prisma client");
  const migrationIndex = workflow.indexOf("Run guarded ephemeral migration verification");
  assert.ok(guardIndex >= 0 && preflightStart < guardIndex && guardIndex < migrationStart);
  assert.ok(migrationStart < checkoutIndex && checkoutIndex < installIndex);
  assert.ok(installIndex < focusedIndex && focusedIndex < generateIndex && generateIndex < migrationIndex);
  assert.match(workflow, /node --test --test-concurrency=1 backend\/test\/daily-goal\/daily-goal-ephemeral-migration\.test\.js \| tee "\$report"/);
  assert.match(workflow, /set -euo pipefail/);
  assert.match(workflow, /grep -Eq '# \(SKIP\|TODO\)' "\$report"/);
  assert.doesNotMatch(cli, /env:\s*\{\s*\.\.\.process\.env/);
  assert.match(cli, /"--config", configPath/);
  assert.doesNotMatch(cli, /"--config", EPHEMERAL_PRISMA_CONFIG_PATH/);
  assert.doesNotMatch(cli, /(?:^|[^A-Z_])DATABASE_URL\s*=/m);
});

function prismaTestEnvironment() {
  return {
    PATH: process.env.PATH ?? "",
    DAILY_GOAL_EPHEMERAL_JOB_DATABASE_URL: "postgresql://daily_goal_ephemeral:job@127.0.0.1:5432/daily_goal_ephemeral",
  };
}

async function createPrismaSchemaFixture() {
  const fixture = await mkdtemp(path.join(os.tmpdir(), "daily-goal-prisma-sequence-"));
  const schemaDirectory = path.join(fixture, "prisma");
  const schemaPath = path.join(schemaDirectory, "schema.prisma");
  await mkdir(schemaDirectory);
  await writeFile(schemaPath, await readFile(EPHEMERAL_PRISMA_SCHEMA_PATH));
  return { root: fixture, schemaPath };
}

function prismaSpawn(inspect, exitCode = 0, stdoutText = "") {
  return (_executable, args, options) => {
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.kill = () => {};
    process.nextTick(async () => {
      try {
        await inspect({ args, options });
        if (stdoutText) child.stdout.write(stdoutText);
        child.stdout.end();
        child.stderr.end();
        child.emit("exit", exitCode);
      } catch (error) { child.emit("error", error); }
    });
    return child;
  };
}

async function inspectPrivatePrismaArgs(args, expectedConfig, expectedSchema) {
  const operation = args[1] === "generate" ? "generate" : args[2];
  const configPath = args[args.indexOf("--config") + 1];
  const schemaPath = args[args.indexOf("--schema") + 1];
  assert.notEqual(configPath, EPHEMERAL_PRISMA_CONFIG_PATH);
  assert.notEqual(schemaPath, EPHEMERAL_PRISMA_SCHEMA_PATH);
  assert.deepEqual(await readFile(configPath), expectedConfig);
  assert.deepEqual(await readFile(schemaPath), expectedSchema);
  assert.match(configPath, new RegExp(`^${escapeRegex(path.join(root, "backend"))}`));
  return { operation, configPath, schemaPath };
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function bindingInput() {
  return {
    operation: EPHEMERAL_OPERATION, authorized: "true", repository: "Hau-2251220056/EngLish-Vocabulary",
    sourceSha: "a".repeat(40), runId: "123", runAttempt: "2", workflow: "DG1", ref: "refs/heads/feature",
    postgresqlMajor: "17", inventoryDigest: MIGRATION_INVENTORY_DIGEST,
    dailyGoalSize: String(DAILY_GOAL_MIGRATION.byteCount), dailyGoalHash: DAILY_GOAL_MIGRATION.checksum,
  };
}

function fakeActivation(calls) {
  let materialized = false;
  return async (operation) => operation({
    migrationsPath: "/disposable/prisma/migrations", schemaPath: "/disposable/prisma/schema.prisma",
    artifact: { name: DAILY_GOAL_MIGRATION.name, checksum: DAILY_GOAL_MIGRATION.checksum, byteCount: DAILY_GOAL_MIGRATION.byteCount },
    verifyBaselineDestination: async () => { calls.push("verify:11"); return { count: 11, digest: migrationInventoryDigest(BASELINE_MIGRATIONS) }; },
    materializeDaily: async () => { calls.push("materialize"); materialized = true; },
    verifyCompleteDestination: async () => { assert.equal(materialized, true); calls.push("verify:12"); return { count: 12, digest: MIGRATION_INVENTORY_DIGEST }; },
  });
}

function fakeAdapter(calls) {
  let phase = 11;
  return {
    async assertFresh() { calls.push("fresh"); },
    async readExtensions() { calls.push("extensions"); return []; },
    async deploy({ expectedDigest }) { phase = expectedDigest === MIGRATION_INVENTORY_DIGEST ? 12 : 11; calls.push(`deploy:${phase}`); },
    async readHistory() { calls.push(`history:${phase}`); return (phase === 11 ? BASELINE_MIGRATIONS : REVIEWED_INVENTORY).map((item) => ({ ...item, status: "APPLIED" })); },
    async readPending() { calls.push(phase === 11 ? "pending:daily" : "pending:none"); return phase === 11 ? [DAILY_GOAL_MIGRATION.name] : []; },
    async readSchemaEvidence() { calls.push("schema"); return schemaEvidence(); },
    async disconnect() { calls.push("disconnect"); },
  };
}

function schemaEvidence() {
  const expected = expectedCatalogEvidence();
  const digest = createHash("sha256").update(JSON.stringify(expected)).digest("hex");
  const behavior = ["CASCADE:USER->DAILY_GOAL_DAY", "SET_NULL:DAILY_GOAL_TRACKING_SESSION->DAILY_GOAL_OWNER", "RESTRICT:DAILY_GOAL_TRACKING_SESSION->DAILY_GOAL_OPERATION_RECEIPT"];
  return { status: "VERIFIED", complete: true, rollbackVerified: true, observedCatalog: expected, expectedCatalog: expected, observedBehavior: behavior, expectedBehavior: behavior, observedCatalogDigest: digest, expectedCatalogDigest: digest };
}

async function createRepositoryFixture() {
  const fixture = await mkdtemp(path.join(os.tmpdir(), "dg1-repository-"));
  for (const migration of BASELINE_MIGRATIONS) {
    const source = path.join(root, "backend/prisma/migrations", migration.name, "migration.sql");
    const destination = path.join(fixture, "backend/prisma/migrations", migration.name, "migration.sql");
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, (await readFile(source, "utf8")).replace(/\r\n/g, "\n"));
  }
  await writeFile(path.join(fixture, "backend/prisma/migrations", MIGRATION_LOCK.name), canonicalMigrationLockBytes(), { flag: "wx" });
  const draftSource = path.join(root, "backend/prisma/migration-drafts/daily-goal-v1", DAILY_GOAL_MIGRATION.name, "migration.sql");
  const draftDestination = path.join(fixture, "backend/prisma/migration-drafts/daily-goal-v1", DAILY_GOAL_MIGRATION.name, "migration.sql");
  await mkdir(path.dirname(draftDestination), { recursive: true });
  await cp(draftSource, draftDestination);
  return fixture;
}

function canonicalMigrationLockBytes() {
  return Buffer.from("# Please do not edit this file manually\n# It should be added in your version-control system (e.g., Git)\nprovider = \"postgresql\"\n", "utf8");
}

function catalogRows() {
  const expected = expectedCatalogEvidence();
  return {
    tables: expected.tables.map((name) => ({ name })),
    columns: DAILY_GOAL_SCHEMA_EVIDENCE.columns.map(columnRow),
    enums: expected.enums.map((value) => { const [name, labels] = value.split(":"); return { name, labels: labels.split(",") }; }),
    primaryKeys: expected.primaryKeys.map(keyRow),
    uniqueConstraints: [],
    checks: DAILY_GOAL_SCHEMA_EVIDENCE.constraints.map((value) => {
      const separator = value.indexOf(":");
      const name = value.slice(0, separator);
      return {
        name,
        definition: name === "USER_daily_goal_minutes_check"
          ? `CHECK (((daily_goal_minutes IS NULL) OR
       ((daily_goal_minutes >= 10) AND
        (daily_goal_minutes <= 240))))`
          : `CHECK (${value.slice(separator + 1)})`,
      };
    }),
    indexes: expected.indexes.map(indexRow),
    foreignKeys: expected.foreignKeys.map(foreignKeyRow),
  };
}

function keyRow(value) { const [name, table, columns] = value.split(":"); return { name, table_name: table, columns: columns.split(",") }; }
function indexRow(value) {
  const [name, table, uniqueness, columns] = value.split(":");
  const definitionColumns = columns.split(",").map((item) => { const [column, order] = item.split(" "); return `"${column}"${order === "DESC" ? " DESC" : ""}`; }).join(", ");
  return { name, table_name: table, definition: `CREATE ${uniqueness === "UNIQUE" ? "UNIQUE " : ""}INDEX "${name}" ON "public"."${table}" USING btree (${definitionColumns})` };
}
function foreignKeyRow(value) {
  const [name, relation, onDelete, onUpdate] = value.split(":");
  const match = /^(\w+)\(([^)]*)\)->(\w+)\(([^)]*)\)$/.exec(relation);
  const code = { NO_ACTION: "a", RESTRICT: "r", CASCADE: "c", SET_NULL: "n", SET_DEFAULT: "d" };
  return { name, source_table: match[1], source_columns: match[2].split(","), target_table: match[3], target_columns: match[4].split(","), delete_action: code[onDelete.slice(10)], update_action: code[onUpdate.slice(10)] };
}
function columnRow(value) {
  const [identity, type, nullable, defaultValue] = value.split(":");
  const separator = identity.indexOf(".");
  const typeMap = { UUID: ["uuid", "uuid"], INTEGER: ["integer", "int4"], BIGINT: ["bigint", "int8"], DATE: ["date", "date"], BOOLEAN: ["boolean", "bool"], TEXT: ["text", "text"], JSONB: ["jsonb", "jsonb"] };
  let dataType; let udtName; let maximum = null; let precision = null;
  if (type.startsWith("TIMESTAMPTZ")) { dataType = "timestamp with time zone"; udtName = "timestamptz"; precision = Number(/\((\d+)\)/.exec(type)[1]); }
  else if (type.startsWith("VARCHAR")) { dataType = "character varying"; udtName = "varchar"; maximum = Number(/\((\d+)\)/.exec(type)[1]); }
  else if (typeMap[type]) [dataType, udtName] = typeMap[type];
  else { dataType = "USER-DEFINED"; udtName = type; }
  const defaults = { NO_DEFAULT: null, DEFAULT_0: "0", DEFAULT_CURRENT_TIMESTAMP: "CURRENT_TIMESTAMP", DEFAULT_ACTIVE: `'ACTIVE'::"DAILY_GOAL_TRACKING_STATUS"` };
  return { table_name: identity.slice(0, separator), column_name: identity.slice(separator + 1), data_type: dataType, udt_name: udtName, is_nullable: nullable === "NULLABLE" ? "YES" : "NO", column_default: defaults[defaultValue], character_maximum_length: maximum, datetime_precision: precision };
}

function behaviorClient({ failRollback = false } = {}) {
  let currentProbe = 0;
  const client = {
    transactionCount: 0,
    async $transaction(callback) {
      this.transactionCount += 1;
      const probe = currentProbe++;
      const tx = {
        async $executeRawUnsafe() { return 1; },
        async $executeRaw(strings) {
          const sql = strings.join("");
          if (probe === 2 && /DELETE FROM "DAILY_GOAL_TRACKING_SESSION"/.test(sql)) {
            const error = new Error("foreign key constraint"); error.meta = { code: "23503" }; throw error;
          }
          return 1;
        },
        async $queryRaw() {
          if (probe === 0) return [{ count: 0 }];
          if (probe === 1) return [{ tracking_session_id: null }];
          return [];
        },
      };
      try { return await callback(tx); } catch (error) {
        if (failRollback) throw new Error("rollback failed");
        throw error;
      }
    },
  };
  return client;
}
