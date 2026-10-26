import { createHash } from "node:crypto";

export const DG2_OPERATION = "DAILY_GOAL_DG2_REAL_STACK_POSTGRESQL_17";
export const DG2_REPOSITORY = "Hau-2251220056/EngLish-Vocabulary";
export const DG2_REF = "refs/heads/feature/daily-goal-v1";
export const DG2_POSTGRESQL_MAJOR = 17;
export const DG2_OUTPUT_LIMIT_BYTES = 16_384;
export const DG2_MIGRATION_INVENTORY_DIGEST = "833edeb16488fc71fbbea22532531699eb2ffb9334b5b4f1d6ff5bcf0d41c864";
export const DG2_SUITE_VERSION = "task-260-dg2-v1";
export const DG2_REWARD_SCOPE = Object.freeze({
  acDg024RewardXp: "NOT_RUN_DEFERRED_TO_TASK_262",
  acDg048SetupReward: "NOT_RUN_DEFERRED_TO_TASK_262",
});

const RESULT_CATEGORIES = Object.freeze([
  "sameUserContention", "differentUserIndependence", "ownershipTransfer",
  "staleGeneration", "replay", "rollback", "fkCleanup", "sleepOffline",
  "vietnamMidnight", "httpAuthorization", "httpConflicts", "noFabrication",
]);
const SAFE_CODES = new Set([
  "DG2_BINDING_INCOMPLETE", "DG2_NOT_AUTHORIZED", "DG2_BINDING_MISMATCH",
  "DG2_AUTHORIZATION_INVALID_OR_CONSUMED", "DG2_ADAPTER_INCOMPLETE",
  "DG2_PREPARATION_FAILED", "DG2_CLIENT_GENERATION_FAILED", "DG2_REPOSITORY_FAILED",
  "DG2_HTTP_FAILED", "DG2_EVIDENCE_INVALID", "DG2_OUTPUT_LIMIT_EXCEEDED",
  "DG2_CLEANUP_FAILED", "DG2_BARRIER_TIMEOUT",
]);

export class Dg2Failure extends Error {
  constructor(code) {
    const safe = SAFE_CODES.has(code) ? code : "DG2_EVIDENCE_INVALID";
    super(`Daily Goal DG-2 verification refused. Code: ${safe}`);
    this.name = "Dg2Failure";
    this.code = safe;
    this.dg2Passed = false;
    this.supabasePlatformVerified = false;
    this.deploymentAuthorized = false;
  }
}

export function validateDg2Binding(input) {
  const required = ["operation", "authorized", "repository", "sourceSha", "sourceRef", "workflowSha", "runId", "runAttempt", "postgresqlMajor"];
  if (!input || required.some((key) => typeof input[key] !== "string" || input[key].length === 0)) fail("DG2_BINDING_INCOMPLETE");
  if (input.operation !== DG2_OPERATION || input.authorized !== "true") fail("DG2_NOT_AUTHORIZED");
  if (input.repository !== DG2_REPOSITORY || input.sourceRef !== DG2_REF
    || !/^[a-f0-9]{40}$/.test(input.sourceSha) || input.workflowSha !== input.sourceSha
    || !/^[1-9]\d*$/.test(input.runId) || !/^[1-9]\d*$/.test(input.runAttempt)
    || input.postgresqlMajor !== String(DG2_POSTGRESQL_MAJOR)) fail("DG2_BINDING_MISMATCH");
  return deepFreeze({
    repository: input.repository, sourceSha: input.sourceSha, sourceRef: input.sourceRef,
    workflowSha: input.workflowSha, runId: input.runId, runAttempt: input.runAttempt,
    postgresqlMajor: DG2_POSTGRESQL_MAJOR, migrationInventoryDigest: DG2_MIGRATION_INVENTORY_DIGEST,
    suiteVersion: DG2_SUITE_VERSION,
  });
}

export function createDg2Harness() {
  const authorizations = new WeakMap();
  const results = new WeakMap();
  function issueAuthorization(input) {
    const binding = validateDg2Binding(input);
    const token = Object.freeze(Object.create(null));
    authorizations.set(token, { binding, digest: digest(binding), consumed: false });
    return token;
  }
  async function run({ authorization, adapter }) {
    const state = authorizations.get(authorization);
    if (!state || state.consumed) fail("DG2_AUTHORIZATION_INVALID_OR_CONSUMED");
    state.consumed = true;
    for (const method of ["assertPrepared", "generateClient", "runRepository", "runHttp", "cleanup"]) {
      if (typeof adapter?.[method] !== "function") fail("DG2_ADAPTER_INCOMPLETE");
    }
    let primary;
    let categories;
    let cleanupAttempted = false;
    try {
      await stage("DG2_PREPARATION_FAILED", () => adapter.assertPrepared(state.binding));
      await stage("DG2_CLIENT_GENERATION_FAILED", () => adapter.generateClient(state.binding));
      const repository = await stage("DG2_REPOSITORY_FAILED", () => adapter.runRepository(state.binding));
      const http = await stage("DG2_HTTP_FAILED", () => adapter.runHttp(state.binding));
      categories = validateCategories({ ...repository, ...http });
    } catch (error) {
      primary = normalize(error);
    } finally {
      if (!cleanupAttempted) {
        cleanupAttempted = true;
        try { await adapter.cleanup(); }
        catch { primary ??= new Dg2Failure("DG2_CLEANUP_FAILED"); }
      }
    }
    if (primary) throw primary;
    const evidence = deepFreeze({
      outcome: "DG2_REAL_STACK_VERIFICATION_PASS",
      scope: "PORTABLE_POSTGRESQL_17_AND_JOB_LOCAL_EXPRESS_ONLY",
      binding: state.binding, categories, rewardSpecific: DG2_REWARD_SCOPE,
      dg2Passed: false, supabasePlatformVerified: false, deploymentAuthorized: false,
    });
    if (Buffer.byteLength(JSON.stringify(evidence), "utf8") > DG2_OUTPUT_LIMIT_BYTES) fail("DG2_OUTPUT_LIMIT_EXCEEDED");
    const token = Object.freeze(Object.create(null));
    results.set(token, { authorization, digest: state.digest, evidence, consumed: false });
    return token;
  }
  function verifyResult({ trustedResult, authorization, expectedBinding }) {
    const result = results.get(trustedResult);
    if (!result || result.consumed || result.authorization !== authorization) fail("DG2_EVIDENCE_INVALID");
    if (result.digest !== digest(validateDg2Binding(expectedBinding))) fail("DG2_BINDING_MISMATCH");
    result.consumed = true;
    return result.evidence;
  }
  return Object.freeze({ issueAuthorization, run, verifyResult });
}

export function createControlledBarrier({ parties, timeoutMilliseconds = 2_000, setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  if (!Number.isInteger(parties) || parties < 1 || !Number.isInteger(timeoutMilliseconds) || timeoutMilliseconds < 1) throw new TypeError("A bounded barrier contract is required.");
  let arrivals = 0;
  let released = false;
  let settled = false;
  let resolveRelease;
  let rejectRelease;
  const waiting = new Promise((resolve, reject) => { resolveRelease = resolve; rejectRelease = reject; });
  const timer = setTimer(() => {
    if (settled) return;
    settled = true;
    rejectRelease(new Dg2Failure("DG2_BARRIER_TIMEOUT"));
  }, timeoutMilliseconds);
  return Object.freeze({
    async arriveAndWait() {
      if (released || arrivals >= parties) throw new Error("Barrier received an unexpected arrival.");
      arrivals += 1;
      await waiting;
    },
    release() {
      if (released || arrivals !== parties) throw new Error("Barrier cannot be released before exact arrivals.");
      released = true;
      settled = true;
      clearTimer(timer);
      resolveRelease();
    },
    snapshot() { return Object.freeze({ arrivals, parties, released }); },
  });
}

export function refusalEvidence(error) {
  const failure = normalize(error);
  return deepFreeze({
    outcome: "DG2_REAL_STACK_VERIFICATION_REFUSED", code: failure.code,
    dg2Passed: false, supabasePlatformVerified: false, deploymentAuthorized: false,
  });
}

function validateCategories(value) {
  if (!value || Object.keys(value).length !== RESULT_CATEGORIES.length) fail("DG2_EVIDENCE_INVALID");
  const normalized = {};
  for (const category of RESULT_CATEGORIES) {
    const item = value[category];
    if (!item || item.status !== "PASS" || !Number.isInteger(item.assertions) || item.assertions < 1) fail("DG2_EVIDENCE_INVALID");
    normalized[category] = Object.freeze({ status: "PASS", assertions: item.assertions });
  }
  if (Object.keys(value).some((key) => !RESULT_CATEGORIES.includes(key))) fail("DG2_EVIDENCE_INVALID");
  return deepFreeze(normalized);
}
async function stage(code, operation) { try { return await operation(); } catch (error) { if (error instanceof Dg2Failure) throw error; throw new Dg2Failure(code); } }
function normalize(error) { return error instanceof Dg2Failure ? new Dg2Failure(error.code) : new Dg2Failure("DG2_EVIDENCE_INVALID"); }
function fail(code) { throw new Dg2Failure(code); }
function digest(value) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
function deepFreeze(value) { if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.freeze(value); for (const child of Object.values(value)) deepFreeze(child); } return value; }
