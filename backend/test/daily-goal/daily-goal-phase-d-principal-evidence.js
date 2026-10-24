import { createHash } from "node:crypto";
import {
  APPROVED_CONTEXT_B_DATABASE_NAME,
  APPROVED_CONTEXT_B_REPOSITORY,
  APPROVED_CONTEXT_B_TARGET_IDENTITY,
  createContextBOfflineCapability,
  deriveContextBSchemaIdentity,
} from "./daily-goal-context-b-capability.js";
import { DAILY_GOAL_HISTORY_CONTEXTS } from "./daily-goal-ci-contract.js";
import { DAILY_GOAL_MIGRATION } from "./daily-goal-phase-d-offline.js";

export const PHASE_D_PRINCIPAL_EVIDENCE_CONTRACT =
  "daily-goal-phase-d-principal-evidence/v1";
export const PHASE_D_PRINCIPAL_EVIDENCE_CLASS = "SYNTHETIC_ONLY";
export const PHASE_D_PRINCIPAL_COLLECTOR_VERSION =
  "daily-goal-phase-d-principal-collector/design-v1";
export const PHASE_D_PRINCIPAL_REVIEWED_COMMIT =
  "3da4b2c88d556bcfa95c4fb81e34b416f2445968";
export const PHASE_D_PRINCIPAL_MAX_AGE_MS = 5 * 60 * 1_000;

export const PHASE_D_PRINCIPAL_STATES = Object.freeze({
  PENDING_LIVE_OBSERVATION: "PENDING_LIVE_OBSERVATION",
  UNVERIFIED: "UNVERIFIED",
  REFUSED: "REFUSED",
  ELIGIBLE_FOR_HUMAN_REVIEW: "ELIGIBLE_FOR_HUMAN_REVIEW",
});

export const PHASE_D_PRINCIPAL_REASON_CODES = Object.freeze({
  SYNTHETIC_POLICY_SATISFIED: "SYNTHETIC_POLICY_SATISFIED",
  LIVE_OBSERVATION_REQUIRED: "LIVE_OBSERVATION_REQUIRED",
  EVIDENCE_REQUIRED: "EVIDENCE_REQUIRED",
  REQUIRED_FIELD_MISSING: "REQUIRED_FIELD_MISSING",
  UNEXPECTED_FIELD: "UNEXPECTED_FIELD",
  UNSAFE_EVIDENCE_SHAPE: "UNSAFE_EVIDENCE_SHAPE",
  SENSITIVE_INPUT_PROHIBITED: "SENSITIVE_INPUT_PROHIBITED",
  FORGED_AUTHORIZATION_CLAIM: "FORGED_AUTHORIZATION_CLAIM",
  CONTRACT_MISMATCH: "CONTRACT_MISMATCH",
  CONNECTED_SOURCE_SPOOFED: "CONNECTED_SOURCE_SPOOFED",
  DESTINATION_BINDING_MISMATCH: "DESTINATION_BINDING_MISMATCH",
  MIGRATION_INVENTORY_MISMATCH: "MIGRATION_INVENTORY_MISMATCH",
  PRINCIPAL_CLASS_PROHIBITED: "PRINCIPAL_CLASS_PROHIBITED",
  PRINCIPAL_BINDING_MISMATCH: "PRINCIPAL_BINDING_MISMATCH",
  ROLE_TRANSITION_UNREVIEWED: "ROLE_TRANSITION_UNREVIEWED",
  DANGEROUS_ROLE_ATTRIBUTE: "DANGEROUS_ROLE_ATTRIBUTE",
  DANGEROUS_MEMBERSHIP_PATH: "DANGEROUS_MEMBERSHIP_PATH",
  DATABASE_AUTHORITY_PROHIBITED: "DATABASE_AUTHORITY_PROHIBITED",
  OUTSIDE_SCHEMA_AUTHORITY_PROHIBITED: "OUTSIDE_SCHEMA_AUTHORITY_PROHIBITED",
  OUTSIDE_OBJECT_AUTHORITY_PROHIBITED: "OUTSIDE_OBJECT_AUTHORITY_PROHIBITED",
  FUNCTION_AUTHORITY_UNVERIFIED: "FUNCTION_AUTHORITY_UNVERIFIED",
  DEFAULT_PRIVILEGE_AUTHORITY_PROHIBITED:
    "DEFAULT_PRIVILEGE_AUTHORITY_PROHIBITED",
  CATALOG_EVIDENCE_INCOMPLETE: "CATALOG_EVIDENCE_INCOMPLETE",
  EVIDENCE_STALE: "EVIDENCE_STALE",
  CONNECTION_BINDING_MISMATCH: "CONNECTION_BINDING_MISMATCH",
  PRIVILEGE_DIGEST_MISMATCH: "PRIVILEGE_DIGEST_MISMATCH",
  OBSERVATION_GENERATION_MISMATCH: "OBSERVATION_GENERATION_MISMATCH",
});

export const PHASE_D_REVIEWED_MIGRATION_INVENTORY = deepFreeze([
  migration("20260916042441_init_user_auth_session", "92035a5a775a727eeb0fb62aaa21036b66f3f5c6eac2284b6174382b617a8702"),
  migration("20260921000000_add_topic", "f6fe9833e31b6e17fd1965348c6945508765b782dbd1447b8a7317ca11dc9fad"),
  migration("20260921000001_add_vocabulary_aggregate", "831d2a2408e5d1cc129e88577425066db092c4b2914c206dd1a056a2591891a3"),
  migration("20260922000000_add_vocabulary_set", "4c7ba91a1230a5772b89e126d6fe90d91115530651bfd44471078b8a3b691afb"),
  migration("20260923000000_add_learning_progress", "d7c6aa672a360c54c9565f22a93437fbed38c04c77edc7ab8c6437f0f5da7079"),
  migration("20260928000000_add_personal_vocabulary_foundation", "c44e2418cfa0a330620ffa961ddb21e1f58c56277b162ecb8d20fe22f60ce7f8"),
  migration("20260930000000_decouple_personal_set_topic", "065a2a4932186d963d36a7a0382be407c05414baa4c35290a672d733a3c8ce94"),
  migration("20261007000000_add_vocabulary_set_metadata", "3e0e6b8927174349e41c8a639f964a52e458cb16f378b1aace701cf77f3d7415"),
  migration("20261016000000_add_xp_level_v1", "8bcf4228f178601d19416cd40c2d1736a36b9e2eab8a73c037a4ae2ce414abae"),
  migration("20261017000000_add_streak_v1", "8ac6901420011a9a2721660add430136772c5581e46b67ae1d72cd04d001bedc"),
  migration("20261018000000_add_streak_srs_receipt", "c123f901cd02f81dd87758618b7b06917640968122bf60df67b077694b60b4da"),
  migration(DAILY_GOAL_MIGRATION.name, DAILY_GOAL_MIGRATION.checksum),
]);

export const PHASE_D_REVIEWED_MIGRATION_INVENTORY_DIGEST = sha256(
  stableJson(PHASE_D_REVIEWED_MIGRATION_INVENTORY),
);

const CONTEXT_B = DAILY_GOAL_HISTORY_CONTEXTS.RUN_OWNED_SCHEMA;
const SYNTHETIC_SOURCE = "SYNTHETIC_MODELED_OBSERVATION";
const COMPLETE_OBSERVATION = "SYNTHETIC_COMPLETE";
const PENDING_OBSERVATION = "NOT_OBSERVED";
const ALLOWED_TRANSPORT = "CI_TEST_DATABASE_URL";
const CANDIDATE_CLASS = "CI_WRITER_CANDIDATE_UNVERIFIED";
const SHA256 = /^[a-f0-9]{64}$/;
const COMMIT = /^[a-f0-9]{40}$/;
const SAFE_DECIMAL = /^[1-9][0-9]{0,19}$/;
const SAFE_ROLE = /^[a-z_][a-z0-9_$-]{0,62}$/;
const SENSITIVE_KEY = /^(?:databaseUrl|password|secret|token|credential|rawError|rawSql|sql|prisma|connectionHandle)$/i;
const FORGED_AUTHORIZATION_KEY = /^(?:principalApproved|connectionAuthorized|executionAuthorized|mutationReady|livePrincipalVerified|humanApproved|authenticatedByDatabase|sameConnectionVerified)$/;

const AUTHORIZATION_FALSE = Object.freeze({
  principalApproved: false,
  connectionAuthorized: false,
  executionAuthorized: false,
  mutationReady: false,
  livePrincipalVerified: false,
});

const TOP_LEVEL_KEYS = Object.freeze([
  "contractVersion", "evidenceClass", "observationState", "provenance",
  "destination", "principal", "roleAttributes", "memberships",
  "databasePrivileges", "schemaPrivileges", "objectPrivileges",
  "functionPrivileges", "defaultPrivileges", "connectionEvidence",
]);

/**
 * Calculates an integrity digest for canonical synthetic privilege records.
 * This digest detects modeled drift only; it is never an attestation or approval.
 */
export function calculateSyntheticPrincipalPrivilegeDigest(value) {
  assertSafePlainData(value);
  return sha256(stableJson(value));
}

/**
 * Classifies fake evidence only. A future LIVE collector/executor must be separately
 * designed and must attest the actual mutation connection (or retain the already
 * attested connection). This function deliberately cannot authorize either path.
 */
export function classifyPhaseDPrincipalEvidence(input, options = {}) {
  try {
    assertSafePlainData(options);
    assertExactKeys(options, ["nowMs"]);
    const { nowMs } = options;
    if (input === undefined || input === null) {
      decide("UNVERIFIED", "EVIDENCE_REQUIRED");
    }
    assertSafePlainData(input);
    refuseSensitiveOrAuthorizationClaims(input);
    assertExactKeys(input, TOP_LEVEL_KEYS);
    if (!Number.isSafeInteger(nowMs) || nowMs < 0) {
      decide("UNVERIFIED", "REQUIRED_FIELD_MISSING");
    }

    assertExact(input.contractVersion, PHASE_D_PRINCIPAL_EVIDENCE_CONTRACT,
      "CONTRACT_MISMATCH");
    assertExact(input.evidenceClass, PHASE_D_PRINCIPAL_EVIDENCE_CLASS,
      "CONNECTED_SOURCE_SPOOFED");
    if (![COMPLETE_OBSERVATION, PENDING_OBSERVATION].includes(input.observationState)) {
      decide("REFUSED", "CONTRACT_MISMATCH");
    }

    const destination = validateDestination(input.destination);
    validateProvenance(input.provenance, destination, nowMs, input.observationState);
    if (input.observationState === PENDING_OBSERVATION) {
      return result("PENDING_LIVE_OBSERVATION", "LIVE_OBSERVATION_REQUIRED", {
        destination,
        provenance: input.provenance,
      });
    }

    validatePrincipal(input.principal);
    validateRoleAttributes(input.roleAttributes);
    validateMemberships(input.memberships);
    validateDatabasePrivileges(input.databasePrivileges);
    validateSchemaPrivileges(input.schemaPrivileges, destination.schemaIdentity);
    validateObjectPrivileges(input.objectPrivileges);
    validateFunctionPrivileges(input.functionPrivileges);
    validateDefaultPrivileges(input.defaultPrivileges);

    const privilegeModel = {
      principal: input.principal,
      roleAttributes: input.roleAttributes,
      memberships: input.memberships,
      databasePrivileges: input.databasePrivileges,
      schemaPrivileges: input.schemaPrivileges,
      objectPrivileges: input.objectPrivileges,
      functionPrivileges: input.functionPrivileges,
      defaultPrivileges: input.defaultPrivileges,
    };
    const privilegeDigest = calculateSyntheticPrincipalPrivilegeDigest(privilegeModel);
    validateConnectionEvidence(input.connectionEvidence, {
      generation: input.provenance.observationGeneration,
      effectiveRole: input.principal.effectiveRole,
      privilegeDigest,
      migrationInventoryDigest: destination.migrationInventoryDigest,
    });

    return result("ELIGIBLE_FOR_HUMAN_REVIEW", "SYNTHETIC_POLICY_SATISFIED", {
      destination,
      provenance: input.provenance,
      principal: input.principal,
      privilegeDigest,
      membershipCount: input.memberships.length,
    });
  } catch (error) {
    if (error instanceof EvidenceDecision) {
      return result(error.state, error.code);
    }
    return result("REFUSED", "UNSAFE_EVIDENCE_SHAPE");
  }
}

function validateDestination(value) {
  assertExactKeys(value, [
    "repository", "targetIdentity", "databaseName", "context", "runId",
    "runAttempt", "schemaIdentity", "ownershipMarker", "migrationInventory",
    "migrationInventoryDigest", "reviewedCommit",
  ]);
  const expected = {
    repository: APPROVED_CONTEXT_B_REPOSITORY,
    targetIdentity: APPROVED_CONTEXT_B_TARGET_IDENTITY,
    databaseName: APPROVED_CONTEXT_B_DATABASE_NAME,
    context: CONTEXT_B,
  };
  for (const [key, expectedValue] of Object.entries(expected)) {
    assertExact(value[key], expectedValue, "DESTINATION_BINDING_MISMATCH");
  }
  if (!SAFE_DECIMAL.test(value.runId) || !SAFE_DECIMAL.test(value.runAttempt)) {
    decide("REFUSED", "DESTINATION_BINDING_MISMATCH");
  }
  const identity = {
    context: value.context,
    repository: value.repository,
    runId: value.runId,
    runAttempt: value.runAttempt,
    targetIdentity: value.targetIdentity,
    databaseName: value.databaseName,
  };
  let expectedSchema;
  let expectedMarker;
  try {
    expectedSchema = deriveContextBSchemaIdentity(identity);
    const capability = createContextBOfflineCapability();
    expectedMarker = capability.issueOfflineOwnershipEvidence({
      ...identity,
      schemaIdentity: expectedSchema,
    }).ownershipMarker;
  } catch {
    decide("REFUSED", "DESTINATION_BINDING_MISMATCH");
  }
  if (value.schemaIdentity !== expectedSchema || value.ownershipMarker !== expectedMarker) {
    decide("REFUSED", "DESTINATION_BINDING_MISMATCH");
  }
  if (!COMMIT.test(value.reviewedCommit)
    || value.reviewedCommit !== PHASE_D_PRINCIPAL_REVIEWED_COMMIT) {
    decide("REFUSED", "DESTINATION_BINDING_MISMATCH");
  }
  validateMigrationInventory(value.migrationInventory);
  if (value.migrationInventoryDigest !== PHASE_D_REVIEWED_MIGRATION_INVENTORY_DIGEST) {
    decide("REFUSED", "MIGRATION_INVENTORY_MISMATCH");
  }
  return deepFreeze({
    repository: value.repository,
    targetIdentity: value.targetIdentity,
    databaseName: value.databaseName,
    context: value.context,
    runId: value.runId,
    runAttempt: value.runAttempt,
    schemaIdentity: value.schemaIdentity,
    ownershipMarker: value.ownershipMarker,
    migrationInventoryDigest: value.migrationInventoryDigest,
    migrationCount: value.migrationInventory.length,
    reviewedCommit: value.reviewedCommit,
  });
}

function validateMigrationInventory(entries) {
  if (!Array.isArray(entries)
    || entries.length !== PHASE_D_REVIEWED_MIGRATION_INVENTORY.length) {
    decide("REFUSED", "MIGRATION_INVENTORY_MISMATCH");
  }
  entries.forEach((entry, index) => {
    assertExactKeys(entry, ["name", "checksum"]);
    const expected = PHASE_D_REVIEWED_MIGRATION_INVENTORY[index];
    if (entry.name !== expected.name || entry.checksum !== expected.checksum) {
      decide("REFUSED", "MIGRATION_INVENTORY_MISMATCH");
    }
  });
}

function validateProvenance(value, destination, nowMs, observationState) {
  assertExactKeys(value, [
    "source", "collectorVersion", "reviewedCommit", "observationGeneration",
    "observedAtMs", "expiresAtMs", "catalogCoverageComplete",
    "roleCoverageComplete", "membershipCoverageComplete",
    "databasePrivilegeCoverageComplete", "schemaPrivilegeCoverageComplete",
    "objectPrivilegeCoverageComplete", "functionPrivilegeCoverageComplete",
    "defaultPrivilegeCoverageComplete", "inventoryOverflow",
  ]);
  if (value.source !== SYNTHETIC_SOURCE
    || value.collectorVersion !== PHASE_D_PRINCIPAL_COLLECTOR_VERSION
    || value.reviewedCommit !== destination.reviewedCommit) {
    decide("REFUSED", "CONNECTED_SOURCE_SPOOFED");
  }
  if (!SAFE_DECIMAL.test(value.observationGeneration)
    || !Number.isSafeInteger(value.observedAtMs)
    || !Number.isSafeInteger(value.expiresAtMs)
    || value.observedAtMs < 0 || value.expiresAtMs <= value.observedAtMs) {
    decide("UNVERIFIED", "REQUIRED_FIELD_MISSING");
  }
  const coverageFields = [
    "catalogCoverageComplete", "roleCoverageComplete", "membershipCoverageComplete",
    "databasePrivilegeCoverageComplete", "schemaPrivilegeCoverageComplete",
    "objectPrivilegeCoverageComplete", "functionPrivilegeCoverageComplete",
    "defaultPrivilegeCoverageComplete",
  ];
  if (observationState === COMPLETE_OBSERVATION
    && (coverageFields.some((key) => value[key] !== true)
      || value.inventoryOverflow !== false)) {
    decide("UNVERIFIED", "CATALOG_EVIDENCE_INCOMPLETE");
  }
  if (value.observedAtMs > nowMs
    || nowMs >= value.expiresAtMs
    || value.expiresAtMs - value.observedAtMs > PHASE_D_PRINCIPAL_MAX_AGE_MS) {
    decide("UNVERIFIED", "EVIDENCE_STALE");
  }
}

function validatePrincipal(value) {
  assertExactKeys(value, [
    "transportClass", "principalClass", "roleExists", "sessionUser",
    "currentUser", "effectiveRole", "expectedSessionUser",
    "expectedEffectiveRole", "roleTransition",
  ]);
  if (value.transportClass === "DAILY_GOAL_OBSERVER_DATABASE_URL"
    || value.principalClass === "FUTURE_REVIEWED_PHASE_D_MUTATION_PRINCIPAL"
    || value.transportClass !== ALLOWED_TRANSPORT
    || value.principalClass !== CANDIDATE_CLASS) {
    decide("REFUSED", "PRINCIPAL_CLASS_PROHIBITED");
  }
  for (const field of [
    "sessionUser", "currentUser", "effectiveRole",
    "expectedSessionUser", "expectedEffectiveRole",
  ]) {
    if (typeof value[field] !== "string" || !SAFE_ROLE.test(value[field])) {
      decide("UNVERIFIED", "REQUIRED_FIELD_MISSING");
    }
  }
  if (value.roleExists !== true
    || value.sessionUser !== value.expectedSessionUser
    || value.effectiveRole !== value.expectedEffectiveRole
    || value.currentUser !== value.effectiveRole) {
    decide("REFUSED", "PRINCIPAL_BINDING_MISMATCH");
  }
  if (value.sessionUser !== value.currentUser || value.roleTransition !== "NONE") {
    decide("UNVERIFIED", "ROLE_TRANSITION_UNREVIEWED");
  }
}

function validateRoleAttributes(value) {
  assertExactKeys(value, [
    "login", "inherit", "superuser", "createRole", "createDb", "replication",
    "bypassRls",
  ]);
  assertBooleanFields(value);
  if (value.login !== true) decide("UNVERIFIED", "PRINCIPAL_BINDING_MISMATCH");
  if (value.superuser || value.createRole || value.createDb
    || value.replication || value.bypassRls) {
    decide("REFUSED", "DANGEROUS_ROLE_ATTRIBUTE");
  }
}

function validateMemberships(entries) {
  if (!Array.isArray(entries) || entries.length > 128) {
    decide("UNVERIFIED", "CATALOG_EVIDENCE_INCOMPLETE");
  }
  let previous = "";
  for (const entry of entries) {
    assertExactKeys(entry, [
      "role", "source", "inherited", "setRoleAllowed", "adminOption", "dangerous",
    ]);
    if (!SAFE_ROLE.test(entry.role)
      || !["DIRECT", "INHERITED", "PUBLIC"].includes(entry.source)
      || typeof entry.inherited !== "boolean"
      || typeof entry.setRoleAllowed !== "boolean"
      || typeof entry.adminOption !== "boolean"
      || typeof entry.dangerous !== "boolean") {
      decide("UNVERIFIED", "CATALOG_EVIDENCE_INCOMPLETE");
    }
    if (entry.role <= previous) decide("UNVERIFIED", "CATALOG_EVIDENCE_INCOMPLETE");
    previous = entry.role;
    if (entry.dangerous || entry.adminOption || entry.setRoleAllowed) {
      decide("REFUSED", "DANGEROUS_MEMBERSHIP_PATH");
    }
  }
}

function validateDatabasePrivileges(value) {
  assertExactKeys(value, [
    "coverageComplete", "connect", "owner", "create", "temporary",
    "publicTemporary",
  ]);
  assertBooleanFields(value);
  if (!value.coverageComplete) decide("UNVERIFIED", "CATALOG_EVIDENCE_INCOMPLETE");
  if (!value.connect) decide("UNVERIFIED", "DATABASE_AUTHORITY_PROHIBITED");
  if (value.owner || value.create || value.temporary || value.publicTemporary) {
    decide("REFUSED", "DATABASE_AUTHORITY_PROHIBITED");
  }
}

function validateSchemaPrivileges(value, schemaIdentity) {
  assertExactKeys(value, [
    "coverageComplete", "target", "public", "system", "foreign", "searchPath",
    "urlSchema",
  ]);
  if (value.coverageComplete !== true) {
    decide("UNVERIFIED", "CATALOG_EVIDENCE_INCOMPLETE");
  }
  for (const key of ["target", "public"]) {
    assertExactKeys(value[key], ["name", "owner", "usage", "create", "mutation"]);
    assertBooleanFields(value[key], ["owner", "usage", "create", "mutation"]);
  }
  for (const key of ["system", "foreign"]) {
    assertExactKeys(value[key], ["ownedCount", "createCount", "mutationCount"]);
    assertNonnegativeCounts(value[key]);
  }
  if (value.target.name !== schemaIdentity || value.target.owner !== true
    || value.target.usage !== true || value.target.create !== true
    || value.target.mutation !== true) {
    decide("UNVERIFIED", "OUTSIDE_SCHEMA_AUTHORITY_PROHIBITED");
  }
  if (value.public.name !== "public" || value.public.owner || value.public.create
    || value.public.mutation || value.system.ownedCount || value.system.createCount
    || value.system.mutationCount || value.foreign.ownedCount
    || value.foreign.createCount || value.foreign.mutationCount) {
    decide("REFUSED", "OUTSIDE_SCHEMA_AUTHORITY_PROHIBITED");
  }
  if (!Array.isArray(value.searchPath)
    || value.searchPath.length !== 2
    || value.searchPath[0] !== schemaIdentity
    || value.searchPath[1] !== "pg_catalog"
    || value.urlSchema !== schemaIdentity) {
    decide("REFUSED", "DESTINATION_BINDING_MISMATCH");
  }
}

function validateObjectPrivileges(value) {
  assertExactKeys(value, [
    "coverageComplete", "inventoryOverflow", "targetOwnedObjectCount",
    "targetMutationGrantCount", "outsideTableMutationCount",
    "outsideSequenceMutationCount", "outsideOwnershipCount",
    "publicMutationGrantCount", "inheritedMutationGrantCount",
  ]);
  assertBooleanFields(value, ["coverageComplete", "inventoryOverflow"]);
  assertNonnegativeCounts(value, [
    "targetOwnedObjectCount", "targetMutationGrantCount",
    "outsideTableMutationCount", "outsideSequenceMutationCount",
    "outsideOwnershipCount", "publicMutationGrantCount", "inheritedMutationGrantCount",
  ]);
  if (!value.coverageComplete || value.inventoryOverflow) {
    decide("UNVERIFIED", "CATALOG_EVIDENCE_INCOMPLETE");
  }
  if (value.outsideTableMutationCount || value.outsideSequenceMutationCount
    || value.outsideOwnershipCount || value.publicMutationGrantCount
    || value.inheritedMutationGrantCount) {
    decide("REFUSED", "OUTSIDE_OBJECT_AUTHORITY_PROHIBITED");
  }
}

function validateFunctionPrivileges(value) {
  assertExactKeys(value, [
    "coverageComplete", "inventoryOverflow", "executableSecurityDefinerCount",
    "ambiguousExecutableNonSystemCount", "unreviewedExecutableCount",
  ]);
  assertBooleanFields(value, ["coverageComplete", "inventoryOverflow"]);
  assertNonnegativeCounts(value, [
    "executableSecurityDefinerCount", "ambiguousExecutableNonSystemCount",
    "unreviewedExecutableCount",
  ]);
  if (!value.coverageComplete || value.inventoryOverflow) {
    decide("UNVERIFIED", "CATALOG_EVIDENCE_INCOMPLETE");
  }
  if (value.executableSecurityDefinerCount
    || value.ambiguousExecutableNonSystemCount
    || value.unreviewedExecutableCount) {
    decide("REFUSED", "FUNCTION_AUTHORITY_UNVERIFIED");
  }
}

function validateDefaultPrivileges(value) {
  assertExactKeys(value, [
    "coverageComplete", "inventoryOverflow", "outsideTargetMutationGrantCount",
    "publicMutationGrantCount", "inheritedMutationGrantCount",
    "unreviewedEntryCount",
  ]);
  assertBooleanFields(value, ["coverageComplete", "inventoryOverflow"]);
  assertNonnegativeCounts(value, [
    "outsideTargetMutationGrantCount", "publicMutationGrantCount",
    "inheritedMutationGrantCount", "unreviewedEntryCount",
  ]);
  if (!value.coverageComplete || value.inventoryOverflow) {
    decide("UNVERIFIED", "CATALOG_EVIDENCE_INCOMPLETE");
  }
  if (value.outsideTargetMutationGrantCount || value.publicMutationGrantCount
    || value.inheritedMutationGrantCount || value.unreviewedEntryCount) {
    decide("REFUSED", "DEFAULT_PRIVILEGE_AUTHORITY_PROHIBITED");
  }
}

function validateConnectionEvidence(value, expected) {
  assertExactKeys(value, ["preflight", "mutation", "cleanup"]);
  for (const phase of ["preflight", "mutation", "cleanup"]) {
    const evidence = value[phase];
    assertExactKeys(evidence, [
      "connectionIdentityDigest", "observationGeneration", "effectiveRole",
      "privilegeDigest", "migrationInventoryDigest",
    ]);
    if (!SHA256.test(evidence.connectionIdentityDigest)
      || !SHA256.test(evidence.privilegeDigest)
      || !SHA256.test(evidence.migrationInventoryDigest)) {
      decide("UNVERIFIED", "REQUIRED_FIELD_MISSING");
    }
    if (evidence.observationGeneration !== expected.generation) {
      decide("REFUSED", "OBSERVATION_GENERATION_MISMATCH");
    }
    if (evidence.effectiveRole !== expected.effectiveRole) {
      decide("REFUSED", "PRINCIPAL_BINDING_MISMATCH");
    }
    if (evidence.privilegeDigest !== expected.privilegeDigest) {
      decide("REFUSED", "PRIVILEGE_DIGEST_MISMATCH");
    }
    if (evidence.migrationInventoryDigest !== expected.migrationInventoryDigest) {
      decide("REFUSED", "MIGRATION_INVENTORY_MISMATCH");
    }
  }
  if (value.preflight.connectionIdentityDigest
    !== value.mutation.connectionIdentityDigest
    || value.mutation.connectionIdentityDigest
    !== value.cleanup.connectionIdentityDigest) {
    decide("REFUSED", "CONNECTION_BINDING_MISMATCH");
  }
}

function result(stateKey, reasonKey, details = {}) {
  const state = PHASE_D_PRINCIPAL_STATES[stateKey];
  const reasonCode = PHASE_D_PRINCIPAL_REASON_CODES[reasonKey];
  const summary = {};
  if (details.destination && details.provenance) {
    Object.assign(summary, {
      repository: details.destination.repository,
      targetIdentity: details.destination.targetIdentity,
      databaseName: details.destination.databaseName,
      context: details.destination.context,
      runId: details.destination.runId,
      runAttempt: details.destination.runAttempt,
      schemaIdentity: details.destination.schemaIdentity,
      reviewedCommit: details.destination.reviewedCommit,
      migrationInventoryDigest: details.destination.migrationInventoryDigest,
      migrationCount: details.destination.migrationCount,
      observationGeneration: details.provenance.observationGeneration,
      observedAtMs: details.provenance.observedAtMs,
      expiresAtMs: details.provenance.expiresAtMs,
    });
  }
  if (details.principal) {
    Object.assign(summary, {
      principalClass: details.principal.principalClass,
      transportClass: details.principal.transportClass,
      sessionUser: details.principal.sessionUser,
      effectiveRole: details.principal.effectiveRole,
      privilegeDigest: details.privilegeDigest,
      membershipCount: details.membershipCount,
    });
  }
  return deepFreeze({
    contractVersion: PHASE_D_PRINCIPAL_EVIDENCE_CONTRACT,
    state: state ?? PHASE_D_PRINCIPAL_STATES.REFUSED,
    reasonCode: reasonCode ?? PHASE_D_PRINCIPAL_REASON_CODES.UNSAFE_EVIDENCE_SHAPE,
    evidenceClass: PHASE_D_PRINCIPAL_EVIDENCE_CLASS,
    evidenceAuthority: "NON_LIVE_NON_AUTHORIZING",
    ...AUTHORIZATION_FALSE,
    summary,
  });
}

function assertExactKeys(value, expectedKeys) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    decide("UNVERIFIED", "REQUIRED_FIELD_MISSING");
  }
  const actual = Object.keys(value);
  const missing = expectedKeys.some((key) => !Object.hasOwn(value, key));
  if (missing) decide("UNVERIFIED", "REQUIRED_FIELD_MISSING");
  if (actual.length !== expectedKeys.length
    || actual.some((key) => !expectedKeys.includes(key))) {
    decide("REFUSED", "UNEXPECTED_FIELD");
  }
}

function assertBooleanFields(value, fields = Object.keys(value)) {
  if (fields.some((key) => typeof value[key] !== "boolean")) {
    decide("UNVERIFIED", "REQUIRED_FIELD_MISSING");
  }
}

function assertNonnegativeCounts(value, fields = Object.keys(value)) {
  if (fields.some((key) => !Number.isSafeInteger(value[key]) || value[key] < 0)) {
    decide("UNVERIFIED", "CATALOG_EVIDENCE_INCOMPLETE");
  }
}

function assertExact(actual, expected, code) {
  if (actual !== expected) decide("REFUSED", code);
}

function assertSafePlainData(value) {
  const seen = new Set();
  const visit = (candidate) => {
    if (!candidate || typeof candidate !== "object" || seen.has(candidate)) {
      decide("REFUSED", "UNSAFE_EVIDENCE_SHAPE");
    }
    const prototype = Object.getPrototypeOf(candidate);
    if (Array.isArray(candidate)) {
      if (prototype !== Array.prototype) decide("REFUSED", "UNSAFE_EVIDENCE_SHAPE");
    } else if (![Object.prototype, null].includes(prototype)) {
      decide("REFUSED", "UNSAFE_EVIDENCE_SHAPE");
    }
    seen.add(candidate);
    for (const descriptor of Object.values(Object.getOwnPropertyDescriptors(candidate))) {
      if (typeof descriptor.get === "function" || typeof descriptor.set === "function"
        || typeof descriptor.value === "function") {
        decide("REFUSED", "UNSAFE_EVIDENCE_SHAPE");
      }
      if (descriptor.value && typeof descriptor.value === "object") visit(descriptor.value);
    }
  };
  visit(value);
}

function refuseSensitiveOrAuthorizationClaims(value) {
  const visit = (candidate) => {
    if (!candidate || typeof candidate !== "object") return;
    for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(candidate))) {
      if (FORGED_AUTHORIZATION_KEY.test(key)) {
        decide("REFUSED", "FORGED_AUTHORIZATION_CLAIM");
      }
      if (SENSITIVE_KEY.test(key)) decide("REFUSED", "SENSITIVE_INPUT_PROHIBITED");
      if (descriptor.value && typeof descriptor.value === "object") visit(descriptor.value);
    }
  };
  visit(value);
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (!value || typeof value !== "object") return JSON.stringify(value);
  return `{${Object.keys(value).sort().map((key) =>
    `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function migration(name, checksum) {
  return Object.freeze({ name, checksum });
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function decide(state, code) {
  throw new EvidenceDecision(
    PHASE_D_PRINCIPAL_STATES[state],
    PHASE_D_PRINCIPAL_REASON_CODES[code],
  );
}

class EvidenceDecision extends Error {
  constructor(state, code) {
    super(code);
    this.state = state;
    this.code = code;
  }
}
