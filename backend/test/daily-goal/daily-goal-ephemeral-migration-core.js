import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { DAILY_GOAL_MIGRATION } from "./daily-goal-phase-d-offline.js";

export const EPHEMERAL_OPERATION = "DAILY_GOAL_DG1_EPHEMERAL_POSTGRESQL_17";
export const EXPECTED_REPOSITORY = "Hau-2251220056/EngLish-Vocabulary";
export const POSTGRESQL_MAJOR = 17;
export const EXTENSION_ALLOWLIST = Object.freeze([]);
export const OUTPUT_LIMIT_BYTES = 16_384;
export const DIAGNOSTIC_STAGES = Object.freeze([
  "INPUT_BINDING", "SOURCE_INVENTORY", "PRIVATE_PRISMA_INPUTS", "FRESH_DATABASE", "EXTENSION_INVENTORY",
  "BASELINE_MATERIALIZATION", "BASELINE_DESTINATION", "BASELINE_DEPLOY", "BASELINE_HISTORY",
  "DAILY_GOAL_MATERIALIZATION", "DAILY_GOAL_PENDING_STATUS", "DAILY_GOAL_DEPLOY", "FINAL_HISTORY",
  "FINAL_PENDING_STATUS", "SCHEMA_EVIDENCE", "WORKSPACE_CLEANUP", "DISCONNECT",
]);
const GENERIC_CODES = Object.freeze(["OPERATION_FAILED", "CLEANUP_FAILED", "DISCONNECT_FAILED"]);
const STABLE_CODES = new Set([
  ...GENERIC_CODES, "BINDING_INCOMPLETE", "NOT_AUTHORIZED", "BINDING_MISMATCH", "AUTHORIZATION_INVALID_OR_CONSUMED",
  "RESULT_INVALID_OR_CONSUMED", "RESULT_AUTHORIZATION_MISMATCH", "RESULT_BINDING_MISMATCH", "BASELINE_INVENTORY_MISMATCH",
  "NON_LF_MIGRATION_BYTES", "MIGRATION_CHECKSUM_MISMATCH", "UNTRUSTED_BOUNDARY", "ADAPTER_INCOMPLETE",
  "EXTENSION_ALLOWLIST_MISMATCH", "MATERIALIZATION_MISMATCH", "DESTINATION_INVENTORY_MISMATCH",
  "MIGRATION_HISTORY_MISMATCH", "PRE_MIGRATION_PENDING_MISMATCH", "POST_MIGRATION_PENDING_MISMATCH",
  "SCHEMA_EVIDENCE_MISMATCH", "OUTPUT_LIMIT_EXCEEDED",
]);
const STAGE_SET = new Set(DIAGNOSTIC_STAGES);

export const BASELINE_MIGRATIONS = Object.freeze([
  entry("20260916042441_init_user_auth_session", "92035a5a775a727eeb0fb62aaa21036b66f3f5c6eac2284b6174382b617a8702"),
  entry("20260921000000_add_topic", "f6fe9833e31b6e17fd1965348c6945508765b782dbd1447b8a7317ca11dc9fad"),
  entry("20260921000001_add_vocabulary_aggregate", "831d2a2408e5d1cc129e88577425066db092c4b2914c206dd1a056a2591891a3"),
  entry("20260922000000_add_vocabulary_set", "4c7ba91a1230a5772b89e126d6fe90d91115530651bfd44471078b8a3b691afb"),
  entry("20260923000000_add_learning_progress", "d7c6aa672a360c54c9565f22a93437fbed38c04c77edc7ab8c6437f0f5da7079"),
  entry("20260928000000_add_personal_vocabulary_foundation", "c44e2418cfa0a330620ffa961ddb21e1f58c56277b162ecb8d20fe22f60ce7f8"),
  entry("20260930000000_decouple_personal_set_topic", "065a2a4932186d963d36a7a0382be407c05414baa4c35290a672d733a3c8ce94"),
  entry("20261007000000_add_vocabulary_set_metadata", "3e0e6b8927174349e41c8a639f964a52e458cb16f378b1aace701cf77f3d7415"),
  entry("20261016000000_add_xp_level_v1", "8bcf4228f178601d19416cd40c2d1736a36b9e2eab8a73c037a4ae2ce414abae"),
  entry("20261017000000_add_streak_v1", "8ac6901420011a9a2721660add430136772c5581e46b67ae1d72cd04d001bedc"),
  entry("20261018000000_add_streak_srs_receipt", "c123f901cd02f81dd87758618b7b06917640968122bf60df67b077694b60b4da"),
]);

export const REVIEWED_INVENTORY = Object.freeze([...BASELINE_MIGRATIONS, entry(DAILY_GOAL_MIGRATION.name, DAILY_GOAL_MIGRATION.checksum)]);
export const MIGRATION_INVENTORY_DIGEST = digest(REVIEWED_INVENTORY);

export class EphemeralMigrationFailure extends Error {
  constructor(code, stage, cleanupStage) {
    const safeCode = STABLE_CODES.has(code) ? code : "OPERATION_FAILED";
    const safeStage = STAGE_SET.has(stage) ? stage : undefined;
    const safeCleanupStage = STAGE_SET.has(cleanupStage) ? cleanupStage : undefined;
    super(`Daily Goal ephemeral migration verification refused. Code: ${safeCode}`);
    this.name = "EphemeralMigrationFailure";
    this.code = safeCode;
    if (safeStage) this.stage = safeStage;
    if (safeCleanupStage) this.cleanupStage = safeCleanupStage;
    this.dg1Passed = false;
    this.supabaseCompatibilityVerified = false;
    this.deploymentAuthorized = false;
  }
}

export function validateEphemeralBinding(input) {
  const required = ["operation", "repository", "sourceSha", "runId", "runAttempt", "workflow", "ref"];
  if (!input || required.some((field) => typeof input[field] !== "string" || input[field].length === 0)) fail("BINDING_INCOMPLETE");
  if (input.operation !== EPHEMERAL_OPERATION || input.authorized !== "true") fail("NOT_AUTHORIZED");
  if (input.repository !== EXPECTED_REPOSITORY || !/^[a-f0-9]{40}$/.test(input.sourceSha)
    || !/^\d+$/.test(input.runId) || !/^\d+$/.test(input.runAttempt)
    || input.postgresqlMajor !== String(POSTGRESQL_MAJOR)
    || input.inventoryDigest !== MIGRATION_INVENTORY_DIGEST
    || input.dailyGoalSize !== String(DAILY_GOAL_MIGRATION.byteCount)
    || input.dailyGoalHash !== DAILY_GOAL_MIGRATION.checksum) fail("BINDING_MISMATCH");
  return deepFreeze({
    repository: input.repository, sourceSha: input.sourceSha, runId: input.runId,
    runAttempt: input.runAttempt, workflow: input.workflow, ref: input.ref,
    postgresqlMajor: POSTGRESQL_MAJOR, inventoryDigest: MIGRATION_INVENTORY_DIGEST,
  });
}

export async function verifyCanonicalInventory({ migrationsPath, draftPath }) {
  const names = (await readdir(migrationsPath, { withFileTypes: true }))
    .filter((item) => item.isDirectory()).map((item) => item.name).sort();
  if (stable(names) !== stable(BASELINE_MIGRATIONS.map((item) => item.name))) fail("BASELINE_INVENTORY_MISMATCH");
  for (const expected of BASELINE_MIGRATIONS) {
    await verifyLfArtifact(path.join(migrationsPath, expected.name, "migration.sql"), expected);
  }
  await verifyLfArtifact(draftPath, { ...DAILY_GOAL_MIGRATION });
  return REVIEWED_INVENTORY;
}

export function createEphemeralVerificationHarness() {
  const authorizations = new WeakMap();
  const results = new WeakMap();

  function issueAuthorization(input) {
    const binding = validateEphemeralBinding(input);
    const token = Object.freeze(Object.create(null));
    authorizations.set(token, { binding, digest: bindingDigest(binding), consumed: false });
    return token;
  }

  async function run({ authorization, activate, adapter }) {
    const trusted = authorizations.get(authorization);
    if (!trusted || trusted.consumed) fail("AUTHORIZATION_INVALID_OR_CONSUMED");
    trusted.consumed = true;
    const evidence = await runTrustedVerification({ binding: trusted.binding, activate, adapter });
    const token = Object.freeze(Object.create(null));
    results.set(token, { authorization, bindingDigest: trusted.digest, evidence, consumed: false });
    return token;
  }

  function verifyResult({ trustedResult, authorization, expectedBinding }) {
    const stored = results.get(trustedResult);
    if (!stored || stored.consumed) fail("RESULT_INVALID_OR_CONSUMED");
    if (stored.authorization !== authorization) fail("RESULT_AUTHORIZATION_MISMATCH");
    const normalized = validateEphemeralBinding(expectedBinding);
    if (bindingDigest(normalized) !== stored.bindingDigest) fail("RESULT_BINDING_MISMATCH");
    stored.consumed = true;
    return stored.evidence;
  }

  return Object.freeze({ issueAuthorization, run, verifyResult });
}

async function runTrustedVerification({ binding, activate, adapter }) {
  if (typeof activate !== "function" || !adapter) fail("UNTRUSTED_BOUNDARY");
  for (const method of ["assertFresh", "deploy", "readHistory", "readPending", "readExtensions", "readSchemaEvidence", "disconnect"]) {
    if (typeof adapter[method] !== "function") fail("ADAPTER_INCOMPLETE");
  }
  let disconnectAttempted = false;
  let evidence;
  let primaryFailure;
  try {
    await runDiagnosticStage("FRESH_DATABASE", () => adapter.assertFresh(binding));
    await runDiagnosticStage("EXTENSION_INVENTORY", async () => assertExactList(await adapter.readExtensions(), EXTENSION_ALLOWLIST, "EXTENSION_ALLOWLIST_MISMATCH"));
    await runDiagnosticStage("BASELINE_MATERIALIZATION", () => activate(async ({ migrationsPath, schemaPath, artifact, verifyBaselineDestination, materializeDaily, verifyCompleteDestination }) => {
      if (artifact.name !== DAILY_GOAL_MIGRATION.name || artifact.checksum !== DAILY_GOAL_MIGRATION.checksum
        || artifact.byteCount !== DAILY_GOAL_MIGRATION.byteCount) fail("MATERIALIZATION_MISMATCH");
      const baselineDestination = await runDiagnosticStage("BASELINE_DESTINATION", async () => {
        const result = await verifyBaselineDestination();
        assertDestination(result, BASELINE_MIGRATIONS);
        return result;
      });
      await runDiagnosticStage("BASELINE_DEPLOY", () => adapter.deploy({ migrationsPath, schemaPath, expectedDigest: baselineDestination.digest }));
      await runDiagnosticStage("BASELINE_HISTORY", async () => assertHistory(await adapter.readHistory(), BASELINE_MIGRATIONS));
      await runDiagnosticStage("DAILY_GOAL_MATERIALIZATION", materializeDaily);
      const completeDestination = await runDiagnosticStage("DAILY_GOAL_MATERIALIZATION", async () => {
        const result = await verifyCompleteDestination();
        assertDestination(result, REVIEWED_INVENTORY);
        return result;
      });
      await runDiagnosticStage("DAILY_GOAL_PENDING_STATUS", async () => assertExactList(await adapter.readPending({ schemaPath, expectedDigest: completeDestination.digest }), [DAILY_GOAL_MIGRATION.name], "PRE_MIGRATION_PENDING_MISMATCH"));
      const preDeployDestination = await runDiagnosticStage("DAILY_GOAL_MATERIALIZATION", async () => {
        const result = await verifyCompleteDestination();
        assertDestination(result, REVIEWED_INVENTORY);
        return result;
      });
      await runDiagnosticStage("DAILY_GOAL_DEPLOY", () => adapter.deploy({ migrationsPath, schemaPath, expectedDigest: preDeployDestination.digest }));
      await runDiagnosticStage("FINAL_HISTORY", async () => assertHistory(await adapter.readHistory(), REVIEWED_INVENTORY));
      await runDiagnosticStage("FINAL_PENDING_STATUS", async () => assertExactList(await adapter.readPending({ schemaPath, expectedDigest: completeDestination.digest }), [], "POST_MIGRATION_PENDING_MISMATCH"));
      await runDiagnosticStage("SCHEMA_EVIDENCE", async () => assertSchemaEvidence(await adapter.readSchemaEvidence()));
    }));
    evidence = deepFreeze({
      outcome: "PORTABLE_MIGRATION_VERIFICATION_PASS", scope: "PORTABLE_POSTGRESQL_MIGRATION_CORRECTNESS_ONLY",
      binding, migrationCount: 12, baselineMigrationCount: 11,
      postgresqlMajor: POSTGRESQL_MAJOR, inventoryDigest: MIGRATION_INVENTORY_DIGEST,
      dailyGoal: { byteCount: DAILY_GOAL_MIGRATION.byteCount, checksum: DAILY_GOAL_MIGRATION.checksum },
      extensionAllowlist: [], dg1Passed: false, supabaseCompatibilityVerified: false, deploymentAuthorized: false,
    });
    if (Buffer.byteLength(JSON.stringify(evidence), "utf8") > OUTPUT_LIMIT_BYTES) fail("OUTPUT_LIMIT_EXCEEDED");
  } catch (error) {
    primaryFailure = normalizeDiagnosticFailure(error);
  } finally {
    if (!disconnectAttempted) {
      disconnectAttempted = true;
      try { await adapter.disconnect(); }
      catch {
        primaryFailure = primaryFailure
          ? attachCleanupStage(primaryFailure, "DISCONNECT")
          : new EphemeralMigrationFailure("DISCONNECT_FAILED", "DISCONNECT");
      }
    }
  }
  if (primaryFailure) throw primaryFailure;
  return evidence;
}

function assertDestination(actual, expected) {
  if (!actual || actual.count !== expected.length || actual.digest !== migrationInventoryDigest(expected)) fail("DESTINATION_INVENTORY_MISMATCH");
}

function assertHistory(actual, expected) {
  if (!Array.isArray(actual) || actual.length !== expected.length) fail("MIGRATION_HISTORY_MISMATCH");
  const normalized = actual.map((item) => ({ name: item?.name, checksum: item?.checksum, status: item?.status }));
  const required = expected.map((item) => ({ ...item, status: "APPLIED" }));
  if (stable(normalized) !== stable(required)) fail("MIGRATION_HISTORY_MISMATCH");
}

function assertSchemaEvidence(actual) {
  if (!actual || actual.status !== "VERIFIED" || actual.complete !== true || actual.rollbackVerified !== true
    || stable(actual.observedCatalog) !== stable(actual.expectedCatalog)
    || stable(actual.observedBehavior) !== stable(actual.expectedBehavior)
    || actual.observedCatalogDigest !== actual.expectedCatalogDigest) fail("SCHEMA_EVIDENCE_MISMATCH");
}

function assertExactList(actual, expected, code) {
  if (!Array.isArray(actual) || stable(actual) !== stable(expected)) fail(code);
}

async function verifyLfArtifact(file, expected) {
  const bytes = await readFile(file);
  if (bytes.includes(Buffer.from("\r"))) fail("NON_LF_MIGRATION_BYTES");
  if (expected.byteCount !== undefined && bytes.length !== expected.byteCount) fail("MIGRATION_CHECKSUM_MISMATCH");
  if (createHash("sha256").update(bytes).digest("hex") !== expected.checksum) fail("MIGRATION_CHECKSUM_MISMATCH");
}

function entry(name, checksum) { return Object.freeze({ name, checksum }); }
function digest(value) { return createHash("sha256").update(stable(value)).digest("hex"); }
export function migrationInventoryDigest(value) { return digest(value.map((item) => ({ name: item.name, checksum: item.checksum }))); }
function bindingDigest(value) { return digest(value); }
export function createRefusalEvidence(error) {
  const failure = normalizeDiagnosticFailure(error);
  const evidence = {
    outcome: "PORTABLE_MIGRATION_VERIFICATION_REFUSED",
    code: failure.code,
    ...(failure.stage ? { stage: failure.stage } : {}),
    ...(failure.cleanupStage ? { cleanupStage: failure.cleanupStage } : {}),
    dg1Passed: false, supabaseCompatibilityVerified: false, deploymentAuthorized: false,
  };
  if (Buffer.byteLength(JSON.stringify(evidence), "utf8") > OUTPUT_LIMIT_BYTES) {
    return deepFreeze({ outcome: "PORTABLE_MIGRATION_VERIFICATION_REFUSED", code: "OPERATION_FAILED", stage: "INPUT_BINDING", dg1Passed: false, supabaseCompatibilityVerified: false, deploymentAuthorized: false });
  }
  return deepFreeze(evidence);
}
export async function runDiagnosticStage(stage, operation) {
  const safeStage = STAGE_SET.has(stage) ? stage : "INPUT_BINDING";
  try { return await operation(); }
  catch (error) {
    if (error instanceof EphemeralMigrationFailure) {
      throw new EphemeralMigrationFailure(error.code, error.stage ?? safeStage, error.cleanupStage);
    }
    throw new EphemeralMigrationFailure("OPERATION_FAILED", safeStage);
  }
}
export function attachCleanupStage(error, cleanupStage) {
  const primary = normalizeDiagnosticFailure(error);
  const safeCleanup = STAGE_SET.has(cleanupStage) ? cleanupStage : "DISCONNECT";
  return new EphemeralMigrationFailure(primary.code, primary.stage, primary.cleanupStage ?? safeCleanup);
}
function normalizeDiagnosticFailure(error) {
  try {
    if (error instanceof EphemeralMigrationFailure) return new EphemeralMigrationFailure(error.code, error.stage, error.cleanupStage);
  } catch {}
  return new EphemeralMigrationFailure("OPERATION_FAILED", "INPUT_BINDING");
}
function stable(value) { return JSON.stringify(value); }
function fail(code) { throw new EphemeralMigrationFailure(code); }
function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
