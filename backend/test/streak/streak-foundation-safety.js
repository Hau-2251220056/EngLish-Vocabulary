import assert from "node:assert/strict";
import {
  assertHarnessAuthorization,
  assertRunIdentity,
} from "./streak-migration-safety.js";

const FOUNDATION_SCHEMA = /^elvocab_streak_foundation_([0-9]+)_([0-9]+)_[a-f0-9]{8}$/;
const FOUNDATION_MARKER_PREFIX = "elvocab-streak-foundation:v1:";
const PRISMA_OBSERVER_ERROR_NAMES = [
  "PrismaClientKnownRequestError",
  "PrismaClientUnknownRequestError",
  "PrismaClientRustPanicError",
  "PrismaClientInitializationError",
];
export const CONTENTION_OBSERVER_MIN_LIFECYCLE_BUDGET_MS = 4_000;

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

export function buildFoundationObserverDatabaseUrl(environment) {
  assertFoundationAuthorization(environment);
  const expectedSchema = environment.STREAK_FOUNDATION_SCHEMA_NAME;
  assertFoundationSchemaName(expectedSchema);

  let databaseUrl;
  try {
    databaseUrl = new URL(environment.TEST_DATABASE_URL);
  } catch {
    throw new Error("Dedicated observer database URL is invalid.");
  }
  assert.equal(
    databaseUrl.protocol === "postgresql:" || databaseUrl.protocol === "postgres:",
    true,
    "Dedicated observer requires PostgreSQL.",
  );
  assert.equal(
    databaseUrl.searchParams.get("schema"),
    expectedSchema,
    "Dedicated observer schema does not match the authorized run-owned schema.",
  );
  databaseUrl.searchParams.set("connection_limit", "1");
  databaseUrl.searchParams.set("connect_timeout", "5");
  databaseUrl.searchParams.set("pool_timeout", "5");
  return databaseUrl.toString();
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

export async function runSanitizedContentionObserver(
  action,
  prismaErrorTypes,
  { now = Date.now } = {},
) {
  assert.equal(typeof action, "function");
  assertPrismaObserverErrorTypes(prismaErrorTypes);
  assert.equal(typeof now, "function");
  const startedAt = now();
  const phase = createContentionObserverPhaseTracker();
  try {
    return await action(phase);
  } catch (error) {
    const identity = identifyPrismaObserverError(error, prismaErrorTypes);
    if (!identity) throw error;
    const code = identity.name === "PrismaClientKnownRequestError"
      && /^[A-Za-z0-9_-]{1,32}$/.test(error?.code ?? "")
      ? error.code
      : null;
    const retryable = identity.name === "PrismaClientKnownRequestError" && code === "P2028";
    throw new SanitizedContentionObserverError(
      identity.name,
      code,
      retryable,
      phase.current(),
      contentionObserverElapsedBucket(now() - startedAt),
    );
  }
}

export class SanitizedContentionObserverError extends Error {
  constructor(safeName, safeCode, retryable, safePhase = null, elapsedBucket = null) {
    const code = safeCode ? ` code=${safeCode}` : "";
    super(`Contention observer failed (${safeName}${code}).`);
    this.name = "SanitizedContentionObserverError";
    this.safeName = safeName;
    this.safeCode = safeCode;
    this.retryable = retryable === true;
    this.safePhase = safePhase;
    this.elapsedBucket = elapsedBucket;
  }
}

export function describeContentionWaitStates(rows, expectedCount) {
  assert.equal(Array.isArray(rows), true);
  assert.equal(Number.isInteger(expectedCount) && expectedCount > 0, true);
  return rows.slice(0, expectedCount).map((row, index) => ({
    role: `blocked-${index + 1}`,
    depth: Number.isInteger(row.depth) && row.depth >= 1 && row.depth <= expectedCount
      ? row.depth
      : null,
    state_category: postgresStateCategory(row.state),
    wait_category: postgresWaitCategory(row.wait_event_type),
    wait_event_present: row.wait_event !== null && row.wait_event !== undefined,
    blocking_count: Array.isArray(row.blocking_pids)
      ? Math.min(row.blocking_pids.filter(Number.isInteger).length, expectedCount)
      : 0,
  }));
}

export function contentionObserverTransactionPolicy(remainingMs) {
  assert.equal(
    Number.isInteger(remainingMs)
      && remainingMs >= CONTENTION_OBSERVER_MIN_LIFECYCLE_BUDGET_MS,
    true,
  );
  // Prisma's documented interactive-transaction acquisition default is 2 seconds.
  const maxWait = 2_000;
  const timeout = 1_500;
  const statementTimeoutMs = 150;
  const completionMarginMs = 500;
  assert.equal(
    maxWait + timeout + completionMarginMs
      <= CONTENTION_OBSERVER_MIN_LIFECYCLE_BUDGET_MS,
    true,
  );
  assert.equal(statementTimeoutMs <= timeout - 150, true);
  return Object.freeze({ maxWait, timeout, statementTimeoutMs, completionMarginMs });
}

function createContentionObserverPhaseTracker() {
  let phase = "transaction-acquisition";
  const transition = (expected, next) => {
    assert.equal(phase, expected);
    phase = next;
  };
  return Object.freeze({
    callbackEntered: () => transition("transaction-acquisition", "transaction-callback-entered"),
    statementTimeoutStarted: () => transition(
      "transaction-callback-entered",
      "statement-timeout-started",
    ),
    statementTimeoutCompleted: () => transition(
      "statement-timeout-started",
      "statement-timeout-completed",
    ),
    blockingQueryStarted: () => transition(
      "statement-timeout-completed",
      "blocking-query-started",
    ),
    blockingQueryCompleted: () => transition(
      "blocking-query-started",
      "blocking-query-completed",
    ),
    callbackReturned: () => transition("blocking-query-completed", "transaction-closure"),
    current: () => phase,
  });
}

function contentionObserverElapsedBucket(elapsedMs) {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return "unknown";
  if (elapsedMs < 50) return "under-50ms";
  if (elapsedMs < 150) return "50-149ms";
  if (elapsedMs < 400) return "150-399ms";
  if (elapsedMs < 750) return "400-749ms";
  return "750ms-or-more";
}

function postgresStateCategory(value) {
  switch (value) {
    case "active": return "active";
    case "idle": return "idle";
    case "idle in transaction": return "idle-in-transaction";
    case "idle in transaction (aborted)": return "idle-in-transaction-aborted";
    case "fastpath function call": return "fastpath-function-call";
    case "disabled": return "disabled";
    default: return "unknown";
  }
}

function postgresWaitCategory(value) {
  switch (value) {
    case null:
    case undefined: return "none";
    case "Activity": return "activity";
    case "BufferPin": return "buffer-pin";
    case "Client": return "client";
    case "Extension": return "extension";
    case "InjectionPoint": return "injection-point";
    case "IO": return "io";
    case "IPC": return "ipc";
    case "Lock": return "lock";
    case "LWLock": return "lwlock";
    case "Timeout": return "timeout";
    default: return "unknown";
  }
}

export async function runFoundationCleanup({ primaryError, operations }) {
  assert.equal(Array.isArray(operations), true);
  const failures = primaryError === undefined ? [] : [primaryError];
  for (const operation of operations) {
    if (operation === undefined || operation === null) continue;
    assert.equal(typeof operation, "function");
    try {
      await operation();
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1) {
    throw new AggregateError(failures, "Streak foundation cleanup encountered multiple failures.");
  }
}

export class FoundationObserverSetupError extends AggregateError {
  constructor(failures, disconnectCompleted) {
    super(failures, "Dedicated contention observer setup failed.");
    this.name = "FoundationObserverSetupError";
    this.disconnectCompleted = disconnectCompleted === true;
  }
}

export async function connectFoundationObserver(observer, { onDisconnected = () => {} } = {}) {
  assert.equal(typeof observer?.$connect, "function");
  assert.equal(typeof observer?.$disconnect, "function");
  assert.equal(typeof onDisconnected, "function");
  try {
    await observer.$connect();
  } catch (primaryError) {
    const failures = [primaryError];
    let disconnectCompleted = false;
    try {
      await observer.$disconnect();
      disconnectCompleted = true;
      onDisconnected();
    } catch (error) {
      failures.push(error);
    }
    throw new FoundationObserverSetupError(failures, disconnectCompleted);
  }
  return observer;
}

function assertPrismaObserverErrorTypes(types) {
  assert.equal(typeof types, "object");
  assert.deepEqual(Object.keys(types).sort(), [...PRISMA_OBSERVER_ERROR_NAMES].sort());
  for (const name of PRISMA_OBSERVER_ERROR_NAMES) assert.equal(typeof types[name], "function");
}

function identifyPrismaObserverError(error, types) {
  for (const name of PRISMA_OBSERVER_ERROR_NAMES) {
    if (error instanceof types[name]) return { name };
  }
  return null;
}

export async function observeBoundedContention({
  expectedCount,
  message,
  readSample,
  describeRows,
  now = Date.now,
  pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  observationDeadlineMs = 5_000,
  maximumSamples = 200,
  minimumLifecycleBudgetMs = 750,
}) {
  assert.equal(Number.isInteger(expectedCount) && expectedCount > 0, true);
  assert.equal(typeof message, "string");
  assert.equal(typeof readSample, "function");
  assert.equal(typeof describeRows, "function");
  const deadline = now() + observationDeadlineMs;
  let samples = 0;
  let successfulSamples = 0;
  let insufficientSamples = 0;
  let retryableP2028Failures = 0;
  let maximumObserved = 0;
  let lastWaitStates = [];
  let lastObserverError = null;

  while (samples < maximumSamples) {
    const remainingMs = deadline - now();
    if (remainingMs < minimumLifecycleBudgetMs) break;
    let rows;
    try {
      rows = await readSample(remainingMs);
    } catch (error) {
      if (!(error instanceof SanitizedContentionObserverError) || !error.retryable) throw error;
      samples += 1;
      retryableP2028Failures += 1;
      lastObserverError = {
        name: error.safeName,
        ...(error.safeCode ? { code: error.safeCode } : {}),
        ...(error.safePhase ? { phase: error.safePhase } : {}),
        ...(error.elapsedBucket ? { elapsed: error.elapsedBucket } : {}),
      };
      if (deadline - now() < minimumLifecycleBudgetMs) break;
      await pause(25);
      continue;
    }

    samples += 1;
    successfulSamples += 1;
    maximumObserved = Math.max(maximumObserved, rows.length);
    lastWaitStates = describeRows(rows);
    if (rows.length >= expectedCount) {
      return Object.freeze({
        attempts: samples,
        successfulSamples,
        insufficientSamples,
        retryableP2028Failures,
      });
    }
    insufficientSamples += 1;
    if (deadline - now() < minimumLifecycleBudgetMs) break;
    await pause(25);
  }

  const observerError = lastObserverError
    ? `; observer_error=${JSON.stringify(lastObserverError)}`
    : "";
  throw new Error(
    `${message} maximum_observed=${maximumObserved}; samples=${samples}; successful_samples=${successfulSamples}; insufficient_samples=${insufficientSamples}; retryable_p2028_failures=${retryableP2028Failures}; wait_states=${JSON.stringify(lastWaitStates)}${observerError}`,
  );
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
