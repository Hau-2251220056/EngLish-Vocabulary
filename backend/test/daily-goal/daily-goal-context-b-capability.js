import { createHash } from "node:crypto";
import { DAILY_GOAL_HISTORY_CONTEXTS } from "./daily-goal-ci-contract.js";

export const CONTEXT_B_OFFLINE_MODE = "OFFLINE_CONTEXT_B_CAPABILITY_ONLY";
export const CONTEXT_B_EVIDENCE_CLASS = "SYNTHETIC_FAKE_ONLY";
export const APPROVED_CONTEXT_B_REPOSITORY = "Hau-2251220056/EngLish-Vocabulary";
export const APPROVED_CONTEXT_B_TARGET_IDENTITY =
  "aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres";
export const APPROVED_CONTEXT_B_DATABASE_NAME = "postgres";

const CONTEXT_B = DAILY_GOAL_HISTORY_CONTEXTS.RUN_OWNED_SCHEMA;
const CONTEXT_A_MARKER =
  `elvocab-ci-exclusive:v1:${APPROVED_CONTEXT_B_TARGET_IDENTITY}`;
const SCHEMA_PREFIX = "elvocab_dg_d_";
const OWNERSHIP_MARKER_PREFIX = "elvocab-daily-goal-context-b:v1:";
const SAFE_DECIMAL_ID = /^[1-9][0-9]{0,19}$/;
const SAFE_SCHEMA = /^elvocab_dg_d_([1-9][0-9]{0,19})_([1-9][0-9]{0,19})_([a-f0-9]{8})$/;
const PROTECTED_SCHEMA = /^(?:public|information_schema|pg_.+)$/;
const MAX_POSTGRESQL_IDENTIFIER_BYTES = 63;
const SENSITIVE_KEY = /(?:url|password|secret|credential|token)/i;

const TRANSPORTS = Object.freeze({
  OBSERVER: "DAILY_GOAL_OBSERVER_DATABASE_URL",
  CI_WRITER_CANDIDATE: "CI_TEST_DATABASE_URL",
  FUTURE_REVIEWED_PRINCIPAL: "FUTURE_REVIEWED_PHASE_D_MUTATION_PRINCIPAL",
});

export class ContextBOfflineFailure extends Error {
  constructor(code) {
    super(`Daily Goal Context B offline capability refused. Code: ${code}`);
    this.name = "ContextBOfflineFailure";
    this.code = code;
  }
}

export function createContextBOfflineCapability() {
  const issuedEvidence = new WeakMap();
  const consumedEvidence = new WeakSet();
  const lifecycles = new WeakMap();

  function issueOfflineOwnershipEvidence(input) {
    const claims = normalizeContext(input);
    const marker = buildOwnershipMarker(claims);
    const evidence = deepFreeze({
      mode: CONTEXT_B_OFFLINE_MODE,
      evidenceClass: CONTEXT_B_EVIDENCE_CLASS,
      status: "OFFLINE_OWNERSHIP_EVIDENCE",
      context: claims.context,
      repository: claims.repository,
      runId: claims.runId,
      runAttempt: claims.runAttempt,
      targetIdentity: claims.targetIdentity,
      databaseName: claims.databaseName,
      schemaIdentity: claims.schemaIdentity,
      ownershipMarker: marker,
      authenticatedByDatabase: false,
      connectionAuthorized: false,
      executionAuthorized: false,
      mutationReady: false,
    });
    issuedEvidence.set(evidence, deepFreeze({ ...claims, ownershipMarker: marker }));
    return evidence;
  }

  function verifyOfflineOwnershipEvidence(evidence, expected) {
    const stored = issuedEvidence.get(evidence);
    if (!stored) fail("OWNERSHIP_EVIDENCE_UNTRUSTED");
    const requested = normalizeContext(expected);
    if (stableJson(stored) !== stableJson({
      ...requested,
      ownershipMarker: buildOwnershipMarker(requested),
    })) {
      fail("OWNERSHIP_EVIDENCE_MISMATCH");
    }
    return evidence;
  }

  function beginFakeLifecycle(evidence) {
    const claims = issuedEvidence.get(evidence);
    if (!claims) fail("OWNERSHIP_EVIDENCE_UNTRUSTED");
    if (consumedEvidence.has(evidence)) fail("OWNERSHIP_EVIDENCE_REPLAYED");
    consumedEvidence.add(evidence);
    const handle = Object.freeze(Object.create(null));
    lifecycles.set(handle, {
      claims,
      state: "INITIAL",
      tainted: false,
      mutationRevalidated: false,
      cleanupRevalidated: false,
    });
    return handle;
  }

  function proposeCreateFreshSchema(handle) {
    const lifecycle = requireLifecycle(handle, "INITIAL");
    lifecycle.state = "CREATE_PROPOSED";
    return fakeResult({
      status: "PROPOSED_ONLY",
      operation: "CREATE_FRESH_RUN_OWNED_SCHEMA",
      schemaIdentity: lifecycle.claims.schemaIdentity,
      ownershipMarker: lifecycle.claims.ownershipMarker,
    });
  }

  function recordFakeCreationObservation(handle, observation) {
    const lifecycle = requireLifecycle(handle, "CREATE_PROPOSED");
    try {
      assertExactFakeObservation(lifecycle.claims, observation, {
        requireFresh: true,
      });
      lifecycle.state = "OWNERSHIP_OBSERVED";
      return fakeResult({
        status: "FAKE_OWNERSHIP_CONTINUITY_VERIFIED",
        schemaIdentity: lifecycle.claims.schemaIdentity,
      });
    } catch (error) {
      lifecycle.tainted = true;
      lifecycle.state = "REFUSED";
      throw error;
    }
  }

  function proveFakeInitialHistoryEmpty(handle, history) {
    const lifecycle = requireLifecycle(handle, "OWNERSHIP_OBSERVED");
    if (!Array.isArray(history) || history.length !== 0) {
      lifecycle.tainted = true;
      lifecycle.state = "REFUSED";
      fail("INITIAL_MIGRATION_HISTORY_NOT_EMPTY");
    }
    lifecycle.state = "INITIAL_HISTORY_EMPTY";
    return fakeResult({
      status: "FAKE_INITIAL_HISTORY_EMPTY",
      schemaIdentity: lifecycle.claims.schemaIdentity,
      migrationCount: 0,
    });
  }

  function revalidateFakeOwnershipBeforeMutation(handle, observation) {
    const lifecycle = requireLifecycle(handle, "INITIAL_HISTORY_EMPTY");
    try {
      assertExactFakeObservation(lifecycle.claims, observation);
      lifecycle.mutationRevalidated = true;
      lifecycle.state = "MUTATION_REVALIDATED_OFFLINE";
      return fakeResult({
        status: "OFFLINE_CONTINUITY_ONLY",
        schemaIdentity: lifecycle.claims.schemaIdentity,
        mutationReady: false,
      });
    } catch (error) {
      lifecycle.tainted = true;
      lifecycle.state = "REFUSED";
      throw error;
    }
  }

  function revalidateFakeOwnershipBeforeCleanup(handle, observation) {
    const lifecycle = requireLifecycle(handle, "MUTATION_REVALIDATED_OFFLINE");
    try {
      assertExactFakeObservation(lifecycle.claims, observation);
      lifecycle.cleanupRevalidated = true;
      lifecycle.state = "CLEANUP_REVALIDATED_OFFLINE";
      return fakeResult({
        status: "FAKE_CLEANUP_ELIGIBLE",
        schemaIdentity: lifecycle.claims.schemaIdentity,
        dropAuthorized: false,
      });
    } catch (error) {
      lifecycle.tainted = true;
      lifecycle.state = "REFUSED";
      throw error;
    }
  }

  function recordFakeCleanupResult(handle, result) {
    const lifecycle = requireLifecycle(handle, "CLEANUP_REVALIDATED_OFFLINE");
    if (!isPlainData(result)
      || lifecycle.tainted || !lifecycle.mutationRevalidated || !lifecycle.cleanupRevalidated
      || !result || result.evidenceClass !== CONTEXT_B_EVIDENCE_CLASS
      || result.status !== "FAKE_SUCCESS"
      || result.schemaIdentity !== lifecycle.claims.schemaIdentity
      || result.ownershipMarker !== lifecycle.claims.ownershipMarker
      || result.foreignSchemaTouched !== false) {
      lifecycle.tainted = true;
      lifecycle.state = "REFUSED";
      fail("FAKE_CLEANUP_RESULT_INVALID");
    }
    lifecycle.state = "FAKE_CLEANUP_RECORDED";
    return fakeResult({
      status: "FAKE_CLEANUP_RECORDED",
      schemaIdentity: lifecycle.claims.schemaIdentity,
      liveCleanupProven: false,
      dropAuthorized: false,
    });
  }

  return Object.freeze({
    issueOfflineOwnershipEvidence,
    verifyOfflineOwnershipEvidence,
    beginFakeLifecycle,
    proposeCreateFreshSchema,
    recordFakeCreationObservation,
    proveFakeInitialHistoryEmpty,
    revalidateFakeOwnershipBeforeMutation,
    revalidateFakeOwnershipBeforeCleanup,
    recordFakeCleanupResult,
  });

  function requireLifecycle(handle, expectedState) {
    const lifecycle = lifecycles.get(handle);
    if (!lifecycle) fail("LIFECYCLE_HANDLE_UNTRUSTED");
    if (lifecycle.tainted) fail("LIFECYCLE_REFUSED");
    if (lifecycle.state !== expectedState) fail("LIFECYCLE_ORDER_INVALID");
    return lifecycle;
  }
}

export function deriveContextBSchemaIdentity(input) {
  const normalized = normalizeBaseIdentity(input);
  const scopeHash = createHash("sha256")
    .update([
      normalized.repository,
      normalized.targetIdentity,
      normalized.databaseName,
      CONTEXT_B,
    ].join("\n"))
    .digest("hex")
    .slice(0, 8);
  const schemaIdentity = `${SCHEMA_PREFIX}${normalized.runId}_${normalized.runAttempt}_${scopeHash}`;
  assertSafeContextBSchemaIdentity(schemaIdentity);
  return schemaIdentity;
}

export function assertSafeContextBSchemaIdentity(schemaIdentity) {
  if (typeof schemaIdentity !== "string"
    || Buffer.byteLength(schemaIdentity, "utf8") > MAX_POSTGRESQL_IDENTIFIER_BYTES
    || PROTECTED_SCHEMA.test(schemaIdentity)
    || !SAFE_SCHEMA.test(schemaIdentity)) {
    fail("SCHEMA_IDENTITY_INVALID");
  }
  return schemaIdentity;
}

export function assessContextBMutationCredential(candidate) {
  if (!isPlainData(candidate) || containsSensitiveField(candidate)) {
    return credentialResult("REFUSED", "CREDENTIAL_POLICY_INPUT_INVALID");
  }
  const label = candidate.transportClass;
  if (label === TRANSPORTS.OBSERVER) {
    return credentialResult("REFUSED", "OBSERVER_MUTATION_PROHIBITED");
  }
  if (label === TRANSPORTS.CI_WRITER_CANDIDATE) {
    return credentialResult("PENDING_PRINCIPAL_REVIEW", "CI_WRITER_CANDIDATE_UNVERIFIED");
  }
  if (label === TRANSPORTS.FUTURE_REVIEWED_PRINCIPAL) {
    return credentialResult("PENDING_PRINCIPAL_REVIEW", "CONNECTED_PRINCIPAL_UNVERIFIED");
  }
  return credentialResult("REFUSED", "MUTATION_PRINCIPAL_UNKNOWN");
}

function normalizeContext(input) {
  const normalized = normalizeBaseIdentity(input);
  if (input?.context !== CONTEXT_B) fail("CONTEXT_B_REQUIRED");
  if (typeof input.schemaIdentity !== "string") fail("SCHEMA_IDENTITY_REQUIRED");
  const derived = deriveContextBSchemaIdentity(normalized);
  assertSafeContextBSchemaIdentity(input.schemaIdentity);
  if (input.schemaIdentity !== derived) fail("SCHEMA_IDENTITY_BINDING_MISMATCH");
  return deepFreeze({
    context: CONTEXT_B,
    ...normalized,
    schemaIdentity: derived,
  });
}

function normalizeBaseIdentity(input) {
  if (!isPlainData(input)) fail("RUN_IDENTITY_REQUIRED");
  const repository = exactText(input.repository, "REPOSITORY_INVALID");
  const targetIdentity = exactText(input.targetIdentity, "TARGET_IDENTITY_INVALID");
  const databaseName = exactText(input.databaseName, "DATABASE_NAME_INVALID");
  const runId = exactDecimal(input.runId, "RUN_ID_INVALID");
  const runAttempt = exactDecimal(input.runAttempt, "RUN_ATTEMPT_INVALID");
  if (repository !== APPROVED_CONTEXT_B_REPOSITORY) fail("REPOSITORY_INVALID");
  if (targetIdentity !== APPROVED_CONTEXT_B_TARGET_IDENTITY) fail("TARGET_IDENTITY_INVALID");
  if (databaseName !== APPROVED_CONTEXT_B_DATABASE_NAME) fail("DATABASE_NAME_INVALID");
  return Object.freeze({ repository, runId, runAttempt, targetIdentity, databaseName });
}

function exactText(value, code) {
  if (typeof value !== "string" || value.length === 0 || value !== value.trim()) fail(code);
  return value;
}

function exactDecimal(value, code) {
  if (typeof value !== "string" || !SAFE_DECIMAL_ID.test(value)) fail(code);
  return value;
}

function buildOwnershipMarker(claims) {
  const digest = createHash("sha256")
    .update([
      claims.context,
      claims.repository,
      claims.runId,
      claims.runAttempt,
      claims.schemaIdentity,
      claims.targetIdentity,
      claims.databaseName,
    ].join("\n"))
    .digest("hex");
  return `${OWNERSHIP_MARKER_PREFIX}${digest}`;
}

function assertExactFakeObservation(claims, observation, { requireFresh = false } = {}) {
  if (!isPlainData(observation) || observation.evidenceClass !== CONTEXT_B_EVIDENCE_CLASS
    || observation.context !== CONTEXT_B
    || observation.repository !== claims.repository
    || observation.runId !== claims.runId
    || observation.runAttempt !== claims.runAttempt
    || observation.targetIdentity !== claims.targetIdentity
    || observation.databaseName !== claims.databaseName
    || observation.schemaIdentity !== claims.schemaIdentity
    || observation.schemaIdentity === "public"
    || observation.ownershipMarker !== claims.ownershipMarker
    || observation.ownershipMarker === CONTEXT_A_MARKER
    || observation.foreignOwned !== false
    || (requireFresh && observation.schemaExistedBefore !== false)) {
    fail("OWNERSHIP_CONTINUITY_INVALID");
  }
}

function credentialResult(status, code) {
  return deepFreeze({
    mode: CONTEXT_B_OFFLINE_MODE,
    evidenceClass: CONTEXT_B_EVIDENCE_CLASS,
    status,
    code,
    principalVerified: false,
    privilegeScopeVerified: false,
    connectionAuthorized: false,
    executionAuthorized: false,
    mutationReady: false,
  });
}

function fakeResult(fields) {
  return deepFreeze({
    mode: CONTEXT_B_OFFLINE_MODE,
    evidenceClass: CONTEXT_B_EVIDENCE_CLASS,
    authenticatedByDatabase: false,
    connectionAuthorized: false,
    executionAuthorized: false,
    mutationReady: false,
    ...fields,
  });
}

function containsSensitiveField(value, seen = new Set()) {
  if (!value || typeof value !== "object" || seen.has(value)) return false;
  seen.add(value);
  return Object.entries(Object.getOwnPropertyDescriptors(value)).some(([key, descriptor]) =>
    SENSITIVE_KEY.test(key)
    || (descriptor.value && typeof descriptor.value === "object"
      && containsSensitiveField(descriptor.value, seen)));
}

function isPlainData(value, seen = new Set()) {
  if (!value || typeof value !== "object" || seen.has(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    return false;
  }
  seen.add(value);
  return Object.values(Object.getOwnPropertyDescriptors(value)).every((descriptor) => {
    if (typeof descriptor.get === "function" || typeof descriptor.set === "function") return false;
    const child = descriptor.value;
    if (typeof child === "function") return false;
    if (child && typeof child === "object") return isPlainData(child, seen);
    return true;
  });
}

function stableJson(value) {
  if (!value || typeof value !== "object") return JSON.stringify(value);
  const sorted = {};
  for (const key of Object.keys(value).sort()) sorted[key] = value[key];
  return JSON.stringify(sorted);
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function fail(code) {
  throw new ContextBOfflineFailure(code);
}
