import assert from "node:assert/strict";
import {
  assertHarnessAuthorization,
  assertPositiveDecimalId,
  assertRunIdentity,
} from "./streak-migration-safety.js";

const INTEGRATED_SCHEMA = /^elvocab_streak_integrated_([0-9]+)_([0-9]+)_[a-f0-9]{8}$/;
const MARKER_PREFIX = "elvocab-streak-integrated:v1:";
export const APPROVED_INTEGRATED_HISTORY_TARGET = Object.freeze({
  runId: "39278326097",
  attempt: "1",
});

export class IntegratedHistoryVerificationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "IntegratedHistoryVerificationError";
    this.code = code;
  }
}

export function assertIntegratedHistoryVerificationAuthorization(environment) {
  const { targetIdentity } = assertHarnessAuthorization(environment);
  assert.equal(environment.NODE_ENV, "test");
  assert.equal(environment.STREAK_INTEGRATED_HISTORY_VERIFY_ALLOW, "true");
  assert.notEqual(environment.TEST_DATABASE_ALLOW_RESET, "true");
  assert.equal(environment.STREAK_INTEGRATED_HARNESS_ALLOW, undefined);
  assert.equal(environment.STREAK_MIGRATION_CLEANUP_ALLOW, undefined);
  const workflowIdentity = assertRunIdentity({
    repository: environment.GITHUB_REPOSITORY ?? "",
    runId: environment.GITHUB_RUN_ID ?? "",
    attempt: environment.GITHUB_RUN_ATTEMPT ?? "",
  });
  const targetIdentityForRun = Object.freeze({
    repository: workflowIdentity.repository,
    runId: assertPositiveDecimalId(
      environment.STREAK_INTEGRATED_TARGET_RUN_ID,
      "STREAK_INTEGRATED_TARGET_RUN_ID",
    ),
    attempt: assertPositiveDecimalId(
      environment.STREAK_INTEGRATED_TARGET_RUN_ATTEMPT,
      "STREAK_INTEGRATED_TARGET_RUN_ATTEMPT",
    ),
  });
  assert.equal(
    environment.STREAK_INTEGRATED_APPROVED_RUN_ID,
    APPROVED_INTEGRATED_HISTORY_TARGET.runId,
  );
  assert.equal(
    environment.STREAK_INTEGRATED_APPROVED_RUN_ATTEMPT,
    APPROVED_INTEGRATED_HISTORY_TARGET.attempt,
  );
  assert.equal(targetIdentityForRun.runId, APPROVED_INTEGRATED_HISTORY_TARGET.runId);
  assert.equal(targetIdentityForRun.attempt, APPROVED_INTEGRATED_HISTORY_TARGET.attempt);
  return Object.freeze({ targetIdentity, workflowIdentity, targetIdentityForRun });
}

export function integratedHistoryDiscoveryPattern(runId, attempt) {
  assertPositiveDecimalId(runId, "historical integrated run ID");
  assertPositiveDecimalId(attempt, "historical integrated run attempt");
  return `elvocab\\_streak\\_integrated\\_${runId}\\_${attempt}\\_%`;
}

export function verifyHistoricalIntegratedCandidates(rows, expectedIdentity) {
  assert.ok(Array.isArray(rows));
  const identity = assertRunIdentity(expectedIdentity);
  if (rows.length === 0) return Object.freeze({ status: "ABSENT" });
  if (rows.length !== 1) {
    throw new IntegratedHistoryVerificationError(
      "INVALID_OR_AMBIGUOUS_CANDIDATES",
      "Historical integrated schema candidates are invalid or ambiguous.",
    );
  }

  const row = rows[0];
  let schemaName;
  try {
    schemaName = assertIntegratedSchemaName(row?.nspname ?? "");
    const [, runId, attempt] = schemaName.match(INTEGRATED_SCHEMA);
    assert.equal(runId, identity.runId);
    assert.equal(attempt, identity.attempt);
  } catch {
    throw new IntegratedHistoryVerificationError(
      "INVALID_OR_AMBIGUOUS_CANDIDATES",
      "Historical integrated schema candidate has an invalid identity.",
    );
  }

  if (typeof row.marker !== "string" || row.marker.length === 0) {
    throw new IntegratedHistoryVerificationError(
      "OWNERSHIP_MARKER_MISSING",
      "Historical integrated schema ownership marker is missing.",
    );
  }

  let ownership;
  try {
    ownership = decodeMarker(row.marker);
    assert.equal(ownership.repository, identity.repository);
    assert.equal(ownership.run_id, identity.runId);
    assert.equal(ownership.run_attempt, identity.attempt);
    assert.equal(ownership.schema_name, schemaName);
  } catch {
    throw new IntegratedHistoryVerificationError(
      "OWNERSHIP_MARKER_MISMATCH",
      "Historical integrated schema ownership marker does not match the target.",
    );
  }

  return Object.freeze({ status: "OWNED_SCHEMA_PRESENT", schemaName, ownership });
}

export function assertIntegratedAuthorization(environment) {
  const { targetIdentity } = assertHarnessAuthorization(environment);
  assert.equal(environment.NODE_ENV, "test");
  assert.equal(environment.TEST_DATABASE_ALLOW_RESET, "true");
  assert.equal(environment.STREAK_INTEGRATED_HARNESS_ALLOW, "true");
  assert.equal(environment.STREAK_CLEANUP_TARGET_RUN_ID, undefined);
  assert.equal(environment.STREAK_CLEANUP_TARGET_RUN_ATTEMPT, undefined);
  assert.equal(environment.STREAK_MIGRATION_CLEANUP_ALLOW, undefined);
  const runIdentity = assertRunIdentity({
    repository: environment.GITHUB_REPOSITORY ?? "",
    runId: environment.GITHUB_RUN_ID ?? "",
    attempt: environment.GITHUB_RUN_ATTEMPT ?? "",
  });
  return Object.freeze({ runIdentity, targetIdentity });
}

export function buildIntegratedSchemaContext(environment, suffix) {
  const { runIdentity } = assertIntegratedAuthorization(environment);
  assert.match(suffix, /^[a-f0-9]{8}$/);
  const schemaName = `elvocab_streak_integrated_${runIdentity.runId}_${runIdentity.attempt}_${suffix}`;
  assertIntegratedSchemaName(schemaName);
  const ownership = Object.freeze({
    version: 1,
    repository: runIdentity.repository,
    run_id: runIdentity.runId,
    run_attempt: runIdentity.attempt,
    schema_name: schemaName,
  });
  return Object.freeze({
    schemaName,
    ownership,
    marker: encodeMarker(ownership),
  });
}

export function scopedIntegratedDatabaseUrl(baseUrl, schemaName) {
  assertIntegratedSchemaName(schemaName);
  const url = parsePostgresUrl(baseUrl);
  url.searchParams.set("schema", schemaName);
  assert.equal(url.searchParams.get("schema"), schemaName);
  return url.toString();
}

export function catalogDatabaseUrl(baseUrl) {
  const url = parsePostgresUrl(baseUrl);
  url.searchParams.set("schema", "pg_catalog");
  return url.toString();
}

export function assertIntegratedScopedEnvironment(environment) {
  assertIntegratedAuthorization(environment);
  const schemaName = assertIntegratedSchemaName(environment.STREAK_INTEGRATED_SCHEMA_NAME ?? "");
  const marker = environment.STREAK_INTEGRATED_SCHEMA_MARKER ?? "";
  const ownership = decodeMarker(marker);
  assert.equal(ownership.schema_name, schemaName);
  const testUrl = parsePostgresUrl(environment.TEST_DATABASE_URL);
  const runtimeUrl = parsePostgresUrl(environment.DATABASE_URL);
  assert.equal(testUrl.searchParams.get("schema"), schemaName);
  assert.equal(runtimeUrl.searchParams.get("schema"), schemaName);
  assert.equal(testUrl.toString(), runtimeUrl.toString());
  return Object.freeze({ schemaName, marker, ownership });
}

export function assertIntegratedSchemaOwnership({ schemaName, currentSchema, marker, ownership }) {
  assertIntegratedSchemaName(schemaName);
  assert.equal(currentSchema, schemaName);
  assert.equal(ownership.schema_name, schemaName);
  assert.deepEqual(decodeMarker(marker), ownership);
  return ownership;
}

function assertIntegratedSchemaName(schemaName) {
  assert.match(schemaName, INTEGRATED_SCHEMA);
  assert.notEqual(schemaName, "public");
  return schemaName;
}

function encodeMarker(ownership) {
  return `${MARKER_PREFIX}${Buffer.from(JSON.stringify(ownership)).toString("base64url")}`;
}

function decodeMarker(marker) {
  assert.equal(typeof marker, "string");
  assert.equal(marker.startsWith(MARKER_PREFIX), true);
  const value = JSON.parse(Buffer.from(marker.slice(MARKER_PREFIX.length), "base64url").toString("utf8"));
  assert.equal(value.version, 1);
  const runIdentity = assertRunIdentity({
    repository: value.repository,
    runId: value.run_id,
    attempt: value.run_attempt,
  });
  assertIntegratedSchemaName(value.schema_name);
  const [, runId, attempt] = value.schema_name.match(INTEGRATED_SCHEMA);
  assert.equal(runId, runIdentity.runId);
  assert.equal(attempt, runIdentity.attempt);
  return Object.freeze({
    version: 1,
    repository: runIdentity.repository,
    run_id: runIdentity.runId,
    run_attempt: runIdentity.attempt,
    schema_name: value.schema_name,
  });
}

function parsePostgresUrl(value) {
  let url;
  try {
    url = new URL(value ?? "");
  } catch {
    assert.fail("TASK-249 database URL must be valid.");
  }
  assert.equal(url.protocol === "postgresql:" || url.protocol === "postgres:", true);
  return url;
}
