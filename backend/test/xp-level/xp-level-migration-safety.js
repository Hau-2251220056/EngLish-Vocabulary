import assert from "node:assert/strict";

export const OWNER_MARKER_PREFIX = "elvocab-xp-harness:v1:";
export const SAFE_SCHEMA =
  /^elvocab_xp_(capability|clean|negative|rollback|repository|learning)_([0-9]+)_([0-9]+)_[a-f0-9]{8}$/;

const SAFE_REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const SAFE_NUMERIC_ID = /^[0-9]+$/;

export function assertRunIdentity({ repository, runId, attempt }) {
  assert.match(repository, SAFE_REPOSITORY);
  assert.match(runId, SAFE_NUMERIC_ID);
  assert.match(attempt, SAFE_NUMERIC_ID);
  return Object.freeze({ repository, runId, attempt });
}

export function buildSchemaName(scenario, runId, attempt, suffix) {
  const schemaName = `elvocab_xp_${scenario}_${runId}_${attempt}_${suffix}`;
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
  return `elvocab\\_xp\\_%\\_${runId}\\_${attempt}\\_%`;
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
