import { createHash } from "node:crypto";

export const TASK262_OPERATION = "DAILY_GOAL_TASK262_REAL_STACK_POSTGRESQL_17";
export const TASK262_REPOSITORY = "Hau-2251220056/EngLish-Vocabulary";
export const TASK262_REF = "refs/heads/feature/daily-goal-v1";
export const TASK262_POSTGRESQL_MAJOR = 17;
export const TASK262_MIGRATION_INVENTORY_DIGEST = "833edeb16488fc71fbbea22532531699eb2ffb9334b5b4f1d6ff5bcf0d41c864";
export const TASK262_SUITE_VERSION = "task-262-phase-a-v1";
export const TASK262_OUTPUT_LIMIT_BYTES = 16_384;

export const TASK262_CATEGORIES = Object.freeze([
  "firstSetup", "goalEdits", "heartbeatGoalRace", "rewardUniqueness",
  "notificationUniqueness", "levelProjection", "atomicRollback",
  "databaseUniqueness", "replayConflictRetry", "preGoalTime",
  "completionBoundary", "srsCompatibility", "quizCompatibility", "streakIsolation",
]);

const SAFE_CODES = new Set([
  "TASK262_BINDING_INCOMPLETE", "TASK262_NOT_AUTHORIZED", "TASK262_BINDING_MISMATCH",
  "TASK262_AUTHORIZATION_INVALID_OR_CONSUMED", "TASK262_ADAPTER_INCOMPLETE",
  "TASK262_PREPARATION_FAILED", "TASK262_CLIENT_GENERATION_FAILED",
  "TASK262_REWARD_SUITE_FAILED", "TASK262_HTTP_SUITE_FAILED",
  "TASK262_COMPATIBILITY_SUITE_FAILED", "TASK262_EVIDENCE_INVALID",
  "TASK262_OUTPUT_LIMIT_EXCEEDED", "TASK262_CLEANUP_FAILED", "TASK262_BARRIER_TIMEOUT",
]);

export class Task262Failure extends Error {
  constructor(code) {
    const safe = SAFE_CODES.has(code) ? code : "TASK262_EVIDENCE_INVALID";
    super(`TASK-262 verification refused. Code: ${safe}`);
    this.name = "Task262Failure";
    this.code = safe;
    this.task262Passed = false;
    this.postgresqlVerified = false;
    this.dg3Authorized = false;
    this.deploymentAuthorized = false;
  }
}

export function validateTask262Binding(input) {
  const required = ["operation", "authorized", "repository", "sourceSha", "sourceRef", "workflowSha", "runId", "runAttempt", "postgresqlMajor"];
  if (!input || required.some((key) => typeof input[key] !== "string" || input[key].length === 0)) fail("TASK262_BINDING_INCOMPLETE");
  if (input.operation !== TASK262_OPERATION || input.authorized !== "true") fail("TASK262_NOT_AUTHORIZED");
  if (input.repository !== TASK262_REPOSITORY || input.sourceRef !== TASK262_REF
    || !/^[a-f0-9]{40}$/.test(input.sourceSha) || input.workflowSha !== input.sourceSha
    || !/^[1-9]\d*$/.test(input.runId) || !/^[1-9]\d*$/.test(input.runAttempt)
    || input.postgresqlMajor !== String(TASK262_POSTGRESQL_MAJOR)) fail("TASK262_BINDING_MISMATCH");
  return deepFreeze({
    repository: input.repository,
    sourceSha: input.sourceSha,
    sourceRef: input.sourceRef,
    workflowSha: input.workflowSha,
    runId: input.runId,
    runAttempt: input.runAttempt,
    postgresqlMajor: TASK262_POSTGRESQL_MAJOR,
    migrationInventoryDigest: TASK262_MIGRATION_INVENTORY_DIGEST,
    suiteVersion: TASK262_SUITE_VERSION,
  });
}

export function createTask262Harness() {
  const authorizations = new WeakMap();
  const results = new WeakMap();

  function issueAuthorization(input) {
    const binding = validateTask262Binding(input);
    const token = Object.freeze(Object.create(null));
    authorizations.set(token, { binding, digest: digest(binding), consumed: false });
    return token;
  }

  async function run({ authorization, adapter }) {
    const state = authorizations.get(authorization);
    if (!state || state.consumed) fail("TASK262_AUTHORIZATION_INVALID_OR_CONSUMED");
    state.consumed = true;
    let primary;
    let categories;
    try {
      for (const method of ["assertPrepared", "generateClient", "runReward", "runHttp", "runCompatibility", "cleanup"]) {
        if (typeof adapter?.[method] !== "function") fail("TASK262_ADAPTER_INCOMPLETE");
      }
      await stage("TASK262_PREPARATION_FAILED", () => adapter.assertPrepared(state.binding));
      await stage("TASK262_CLIENT_GENERATION_FAILED", () => adapter.generateClient(state.binding));
      const reward = await stage("TASK262_REWARD_SUITE_FAILED", () => adapter.runReward(state.binding));
      const http = await stage("TASK262_HTTP_SUITE_FAILED", () => adapter.runHttp(state.binding));
      const compatibility = await stage("TASK262_COMPATIBILITY_SUITE_FAILED", () => adapter.runCompatibility(state.binding));
      categories = validateTask262Categories({ ...reward, ...http, ...compatibility });
    } catch (error) {
      primary = normalize(error);
    } finally {
      try { if (typeof adapter?.cleanup === "function") await adapter.cleanup(); }
      catch {
        if (primary) markCleanupFailure(primary);
        else primary = new Task262Failure("TASK262_CLEANUP_FAILED");
      }
    }
    if (primary) throw primary;
    const evidence = deepFreeze({
      outcome: "TASK262_REAL_STACK_VERIFICATION_PASS",
      scope: "PORTABLE_POSTGRESQL_17_JOB_LOCAL_REWARD_COMPATIBILITY_ONLY",
      binding: state.binding,
      categories,
      task262Passed: true,
      postgresqlVerified: true,
      supabasePlatformVerified: false,
      dg3Authorized: false,
      deploymentAuthorized: false,
    });
    if (Buffer.byteLength(JSON.stringify(evidence), "utf8") > TASK262_OUTPUT_LIMIT_BYTES) fail("TASK262_OUTPUT_LIMIT_EXCEEDED");
    const token = Object.freeze(Object.create(null));
    results.set(token, { authorization, digest: state.digest, evidence, consumed: false });
    return token;
  }

  function verifyResult({ trustedResult, authorization, expectedBinding }) {
    const result = results.get(trustedResult);
    if (!result || result.consumed || result.authorization !== authorization) fail("TASK262_EVIDENCE_INVALID");
    if (result.digest !== digest(validateTask262Binding(expectedBinding))) fail("TASK262_BINDING_MISMATCH");
    result.consumed = true;
    return result.evidence;
  }

  return Object.freeze({ issueAuthorization, run, verifyResult });
}

export function validateTask262Categories(value) {
  if (!value || Object.keys(value).length !== TASK262_CATEGORIES.length) fail("TASK262_EVIDENCE_INVALID");
  const normalized = {};
  for (const category of TASK262_CATEGORIES) {
    const item = value[category];
    if (!item || item.status !== "PASS" || !Number.isInteger(item.assertions) || item.assertions < 1) fail("TASK262_EVIDENCE_INVALID");
    normalized[category] = Object.freeze({ status: "PASS", assertions: item.assertions });
  }
  if (Object.keys(value).some((key) => !TASK262_CATEGORIES.includes(key))) fail("TASK262_EVIDENCE_INVALID");
  return deepFreeze(normalized);
}

export function createTask262Barrier({ parties, timeoutMilliseconds = 5_000, setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  if (!Number.isInteger(parties) || parties < 1 || !Number.isInteger(timeoutMilliseconds) || timeoutMilliseconds < 1) throw new TypeError("A bounded barrier is required.");
  let arrivals = 0;
  let terminal = false;
  let resolveWait;
  let rejectWait;
  const waiting = new Promise((resolve, reject) => { resolveWait = resolve; rejectWait = reject; });
  const timer = setTimer(() => settle(false, new Task262Failure("TASK262_BARRIER_TIMEOUT")), timeoutMilliseconds);
  function settle(success, error) {
    if (terminal) return false;
    terminal = true;
    clearTimer(timer);
    success ? resolveWait() : rejectWait(error);
    return true;
  }
  return Object.freeze({
    async arriveAndWait() {
      if (terminal || arrivals >= parties) throw new Error("Unexpected barrier arrival.");
      arrivals += 1;
      await waiting;
    },
    release() {
      if (arrivals !== parties || !settle(true)) throw new Error("Barrier cannot be released.");
    },
    abort(error = new Error("Barrier aborted.")) { return settle(false, error); },
    snapshot() { return Object.freeze({ arrivals, parties, terminal }); },
  });
}

export function task262RefusalEvidence(error) {
  const failure = normalize(error);
  return deepFreeze({
    outcome: "TASK262_REAL_STACK_VERIFICATION_REFUSED",
    code: failure.code,
    cleanupFailed: failure.task262CleanupFailed === true,
    task262Passed: false,
    postgresqlVerified: false,
    supabasePlatformVerified: false,
    dg3Authorized: false,
    deploymentAuthorized: false,
  });
}

async function stage(code, operation) {
  try { return await operation(); }
  catch (error) {
    const failure = error instanceof Task262Failure ? error : new Task262Failure(code);
    if (error?.task262CleanupFailed === true) markCleanupFailure(failure);
    throw failure;
  }
}
function normalize(error) {
  const failure = error instanceof Task262Failure ? new Task262Failure(error.code) : new Task262Failure("TASK262_EVIDENCE_INVALID");
  if (error?.task262CleanupFailed === true) markCleanupFailure(failure);
  return failure;
}
function fail(code) { throw new Task262Failure(code); }
function digest(value) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
function deepFreeze(value) { if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.freeze(value); for (const child of Object.values(value)) deepFreeze(child); } return value; }
function markCleanupFailure(error) { try { Object.defineProperty(error, "task262CleanupFailed", { value: true }); } catch {} }
