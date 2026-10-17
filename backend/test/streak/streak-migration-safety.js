import assert from "node:assert/strict";

export const OWNER_MARKER_PREFIX = "elvocab-streak-harness:v1:";
export const SAFE_SCHEMA =
  /^elvocab_streak_(capability|clean|rollback)_([0-9]+)_([0-9]+)_[a-f0-9]{8}$/;

const SAFE_REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const SAFE_NUMERIC_ID = /^[0-9]+$/;
const SAFE_POSITIVE_DECIMAL_ID = /^[1-9][0-9]*$/;
const SAFE_TARGET_IDENTITY = /^[A-Za-z0-9][A-Za-z0-9_.:/-]{2,127}$/;

export function assertHarnessAuthorization(environment) {
  assert.equal(environment.CI, "true");
  assert.equal(environment.GITHUB_ACTIONS, "true");
  assert.equal(environment.STREAK_MIGRATION_HARNESS_ALLOW, "true");

  const targetIdentity = environment.CI_TEST_DATABASE_IDENTITY ?? "";
  const approvedIdentity = environment.STREAK_MIGRATION_APPROVED_TARGET_IDENTITY ?? "";
  assert.match(targetIdentity, SAFE_TARGET_IDENTITY);
  assert.equal(targetIdentity, approvedIdentity);

  const databaseUrl = environment.TEST_DATABASE_URL ?? "";
  let parsedUrl;
  try {
    parsedUrl = new URL(databaseUrl);
  } catch {
    assert.fail("TEST_DATABASE_URL must be a valid URL before target authorization.");
  }
  assert.equal(parsedUrl.protocol.startsWith("postgres"), true);
  const actualIdentity = `${parsedUrl.hostname}:${parsedUrl.port || "5432"}${parsedUrl.pathname}`;
  assert.equal(actualIdentity, targetIdentity);

  return Object.freeze({ targetIdentity, actualIdentity });
}

export function assertRunIdentity({ repository, runId, attempt }) {
  assert.match(repository, SAFE_REPOSITORY);
  assert.match(runId, SAFE_NUMERIC_ID);
  assert.match(attempt, SAFE_NUMERIC_ID);
  return Object.freeze({ repository, runId, attempt });
}

export function assertPositiveDecimalId(value, name) {
  assert.equal(typeof value, "string", `${name} must be a string.`);
  assert.match(value, SAFE_POSITIVE_DECIMAL_ID, `${name} must be a positive decimal integer.`);
  return value;
}

export function resolveHarnessRunIdentity(environment, mode) {
  const workflowIdentity = assertRunIdentity({
    repository: environment.GITHUB_REPOSITORY ?? "",
    runId: environment.GITHUB_RUN_ID ?? "",
    attempt: environment.GITHUB_RUN_ATTEMPT ?? "",
  });
  const targetRunId = environment.STREAK_CLEANUP_TARGET_RUN_ID;
  const targetAttempt = environment.STREAK_CLEANUP_TARGET_RUN_ATTEMPT;

  if (mode === "verify") {
    assert.equal(targetRunId, undefined, "Verification rejects cleanup target run ID.");
    assert.equal(targetAttempt, undefined, "Verification rejects cleanup target run attempt.");
    return workflowIdentity;
  }

  assert.equal(mode, "cleanup");
  assert.equal(environment.STREAK_MIGRATION_CLEANUP_ALLOW, "true");
  return Object.freeze({
    repository: workflowIdentity.repository,
    runId: assertPositiveDecimalId(
      targetRunId,
      "STREAK_CLEANUP_TARGET_RUN_ID",
    ),
    attempt: assertPositiveDecimalId(
      targetAttempt,
      "STREAK_CLEANUP_TARGET_RUN_ATTEMPT",
    ),
  });
}

export function buildSchemaName(scenario, runId, attempt, suffix) {
  const schemaName = `elvocab_streak_${scenario}_${runId}_${attempt}_${suffix}`;
  assertSafeSchemaName(schemaName);
  return schemaName;
}

export function assertSafeSchemaName(schemaName) {
  assert.match(schemaName, SAFE_SCHEMA);
  assert.notEqual(schemaName, "public");
  return schemaName;
}

export function buildOwnership({ repository, runId, attempt, schemaName }) {
  assertRunIdentity({ repository, runId, attempt });
  assertSafeSchemaName(schemaName);
  const [, , schemaRunId, schemaAttempt] = schemaName.match(SAFE_SCHEMA);
  assert.equal(schemaRunId, runId);
  assert.equal(schemaAttempt, attempt);
  return Object.freeze({
    version: 1,
    repository,
    run_id: runId,
    run_attempt: attempt,
    schema_name: schemaName,
  });
}

export function encodeOwnershipMarker(ownership) {
  const verified = buildOwnership({
    repository: ownership.repository,
    runId: ownership.run_id,
    attempt: ownership.run_attempt,
    schemaName: ownership.schema_name,
  });
  return `${OWNER_MARKER_PREFIX}${Buffer.from(JSON.stringify(verified)).toString("base64url")}`;
}

export function decodeOwnershipMarker(marker) {
  assert.equal(typeof marker, "string");
  assert.equal(marker.startsWith(OWNER_MARKER_PREFIX), true);
  const encoded = marker.slice(OWNER_MARKER_PREFIX.length);
  assert.match(encoded, /^[A-Za-z0-9_-]+$/);
  const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  return buildOwnership({
    repository: parsed.repository,
    runId: parsed.run_id,
    attempt: parsed.run_attempt,
    schemaName: parsed.schema_name,
  });
}

export function assertMatchingOwnership(actualMarker, expectedOwnership) {
  const actual = decodeOwnershipMarker(actualMarker);
  assert.deepEqual(actual, expectedOwnership);
  return actual;
}

export function discoveryLikePattern(runId, attempt) {
  assert.match(runId, SAFE_NUMERIC_ID);
  assert.match(attempt, SAFE_NUMERIC_ID);
  return `elvocab\\_streak\\_%\\_${runId}\\_${attempt}\\_%`;
}

export function collectExactlyOwnedSchemas(rows, expectedIdentity) {
  const identity = assertRunIdentity(expectedIdentity);
  return rows.map(({ nspname, marker }) => {
    assertSafeSchemaName(nspname);
    const ownership = buildOwnership({
      ...identity,
      schemaName: nspname,
    });
    assertMatchingOwnership(marker, ownership);
    return Object.freeze({ schemaName: nspname, ownership });
  });
}

export async function createAndRegisterOwnedSchema({
  schemaName,
  ownership,
  create,
  register,
  assertActive,
}) {
  assertSafeSchemaName(schemaName);
  assert.equal(ownership.schema_name, schemaName);
  await create(schemaName, encodeOwnershipMarker(ownership));
  register(schemaName);
  await assertActive(schemaName);
}
