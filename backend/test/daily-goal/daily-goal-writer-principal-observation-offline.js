import {
  classifyPhaseDPrincipalEvidence,
  PHASE_D_PRINCIPAL_EVIDENCE_CONTRACT,
} from "./daily-goal-phase-d-principal-evidence.js";

export const WRITER_PRINCIPAL_OBSERVATION_OPERATION =
  "DAILY_GOAL_WRITER_PRINCIPAL_OBSERVATION";
export const WRITER_PRINCIPAL_OBSERVATION_CONTRACT =
  "daily-goal-writer-principal-observation/offline-v1";
export const WRITER_PRINCIPAL_OBSERVATION_EVIDENCE_CLASS = "SYNTHETIC_ONLY";
export const WRITER_PRINCIPAL_CANDIDATE_TRANSPORT = "CI_TEST_DATABASE_URL";

const OBSERVER_TRANSPORT = "DAILY_GOAL_OBSERVER_DATABASE_URL";
const REQUIRED_STEPS = Object.freeze([
  "BEGIN_SYNTHETIC_TRANSACTION",
  "SET_TRANSACTION_READ_ONLY",
  "VERIFY_TRANSACTION_READ_ONLY",
  "OBSERVE_TARGET",
  "OBSERVE_PRINCIPAL",
  "OBSERVE_ROLE_ATTRIBUTES",
  "OBSERVE_MEMBERSHIPS",
  "OBSERVE_DATABASE_PRIVILEGES",
  "OBSERVE_SCHEMA_PRIVILEGES",
  "OBSERVE_OBJECT_PRIVILEGES",
  "OBSERVE_FUNCTION_PRIVILEGES",
  "OBSERVE_DEFAULT_PRIVILEGES",
  "ROLLBACK_SYNTHETIC_TRANSACTION",
  "DISCONNECT_SYNTHETIC_TRANSPORT",
]);
const SENSITIVE_KEY = /^(?:databaseUrl|password|secret|token|credential|rawError|rawSql|sql|prisma|connectionHandle|query|execute|command)$/i;
const FORGED_AUTHORIZATION_KEY = /^(?:authorized|humanApproved|principalApproved|connectionAuthorized|executionAuthorized|mutationReady|livePrincipalVerified|authenticatedByDatabase|sameConnectionVerified)$/;
const SHA256 = /^[a-f0-9]{64}$/;
const SAFE_GENERATION = /^[1-9][0-9]{0,19}$/;
const SAFE_SERVER_VERSION = /^[A-Za-z0-9][A-Za-z0-9 ._+,:()/=-]{0,255}$/;

const AUTHORIZATION_FALSE = Object.freeze({
  principalApproved: false,
  connectionAuthorized: false,
  executionAuthorized: false,
  mutationReady: false,
  livePrincipalVerified: false,
});

export const WRITER_PRINCIPAL_CATALOG_INVENTORY = deepFreeze([
  catalogCategory("principal", [
    "targetIdentity", "databaseName", "serverVersion", "sessionUser",
    "currentUser", "effectiveRole", "roleExists", "roleTransition",
  ], "PRINCIPAL_BINDING_MISMATCH", ["targetIdentity", "databaseName", "serverVersion"]),
  catalogCategory("roleAttributes", [
    "login", "inherit", "superuser", "createRole", "createDb",
    "replication", "bypassRls",
  ], "DANGEROUS_ROLE_ATTRIBUTE", ["login", "inherit"]),
  catalogCategory("memberships", [
    "role", "source", "inherited", "setRoleAllowed", "adminOption", "dangerous",
  ], "DANGEROUS_MEMBERSHIP_PATH", ["membershipCount"]),
  catalogCategory("databasePrivileges", [
    "connect", "owner", "create", "temporary", "publicTemporary",
  ], "DATABASE_AUTHORITY_PROHIBITED", ["connect", "temporary", "publicTemporary"]),
  catalogCategory("schemaPrivileges", [
    "target", "public", "system", "foreign", "searchPath", "urlSchema",
  ], "OUTSIDE_SCHEMA_AUTHORITY_PROHIBITED", ["targetSchema", "searchPath"]),
  catalogCategory("objectPrivileges", [
    "targetOwnedObjectCount", "targetMutationGrantCount",
    "outsideTableMutationCount", "outsideSequenceMutationCount",
    "outsideOwnershipCount", "publicMutationGrantCount",
    "inheritedMutationGrantCount",
  ], "OUTSIDE_OBJECT_AUTHORITY_PROHIBITED", ["targetOwnedObjectCount"]),
  catalogCategory("functionPrivileges", [
    "executableSecurityDefinerCount", "ambiguousExecutableNonSystemCount",
    "unreviewedExecutableCount",
  ], "FUNCTION_AUTHORITY_UNVERIFIED", ["executableSecurityDefinerCount"]),
  catalogCategory("defaultPrivileges", [
    "outsideTargetMutationGrantCount", "publicMutationGrantCount",
    "inheritedMutationGrantCount", "unreviewedEntryCount",
  ], "DEFAULT_PRIVILEGE_AUTHORITY_PROHIBITED", ["unreviewedEntryCount"]),
]);

/**
 * Creates a deliberately synthetic-only harness. It accepts no connection,
 * environment, URL, query callback, SQL executor, Prisma client or subprocess.
 * Issued capabilities have provenance only inside this factory instance.
 */
export function createWriterPrincipalObservationOfflineHarness() {
  const authorizations = new WeakSet();
  const transports = new WeakMap();
  const consumedTransports = new WeakSet();

  function issueObservationAuthorization(input) {
    assertSafePlainData(input);
    refuseSensitiveOrAuthorizationClaims(input);
    assertExactKeys(input, ["operation", "transportClass"]);
    if (input.operation !== WRITER_PRINCIPAL_OBSERVATION_OPERATION) {
      throw new OfflineObservationFailure("OBSERVATION_OPERATION_REQUIRED");
    }
    if (input.transportClass !== WRITER_PRINCIPAL_CANDIDATE_TRANSPORT) {
      throw new OfflineObservationFailure(
        input.transportClass === OBSERVER_TRANSPORT
          ? "PHASE_B_OBSERVER_TRANSPORT_PROHIBITED"
          : "WRITER_CANDIDATE_TRANSPORT_REQUIRED",
      );
    }
    const capability = deepFreeze({
      contractVersion: WRITER_PRINCIPAL_OBSERVATION_CONTRACT,
      evidenceClass: WRITER_PRINCIPAL_OBSERVATION_EVIDENCE_CLASS,
      operation: WRITER_PRINCIPAL_OBSERVATION_OPERATION,
      transportClass: WRITER_PRINCIPAL_CANDIDATE_TRANSPORT,
      authorizesLiveConnection: false,
      authorizesMutation: false,
    });
    authorizations.add(capability);
    return capability;
  }

  function issueSyntheticTransport(input) {
    assertSafePlainData(input);
    refuseSensitiveOrAuthorizationClaims(input);
    assertExactKeys(input, [
      "evidence", "lifecycle", "observationMetadata", "rollbackSucceeded",
      "disconnectSucceeded",
    ]);
    const token = Object.freeze(Object.create(null));
    transports.set(token, deepFreeze(structuredClone(input)));
    return token;
  }

  function observe({ authorization, transport, nowMs }) {
    if (!authorizations.has(authorization)) {
      return result("REFUSED", "OBSERVATION_AUTHORIZATION_UNTRUSTED");
    }
    const modeled = transports.get(transport);
    if (!modeled || consumedTransports.has(transport)) {
      return result("REFUSED", "SYNTHETIC_TRANSPORT_UNTRUSTED");
    }
    consumedTransports.add(transport);

    try {
      validateLifecycle(modeled.lifecycle, modeled.evidence, modeled.observationMetadata);
      if (modeled.rollbackSucceeded !== true) {
        return result("REFUSED", "ROLLBACK_FAILED");
      }
      if (modeled.disconnectSucceeded !== true) {
        return result("REFUSED", "DISCONNECT_FAILED");
      }
      const classified = classifyPhaseDPrincipalEvidence(modeled.evidence, { nowMs });
      return fromPrincipalClassification(classified);
    } catch (error) {
      const code = error instanceof OfflineObservationFailure
        ? error.code
        : "UNSAFE_SYNTHETIC_EVIDENCE";
      return result(code === "CATALOG_EVIDENCE_INCOMPLETE" ? "UNVERIFIED" : "REFUSED", code);
    }
  }

  return Object.freeze({
    issueObservationAuthorization,
    issueSyntheticTransport,
    observe,
  });
}

export class OfflineObservationFailure extends Error {
  constructor(code) {
    super(`Writer principal offline observation refused. Code: ${code}`);
    this.name = "OfflineObservationFailure";
    this.code = code;
  }
}

function validateLifecycle(lifecycle, evidence, metadata) {
  if (!Array.isArray(lifecycle) || lifecycle.length !== REQUIRED_STEPS.length) {
    throw new OfflineObservationFailure("LIFECYCLE_INCOMPLETE");
  }
  if (!evidence || evidence.contractVersion !== PHASE_D_PRINCIPAL_EVIDENCE_CONTRACT) {
    throw new OfflineObservationFailure("PRINCIPAL_CONTRACT_MISMATCH");
  }

  let expectedSession;
  let expectedGeneration;
  for (let index = 0; index < REQUIRED_STEPS.length; index += 1) {
    const event = lifecycle[index];
    assertSafePlainData(event);
    refuseSensitiveOrAuthorizationClaims(event);
    assertExactKeys(event, [
      "step", "sessionDigest", "observationGeneration", "transactionReadOnly",
    ]);
    if (event.step !== REQUIRED_STEPS[index]) {
      throw new OfflineObservationFailure("LIFECYCLE_ORDER_INVALID");
    }
    if (!SHA256.test(event.sessionDigest)
      || !SAFE_GENERATION.test(event.observationGeneration)) {
      throw new OfflineObservationFailure("CONNECTION_EVIDENCE_INVALID");
    }
    expectedSession ??= event.sessionDigest;
    expectedGeneration ??= event.observationGeneration;
    if (event.sessionDigest !== expectedSession) {
      throw new OfflineObservationFailure("CONNECTION_CHANGED_DURING_OBSERVATION");
    }
    if (event.observationGeneration !== expectedGeneration) {
      throw new OfflineObservationFailure("OBSERVATION_GENERATION_DRIFT");
    }
    const readOnlyEstablished = index >= REQUIRED_STEPS.indexOf("VERIFY_TRANSACTION_READ_ONLY");
    if (readOnlyEstablished && event.transactionReadOnly !== true) {
      throw new OfflineObservationFailure("READ_ONLY_VERIFICATION_FAILED");
    }
    if (!readOnlyEstablished && event.transactionReadOnly !== false) {
      throw new OfflineObservationFailure("READ_ONLY_LIFECYCLE_INVALID");
    }
  }

  if (expectedGeneration !== evidence.provenance?.observationGeneration) {
    throw new OfflineObservationFailure("OBSERVATION_GENERATION_DRIFT");
  }
  for (const phase of ["preflight", "mutation", "cleanup"]) {
    if (evidence.connectionEvidence?.[phase]?.connectionIdentityDigest !== expectedSession) {
      throw new OfflineObservationFailure("CONNECTION_BINDING_MISMATCH");
    }
  }
  validateObservationMetadata(metadata, evidence, expectedSession, expectedGeneration);
  validateCatalogCoverage(evidence);
}

function validateObservationMetadata(metadata, evidence, sessionDigest, generation) {
  assertSafePlainData(metadata);
  assertExactKeys(metadata, [
    "targetIdentity", "databaseName", "serverVersion", "sessionUser",
    "currentUser", "effectiveRole", "sessionDigest", "observationGeneration",
  ]);
  if (!SAFE_SERVER_VERSION.test(metadata.serverVersion ?? "")) {
    throw new OfflineObservationFailure("SERVER_VERSION_EVIDENCE_INVALID");
  }
  const expected = {
    targetIdentity: evidence.destination?.targetIdentity,
    databaseName: evidence.destination?.databaseName,
    sessionUser: evidence.principal?.sessionUser,
    currentUser: evidence.principal?.currentUser,
    effectiveRole: evidence.principal?.effectiveRole,
    sessionDigest,
    observationGeneration: generation,
  };
  for (const [field, value] of Object.entries(expected)) {
    if (metadata[field] !== value) {
      throw new OfflineObservationFailure("CONNECTED_OBSERVATION_MISMATCH");
    }
  }
}

function validateCatalogCoverage(evidence) {
  const coverage = evidence.provenance;
  const requiredCoverage = [
    "catalogCoverageComplete", "roleCoverageComplete", "membershipCoverageComplete",
    "databasePrivilegeCoverageComplete", "schemaPrivilegeCoverageComplete",
    "objectPrivilegeCoverageComplete", "functionPrivilegeCoverageComplete",
    "defaultPrivilegeCoverageComplete",
  ];
  if (!coverage || requiredCoverage.some((field) => coverage[field] !== true)
    || coverage.inventoryOverflow !== false) {
    throw new OfflineObservationFailure("CATALOG_EVIDENCE_INCOMPLETE");
  }
  for (const category of WRITER_PRINCIPAL_CATALOG_INVENTORY) {
    const value = evidence[category.name];
    if (value === undefined || value === null) {
      throw new OfflineObservationFailure("CATALOG_EVIDENCE_INCOMPLETE");
    }
    if (!["principal", "roleAttributes", "memberships"].includes(category.name)
      && value.coverageComplete !== true) {
      throw new OfflineObservationFailure("CATALOG_EVIDENCE_INCOMPLETE");
    }
  }
}

function fromPrincipalClassification(classified) {
  const summary = classified?.summary ?? {};
  return result(classified?.state, classified?.reasonCode, {
    repository: summary.repository,
    targetIdentity: summary.targetIdentity,
    databaseName: summary.databaseName,
    context: summary.context,
    runId: summary.runId,
    runAttempt: summary.runAttempt,
    schemaIdentity: summary.schemaIdentity,
    reviewedCommit: summary.reviewedCommit,
    observationGeneration: summary.observationGeneration,
    principalClass: summary.principalClass,
    transportClass: summary.transportClass,
    membershipCount: summary.membershipCount,
    migrationCount: summary.migrationCount,
    privilegeDigest: summary.privilegeDigest,
    migrationInventoryDigest: summary.migrationInventoryDigest,
  });
}

function result(state, reasonCode, summary = {}) {
  const allowlistedSummary = {};
  for (const [key, value] of Object.entries(summary)) {
    if (value !== undefined) allowlistedSummary[key] = value;
  }
  return deepFreeze({
    contractVersion: WRITER_PRINCIPAL_OBSERVATION_CONTRACT,
    candidateClassification: state ?? "REFUSED",
    reasonCode: reasonCode ?? "UNSAFE_SYNTHETIC_EVIDENCE",
    evidenceClass: WRITER_PRINCIPAL_OBSERVATION_EVIDENCE_CLASS,
    evidenceAuthority: "NON_LIVE_NON_AUTHORIZING",
    coverageStatus: state === "ELIGIBLE_FOR_HUMAN_REVIEW" ? "COMPLETE" : "NOT_VERIFIED",
    ...AUTHORIZATION_FALSE,
    summary: allowlistedSummary,
  });
}

function catalogCategory(name, fields, refusalCode, redactedFields) {
  return Object.freeze({
    name,
    fields: Object.freeze(fields),
    completeness: "EXACT_FIELDS_AND_EFFECTIVE_INHERITED_PUBLIC_SCOPE_REQUIRED",
    visibilityLimitation: "FUTURE_LIVE_COLLECTOR_MUST_PROVE_CATALOG_VISIBILITY",
    refusalCode,
    incompleteCode: "CATALOG_EVIDENCE_INCOMPLETE",
    redactedFields: Object.freeze(redactedFields),
  });
}

function assertExactKeys(value, expected) {
  if (!value || typeof value !== "object") {
    throw new OfflineObservationFailure("UNSAFE_SYNTHETIC_EVIDENCE");
  }
  const actual = Object.keys(value).sort();
  const required = [...expected].sort();
  if (actual.length !== required.length
    || actual.some((key, index) => key !== required[index])) {
    throw new OfflineObservationFailure("UNEXPECTED_FIELD");
  }
}

function refuseSensitiveOrAuthorizationClaims(value) {
  const visit = (candidate) => {
    if (!candidate || typeof candidate !== "object") return;
    for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(candidate))) {
      if (SENSITIVE_KEY.test(key)) {
        throw new OfflineObservationFailure("SENSITIVE_INPUT_PROHIBITED");
      }
      if (FORGED_AUTHORIZATION_KEY.test(key)) {
        throw new OfflineObservationFailure("FORGED_AUTHORIZATION_CLAIM");
      }
      if (descriptor.value && typeof descriptor.value === "object") visit(descriptor.value);
    }
  };
  visit(value);
}

function assertSafePlainData(value) {
  const seen = new Set();
  const visit = (candidate) => {
    if (!candidate || typeof candidate !== "object" || seen.has(candidate)) {
      throw new OfflineObservationFailure("UNSAFE_SYNTHETIC_EVIDENCE");
    }
    const prototype = Object.getPrototypeOf(candidate);
    if (Array.isArray(candidate)) {
      if (prototype !== Array.prototype) {
        throw new OfflineObservationFailure("UNSAFE_SYNTHETIC_EVIDENCE");
      }
    } else if (![Object.prototype, null].includes(prototype)) {
      throw new OfflineObservationFailure("UNSAFE_SYNTHETIC_EVIDENCE");
    }
    seen.add(candidate);
    for (const descriptor of Object.values(Object.getOwnPropertyDescriptors(candidate))) {
      if (typeof descriptor.get === "function" || typeof descriptor.set === "function"
        || typeof descriptor.value === "function") {
        throw new OfflineObservationFailure("UNSAFE_SYNTHETIC_EVIDENCE");
      }
      if (descriptor.value && typeof descriptor.value === "object") visit(descriptor.value);
    }
  };
  visit(value);
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
