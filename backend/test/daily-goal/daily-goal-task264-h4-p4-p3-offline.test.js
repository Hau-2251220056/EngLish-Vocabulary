import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  DATABASE_IDENTITY, HarnessRefusal, MIGRATIONS, OPERATION, PHASES, REPOSITORY,
  SOURCE_REF, WORKFLOW, WORKFLOW_PATH, classifyFailure, createPhaseSequence,
  readBoundedRegularFile, sanitizeEnvironment, sha256, validateDatabaseObservation, validateExecutionIdentity,
  validateLocalDatabaseTarget, validateManifest, validateTemporaryWorkspace,
} from "./daily-goal-task264-h4-p4-p3-core.js";
import {
  HarnessPhaseFailure, classifyHarnessFailure, validateCanonicalMigrationDirectory,
} from "./daily-goal-task264-h4-p4-p3-cli.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(here, "../../..");
const workflowPath = path.join(repositoryRoot, WORKFLOW_PATH);
const cliPath = path.join(here, "daily-goal-task264-h4-p4-p3-cli.js");
const SHA = "a".repeat(40);

function identity(overrides = {}) {
  return {
    operation: OPERATION, authorized: "true", repository: REPOSITORY, sourceSha: SHA,
    sourceRef: SOURCE_REF, workflow: WORKFLOW, workflowRef: `${REPOSITORY}/${WORKFLOW_PATH}@${SOURCE_REF}`,
    workflowSha: SHA, expectedWorkflowSha: SHA, runAttempt: "1", ...overrides,
  };
}
function refusal(fn, code) { assert.throws(fn, (error) => error instanceof HarnessRefusal && error.code === code); }

test("authorization is default-deny and requires exact operation plus HUMAN boolean", () => {
  refusal(() => validateExecutionIdentity(identity({ operation: "NOT_AUTHORIZED" })), "AUTHORIZATION_DENIED");
  refusal(() => validateExecutionIdentity(identity({ authorized: "false" })), "AUTHORIZATION_DENIED");
});

test("repository, ref, workflow identity and source/workflow SHAs are immutable", () => {
  refusal(() => validateExecutionIdentity(identity({ repository: "foreign/repository" })), "IDENTITY_MISMATCH");
  refusal(() => validateExecutionIdentity(identity({ sourceRef: "refs/heads/main" })), "IDENTITY_MISMATCH");
  refusal(() => validateExecutionIdentity(identity({ workflowRef: "wrong" })), "WORKFLOW_REF_MISMATCH");
  refusal(() => validateExecutionIdentity(identity({ workflowSha: "b".repeat(40) })), "SHA_BINDING_MISMATCH");
  refusal(() => validateExecutionIdentity(identity({ sourceSha: "not-a-sha" })), "SHA_INVALID");
});

test("only first workflow attempt is accepted", () => {
  refusal(() => validateExecutionIdentity(identity({ runAttempt: "2" })), "RUN_ATTEMPT_DENIED");
  assert.equal(validateExecutionIdentity(identity()).sourceSha, SHA);
});

test("external and ambiguous database environment variables fail closed", () => {
  for (const key of ["DATABASE_URL", "TEST_DATABASE_URL", "CI_TEST_DATABASE_URL", "DIRECT_URL", "SHADOW_DATABASE_URL", "DAILY_GOAL_OBSERVER_DATABASE_URL", "SUPABASE_DB_URL", "PREVIEW_DATABASE_URL", "PRODUCTION_DATABASE_URL"]) {
    refusal(() => sanitizeEnvironment({ [key]: "postgresql://external.invalid/db" }), "EXTERNAL_DATABASE_ENVIRONMENT");
  }
  assert.deepEqual(sanitizeEnvironment({ PATH: "fixed", DATABASE_URL: "" }), { PATH: "fixed" });
});

test("job-local target is exact and does not permit arbitrary host, port, database or query", () => {
  const valid = "postgresql://task264_lifecycle_ephemeral:1234567890abcdef@127.0.0.1:5432/task264_lifecycle_ephemeral";
  assert.equal(validateLocalDatabaseTarget(valid).database, DATABASE_IDENTITY.database);
  for (const invalid of [undefined, "postgresql://u:p@example.com/db", valid.replace("5432", "5433"), valid.replace("task264_lifecycle_ephemeral", "other"), `${valid}?ssl=true`]) {
    refusal(() => validateLocalDatabaseTarget(invalid), "LOCAL_DATABASE_TARGET_INVALID");
  }
});

test("database observation requires PostgreSQL 17 exact identity and optional empty schema", () => {
  const valid = { database: DATABASE_IDENTITY.database, username: DATABASE_IDENTITY.username, host: "127.0.0.1", port: 5432, major: 17, publicTables: 0 };
  assert.equal(validateDatabaseObservation(valid, { requireEmpty: true }), true);
  refusal(() => validateDatabaseObservation({ ...valid, major: 16 }), "DATABASE_IDENTITY_MISMATCH");
  refusal(() => validateDatabaseObservation({ ...valid, publicTables: 1 }, { requireEmpty: true }), "DATABASE_NOT_EMPTY");
});

test("manifest requires exact four-artifact order, sizes, hashes and quarantine paths", () => {
  const manifest = manifestFixture();
  assert.equal(validateManifest(manifest).length, 4);
  refusal(() => validateManifest({ ...manifest, execution_order: [...manifest.execution_order].reverse() }), "MIGRATION_ORDER_MISMATCH");
  refusal(() => validateManifest({ ...manifest, artifacts: manifest.artifacts.slice(0, 2) }), "MIGRATION_INVENTORY_MISMATCH");
  const tampered = structuredClone(manifest); tampered.artifacts[0].sha256 = "0".repeat(64);
  refusal(() => validateManifest(tampered), "MANIFEST_ARTIFACT_MISMATCH");
});

test("manifest refuses authorization or execution-state tampering", () => {
  refusal(() => validateManifest({ ...manifestFixture(), activation_status: "AUTHORIZED" }), "MANIFEST_AUTHORIZATION_MISMATCH");
});

test("phase state machine rejects reordering, omission and repetition", () => {
  const sequence = createPhaseSequence();
  refusal(() => sequence.enter("TARGET"), "PHASE_ORDER_VIOLATION");
  for (const phase of PHASES) assert.equal(sequence.enter(phase), phase);
  assert.equal(sequence.complete(), true);
  refusal(() => sequence.enter("CLEANUP"), "PHASE_ORDER_VIOLATION");
  refusal(() => createPhaseSequence().complete(), "PHASE_INCOMPLETE");
});

test("failure classification exposes only bounded codes", () => {
  assert.deepEqual(classifyFailure(new HarnessRefusal("AUTHORIZATION_DENIED")), { outcome: "REFUSED", code: "AUTHORIZATION_DENIED" });
  assert.deepEqual(classifyFailure(new Error("postgresql://user:secret@host/db")), { outcome: "FAILED", code: "INTERNAL_FAILURE" });
});

test("internal failures expose only the fixed current phase", () => {
  const sensitive = "postgresql://user:secret@host/db SELECT * FROM private_table C:\\private\\fixture";
  for (const phase of ["IDENTITY", "CLIENT", "INTEGRATION", "CLEANUP"]) {
    const result = classifyHarnessFailure(new HarnessPhaseFailure(new Error(sensitive), phase));
    assert.deepEqual(result, { outcome: "FAILED", code: "INTERNAL_FAILURE", phase });
    const serialized = JSON.stringify(result);
    assert.doesNotMatch(serialized, /secret|private_table|private\\fixture|postgresql:\/\//);
  }
});

test("phase diagnostics preserve refusals and reject forged phase names", () => {
  assert.deepEqual(
    classifyHarnessFailure(new HarnessPhaseFailure(new HarnessRefusal("AUTHORIZATION_DENIED"), "IDENTITY")),
    { outcome: "REFUSED", code: "AUTHORIZATION_DENIED" },
  );
  assert.throws(
    () => new HarnessPhaseFailure(Object.assign(new Error("forged"), { phase: "FORGED" }), "FORGED"),
    /diagnostic phase is invalid/,
  );
  assert.deepEqual(
    classifyHarnessFailure(Object.assign(new Error("forged"), { phase: "CLIENT" })),
    { outcome: "FAILED", code: "INTERNAL_FAILURE" },
  );
});

test("temporary workspaces must be below the OS temp root and outside repository", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "task264-offline-"));
  try { assert.equal(await validateTemporaryWorkspace(directory, repositoryRoot), directory); }
  finally { await rm(directory, { recursive: true, force: true }); }
  await assert.rejects(validateTemporaryWorkspace(repositoryRoot, repositoryRoot), (error) => error.code === "WORKSPACE_UNSAFE");
});

test("symlinked workspace is rejected when host permits symlink creation", async (context) => {
  const parent = await mkdtemp(path.join(os.tmpdir(), "task264-symlink-"));
  const target = path.join(parent, "target"); const link = path.join(parent, "link");
  await mkdir(target);
  try { await symlink(target, link, "dir"); }
  catch (error) { await rm(parent, { recursive: true, force: true }); context.skip(`host cannot create directory symlink: ${error.code}`); return; }
  try { await assert.rejects(validateTemporaryWorkspace(link, repositoryRoot), (error) => error.code === "WORKSPACE_UNSAFE"); }
  finally { await rm(parent, { recursive: true, force: true }); }
});

test("bounded artifact reader rejects traversal, directories, empty/oversized files and symlinks", async (context) => {
  const parent = await mkdtemp(path.join(os.tmpdir(), "task264-artifacts-"));
  const root = path.join(parent, "root"); const outside = path.join(parent, "outside.sql");
  await mkdir(root); await writeFile(outside, "SELECT 1;\n");
  const valid = path.join(root, "valid.sql"); await writeFile(valid, "SELECT 1;\n");
  try {
    assert.equal((await readBoundedRegularFile(valid, { root, maximumBytes: 32 })).bytes.length, 10);
    await assert.rejects(readBoundedRegularFile(outside, { root }), (error) => error.code === "PATH_ESCAPE");
    await assert.rejects(readBoundedRegularFile(root, { root }), (error) => error.code === "PATH_ESCAPE" || error.code === "ARTIFACT_FILE_INVALID");
    const empty = path.join(root, "empty.sql"); await writeFile(empty, "");
    await assert.rejects(readBoundedRegularFile(empty, { root }), (error) => error.code === "ARTIFACT_FILE_INVALID");
    await assert.rejects(readBoundedRegularFile(valid, { root, maximumBytes: 2 }), (error) => error.code === "ARTIFACT_FILE_INVALID");
    const link = path.join(root, "linked.sql");
    try { await symlink(valid, link, "file"); }
    catch (error) { context.skip(`host cannot create file symlink: ${error.code}`); return; }
    await assert.rejects(readBoundedRegularFile(link, { root }), (error) => new Set(["PATH_ESCAPE", "ARTIFACT_FILE_INVALID"]).has(error.code));
  } finally { await rm(parent, { recursive: true, force: true }); }
});

test("bounded hashes detect SQL byte changes", () => {
  const bytes = Buffer.from("SELECT 1;\n");
  assert.notEqual(sha256(bytes), sha256(Buffer.from("SELECT 2;\n")));
});

test("canonical migration directories reject extra files, nested directories and linked SQL", async (context) => {
  const parent = await mkdtemp(path.join(os.tmpdir(), "task264-migration-dir-"));
  try {
    const canonical = path.join(parent, "canonical"); await mkdir(canonical);
    await writeFile(path.join(canonical, "migration.sql"), "SELECT 1;\n");
    assert.equal(await validateCanonicalMigrationDirectory(canonical), path.join(canonical, "migration.sql"));

    const extra = path.join(parent, "extra"); await mkdir(extra);
    await writeFile(path.join(extra, "migration.sql"), "SELECT 1;\n"); await writeFile(path.join(extra, "unexpected.txt"), "x");
    await assert.rejects(validateCanonicalMigrationDirectory(extra), /exactly one regular migration\.sql/);

    const nested = path.join(parent, "nested"); await mkdir(nested); await writeFile(path.join(nested, "migration.sql"), "SELECT 1;\n"); await mkdir(path.join(nested, "child"));
    await assert.rejects(validateCanonicalMigrationDirectory(nested), /exactly one regular migration\.sql/);

    const linked = path.join(parent, "linked"); await mkdir(linked);
    try { await symlink(path.join(canonical, "migration.sql"), path.join(linked, "migration.sql"), "file"); }
    catch (error) { context.skip(`host cannot create migration symlink: ${error.code}`); return; }
    await assert.rejects(validateCanonicalMigrationDirectory(linked), /exactly one regular migration\.sql/);
  } finally { await rm(parent, { recursive: true, force: true }); }
});

test("workflow is manual-only, default-deny, least privilege and guards precede database work", async () => {
  const workflow = await readFile(workflowPath, "utf8");
  assert.match(workflow, /^on:\n  workflow_dispatch:/m);
  assert.doesNotMatch(workflow, /\n  (push|pull_request|schedule):/);
  assert.match(workflow, /default: NOT_AUTHORIZED/);
  assert.match(workflow, /default: false/);
  assert.match(workflow, /permissions:\n  contents: read/);
  assert.match(workflow, /image: postgres:17/);
  assert.match(workflow, /npm ci --ignore-scripts/);
  assert.ok(workflow.indexOf("Verify immutable default-deny dispatch binding") < workflow.indexOf("services:"));
  assert.ok(workflow.indexOf("Run offline fail-closed safety suite") < workflow.indexOf("Run guarded disposable PostgreSQL verification"));
  assert.doesNotMatch(workflow, /pull_request_target|schedule:|\n\s+(DATABASE_URL|TEST_DATABASE_URL|CI_TEST_DATABASE_URL):|supabase|upload-artifact|git push|prisma migrate deploy/iu);
});

test("CLI source preserves identity-to-cleanup phase order and has no automatic invocation", async () => {
  const source = await readFile(cliPath, "utf8");
  let prior = -1;
  for (const phase of PHASES) { const position = source.indexOf(`phases.enter("${phase}")`); assert.ok(position > prior, phase); prior = position; }
  assert.match(source, /process\.argv\.length !== 3 \|\| process\.argv\[2\] !== "--run"/);
  assert.ok(source.indexOf('phases.enter("DATABASE_IDENTITY")') < source.indexOf('phases.enter("MIGRATE")'));
  assert.doesNotMatch(source, /shell:\s*true/);
});

test("production migration tree and scheduler remain disconnected", async () => {
  const migrationFiles = await import("node:fs/promises").then(({ readdir }) => readdir(path.join(repositoryRoot, "backend/prisma/migrations"), { recursive: true }));
  assert.equal(migrationFiles.some((entry) => /lifecycle|20261031|expired/i.test(entry)), false);
  const createApp = await readFile(path.join(repositoryRoot, "backend/src/create-app.js"), "utf8");
  assert.doesNotMatch(createApp, /createDailyGoalLifecycleMaintenanceRunner|runLifecycleMaintenance/);
});

test("fixture cleanup executes after a simulated failure", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "task264-cleanup-"));
  await writeFile(path.join(directory, "fixture"), "x");
  try { throw new Error("simulated"); } catch { await rm(directory, { recursive: true, force: true }); }
  await assert.rejects(readFile(path.join(directory, "fixture")), (error) => error.code === "ENOENT");
});

function manifestFixture() {
  const [base, ...rest] = MIGRATIONS;
  const record = (item) => ({ migration_name: item.name, quarantined_path: `backend/prisma/migration-drafts/daily-goal-v1/${item.name}/migration.sql`, byte_count: item.bytes, sha256: item.sha256 });
  return { base_dependency: record(base), execution_order: MIGRATIONS.map(({ name }) => name), artifacts: rest.map(record), activation_status: "NOT AUTHORIZED", database_execution: "NOT RUN" };
}
