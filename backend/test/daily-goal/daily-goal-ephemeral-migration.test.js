import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  BASELINE_MIGRATIONS, createEphemeralVerificationHarness, createRefusalEvidence,
  EPHEMERAL_OPERATION, EphemeralMigrationFailure, MIGRATION_INVENTORY_DIGEST,
  migrationInventoryDigest, REVIEWED_INVENTORY, verifyCanonicalInventory,
} from "./daily-goal-ephemeral-migration-core.js";
import { withDailyGoalEphemeralWorkspace } from "./daily-goal-ephemeral-materialization.js";
import { createPrismaSubprocessEnvironment, parsePrismaPendingMigrations } from "./daily-goal-ephemeral-migration-cli.js";
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
      await activation.materializeDaily();
      const complete = await activation.verifyCompleteDestination();
      assert.equal(complete.digest, MIGRATION_INVENTORY_DIGEST);
    }});
    await assert.rejects(() => readFile(workspace), { code: "ENOENT" });
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

test("workflow is manual-only, default-disabled, pinned and local-only", async () => {
  const workflow = await readFile(workflowPath, "utf8");
  const cli = await readFile(path.join(root, "backend/test/daily-goal/daily-goal-ephemeral-migration-cli.js"), "utf8");
  assert.match(workflow, /^on:\n  workflow_dispatch:/m);
  assert.doesNotMatch(workflow, /^\s+(push|pull_request|schedule|workflow_call):/m);
  assert.match(workflow, /default: false/);
  assert.match(workflow, /image: postgres:17/);
  assert.match(workflow, /node node_modules\/prisma\/build\/index\.js generate/);
  assert.doesNotMatch(workflow, /\bnpx\b|secrets\.|postgres:latest/);
  assert.doesNotMatch(cli, /env:\s*\{\s*\.\.\.process\.env/);
});

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
  const draftSource = path.join(root, "backend/prisma/migration-drafts/daily-goal-v1", DAILY_GOAL_MIGRATION.name, "migration.sql");
  const draftDestination = path.join(fixture, "backend/prisma/migration-drafts/daily-goal-v1", DAILY_GOAL_MIGRATION.name, "migration.sql");
  await mkdir(path.dirname(draftDestination), { recursive: true });
  await cp(draftSource, draftDestination);
  return fixture;
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
