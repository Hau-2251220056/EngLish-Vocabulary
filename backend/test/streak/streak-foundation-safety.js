import assert from "node:assert/strict";
import {
  assertHarnessAuthorization,
  assertRunIdentity,
} from "./streak-migration-safety.js";

const FOUNDATION_SCHEMA = /^elvocab_streak_foundation_([0-9]+)_([0-9]+)_[a-f0-9]{8}$/;
const FOUNDATION_MARKER_PREFIX = "elvocab-streak-foundation:v1:";

export function assertFoundationAuthorization(environment) {
  assertHarnessAuthorization(environment);
  assert.equal(environment.NODE_ENV, "test");
  assert.equal(environment.TEST_DATABASE_ALLOW_RESET, "true");
  assert.equal(environment.STREAK_FOUNDATION_HARNESS_ALLOW, "true");
  assert.equal(environment.STREAK_CLEANUP_TARGET_RUN_ID, undefined);
  assert.equal(environment.STREAK_CLEANUP_TARGET_RUN_ATTEMPT, undefined);
  assert.equal(environment.STREAK_MIGRATION_CLEANUP_ALLOW, undefined);

  const runIdentity = assertRunIdentity({
    repository: environment.GITHUB_REPOSITORY ?? "",
    runId: environment.GITHUB_RUN_ID ?? "",
    attempt: environment.GITHUB_RUN_ATTEMPT ?? "",
  });
  return Object.freeze({
    runIdentity,
    targetIdentity: environment.CI_TEST_DATABASE_IDENTITY,
  });
}

export function buildFoundationSchemaContext(environment, suffix) {
  const { runIdentity } = assertFoundationAuthorization(environment);
  assert.match(suffix, /^[a-f0-9]{8}$/);
  const schemaName = `elvocab_streak_foundation_${runIdentity.runId}_${runIdentity.attempt}_${suffix}`;
  assertFoundationSchemaName(schemaName);
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
    marker: encodeFoundationMarker(ownership),
  });
}

export function assertFoundationSchemaOwnership({
  schemaName,
  currentSchema,
  marker,
  ownership,
}) {
  assertFoundationSchemaName(schemaName);
  assert.equal(currentSchema, schemaName);
  assert.equal(ownership.schema_name, schemaName);
  assert.deepEqual(decodeFoundationMarker(marker), ownership);
  return ownership;
}

export async function runSanitizedContentionObserver(action) {
  assert.equal(typeof action, "function");
  try {
    return await action();
  } catch (error) {
    const name = /^[A-Za-z][A-Za-z0-9]*$/.test(error?.name ?? "") ? error.name : "Error";
    const code = /^[A-Za-z0-9_-]{1,32}$/.test(error?.code ?? "") ? ` code=${error.code}` : "";
    throw new Error(`Contention observer failed (${name}${code}).`);
  }
}

function assertFoundationSchemaName(schemaName) {
  assert.match(schemaName, FOUNDATION_SCHEMA);
  assert.notEqual(schemaName, "public");
  return schemaName;
}

function encodeFoundationMarker(ownership) {
  return `${FOUNDATION_MARKER_PREFIX}${Buffer.from(JSON.stringify(ownership)).toString("base64url")}`;
}

function decodeFoundationMarker(marker) {
  assert.equal(typeof marker, "string");
  assert.equal(marker.startsWith(FOUNDATION_MARKER_PREFIX), true);
  const encoded = marker.slice(FOUNDATION_MARKER_PREFIX.length);
  assert.match(encoded, /^[A-Za-z0-9_-]+$/);
  const ownership = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  assert.equal(ownership.version, 1);
  assertRunIdentity({
    repository: ownership.repository,
    runId: ownership.run_id,
    attempt: ownership.run_attempt,
  });
  assertFoundationSchemaName(ownership.schema_name);
  const [, runId, attempt] = ownership.schema_name.match(FOUNDATION_SCHEMA);
  assert.equal(runId, ownership.run_id);
  assert.equal(attempt, ownership.run_attempt);
  return ownership;
}

export async function runWithGuaranteedRelease({
  action,
  release,
  held = [],
  settleTimeoutMs = 5_000,
}) {
  let result;
  let primaryError;
  try {
    result = await action();
  } catch (error) {
    primaryError = error;
  }

  const cleanupErrors = [];
  try {
    release();
  } catch (error) {
    cleanupErrors.push(error);
  }
  const settled = await Promise.allSettled(held.map((entry) => boundedSettlement(
    normalizeHeldOperation(entry),
    settleTimeoutMs,
  )));
  cleanupErrors.push(...settled
    .filter(({ status }) => status === "rejected")
    .map(({ reason }) => reason));

  if (primaryError) {
    if (cleanupErrors.length > 0) {
      throw new AggregateError(
        [primaryError, ...cleanupErrors],
        `Primary operation failed: ${primaryError.message}`,
      );
    }
    throw primaryError;
  }
  if (cleanupErrors.length > 0) {
    throw new AggregateError(cleanupErrors, "Held operation cleanup failed.");
  }
  return result;
}

function normalizeHeldOperation(entry) {
  if (entry && typeof entry.then === "function") {
    return { label: null, promise: entry };
  }
  assert.equal(typeof entry, "object");
  assert.match(entry.label, /^[a-z0-9-]{1,32}$/);
  assert.equal(typeof entry.promise?.then, "function");
  return { label: entry.label, promise: entry.promise };
}

async function boundedSettlement({ label, promise }, timeoutMs) {
  assert.equal(Number.isInteger(timeoutMs) && timeoutMs > 0, true);
  let timer;
  const timeoutError = new Error(label
    ? `Timed out settling held operation ${label}.`
    : "Timed out settling a held concurrency operation.");
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(timeoutError),
      timeoutMs,
    );
  });
  try {
    return await Promise.race([promise, timeout]);
  } catch (error) {
    if (!label || error === timeoutError) throw error;
    const name = /^[A-Za-z][A-Za-z0-9]*$/.test(error?.name ?? "") ? error.name : "Error";
    const code = /^[A-Za-z0-9_-]{1,32}$/.test(error?.code ?? "") ? ` code=${error.code}` : "";
    throw new Error(`Held operation ${label} rejected (${name}${code}).`);
  } finally {
    clearTimeout(timer);
  }
}
