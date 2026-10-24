import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  APPROVED_CONTEXT_B_DATABASE_NAME,
  APPROVED_CONTEXT_B_REPOSITORY,
  APPROVED_CONTEXT_B_TARGET_IDENTITY,
  createContextBOfflineCapability,
  deriveContextBSchemaIdentity,
} from "./daily-goal-context-b-capability.js";
import { DAILY_GOAL_HISTORY_CONTEXTS } from "./daily-goal-ci-contract.js";
import {
  calculateSyntheticPrincipalPrivilegeDigest,
  PHASE_D_PRINCIPAL_COLLECTOR_VERSION,
  PHASE_D_PRINCIPAL_EVIDENCE_CLASS,
  PHASE_D_PRINCIPAL_EVIDENCE_CONTRACT,
  PHASE_D_PRINCIPAL_REVIEWED_COMMIT,
  PHASE_D_REVIEWED_MIGRATION_INVENTORY,
  PHASE_D_REVIEWED_MIGRATION_INVENTORY_DIGEST,
} from "./daily-goal-phase-d-principal-evidence.js";
import {
  createWriterPrincipalObservationOfflineHarness,
  WRITER_PRINCIPAL_CANDIDATE_TRANSPORT,
  WRITER_PRINCIPAL_CATALOG_INVENTORY,
  WRITER_PRINCIPAL_OBSERVATION_EVIDENCE_CLASS,
  WRITER_PRINCIPAL_OBSERVATION_OPERATION,
} from "./daily-goal-writer-principal-observation-offline.js";

const NOW = 2_000_000;
const SESSION = "a".repeat(64);
const OTHER_SESSION = "b".repeat(64);
const ROLE = "elvocab_daily_goal_phase_d_candidate";
const STEPS = [
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
];
const MODULE_PATH = fileURLToPath(new URL(
  "./daily-goal-writer-principal-observation-offline.js",
  import.meta.url,
));
const PHASE_B_PATH = fileURLToPath(new URL("./daily-goal-prisma-read-only-binding.js", import.meta.url));
const CONTEXT_B_PATH = fileURLToPath(new URL("./daily-goal-context-b-capability.js", import.meta.url));
const PHASE_D_PATH = fileURLToPath(new URL("./daily-goal-phase-d-offline.js", import.meta.url));
const WORKFLOW_PATH = fileURLToPath(new URL("../../../.github/workflows/ci-integration.yml", import.meta.url));
const DRAFT_PATH = fileURLToPath(new URL(
  "../../prisma/migration-drafts/daily-goal-v1/20261022000000_add_daily_goal_v1/migration.sql",
  import.meta.url,
));
const ACTIVE_PATH = fileURLToPath(new URL(
  "../../prisma/migrations/20261022000000_add_daily_goal_v1/migration.sql",
  import.meta.url,
));

function createEvidence() {
  const identity = {
    context: DAILY_GOAL_HISTORY_CONTEXTS.RUN_OWNED_SCHEMA,
    repository: APPROVED_CONTEXT_B_REPOSITORY,
    runId: "40059971757",
    runAttempt: "1",
    targetIdentity: APPROVED_CONTEXT_B_TARGET_IDENTITY,
    databaseName: APPROVED_CONTEXT_B_DATABASE_NAME,
  };
  const schemaIdentity = deriveContextBSchemaIdentity(identity);
  const ownershipMarker = createContextBOfflineCapability()
    .issueOfflineOwnershipEvidence({ ...identity, schemaIdentity }).ownershipMarker;
  const evidence = {
    contractVersion: PHASE_D_PRINCIPAL_EVIDENCE_CONTRACT,
    evidenceClass: PHASE_D_PRINCIPAL_EVIDENCE_CLASS,
    observationState: "SYNTHETIC_COMPLETE",
    provenance: {
      source: "SYNTHETIC_MODELED_OBSERVATION",
      collectorVersion: PHASE_D_PRINCIPAL_COLLECTOR_VERSION,
      reviewedCommit: PHASE_D_PRINCIPAL_REVIEWED_COMMIT,
      observationGeneration: "7",
      observedAtMs: NOW - 1_000,
      expiresAtMs: NOW + 60_000,
      catalogCoverageComplete: true,
      roleCoverageComplete: true,
      membershipCoverageComplete: true,
      databasePrivilegeCoverageComplete: true,
      schemaPrivilegeCoverageComplete: true,
      objectPrivilegeCoverageComplete: true,
      functionPrivilegeCoverageComplete: true,
      defaultPrivilegeCoverageComplete: true,
      inventoryOverflow: false,
    },
    destination: {
      ...identity,
      schemaIdentity,
      ownershipMarker,
      migrationInventory: PHASE_D_REVIEWED_MIGRATION_INVENTORY.map((entry) => ({ ...entry })),
      migrationInventoryDigest: PHASE_D_REVIEWED_MIGRATION_INVENTORY_DIGEST,
      reviewedCommit: PHASE_D_PRINCIPAL_REVIEWED_COMMIT,
    },
    principal: {
      transportClass: WRITER_PRINCIPAL_CANDIDATE_TRANSPORT,
      principalClass: "CI_WRITER_CANDIDATE_UNVERIFIED",
      roleExists: true,
      sessionUser: ROLE,
      currentUser: ROLE,
      effectiveRole: ROLE,
      expectedSessionUser: ROLE,
      expectedEffectiveRole: ROLE,
      roleTransition: "NONE",
    },
    roleAttributes: {
      login: true,
      inherit: false,
      superuser: false,
      createRole: false,
      createDb: false,
      replication: false,
      bypassRls: false,
    },
    memberships: [],
    databasePrivileges: {
      coverageComplete: true,
      connect: true,
      owner: false,
      create: false,
      temporary: false,
      publicTemporary: false,
    },
    schemaPrivileges: {
      coverageComplete: true,
      target: { name: schemaIdentity, owner: true, usage: true, create: true, mutation: true },
      public: { name: "public", owner: false, usage: true, create: false, mutation: false },
      system: { ownedCount: 0, createCount: 0, mutationCount: 0 },
      foreign: { ownedCount: 0, createCount: 0, mutationCount: 0 },
      searchPath: [schemaIdentity, "pg_catalog"],
      urlSchema: schemaIdentity,
    },
    objectPrivileges: {
      coverageComplete: true,
      inventoryOverflow: false,
      targetOwnedObjectCount: 0,
      targetMutationGrantCount: 0,
      outsideTableMutationCount: 0,
      outsideSequenceMutationCount: 0,
      outsideOwnershipCount: 0,
      publicMutationGrantCount: 0,
      inheritedMutationGrantCount: 0,
    },
    functionPrivileges: {
      coverageComplete: true,
      inventoryOverflow: false,
      executableSecurityDefinerCount: 0,
      ambiguousExecutableNonSystemCount: 0,
      unreviewedExecutableCount: 0,
    },
    defaultPrivileges: {
      coverageComplete: true,
      inventoryOverflow: false,
      outsideTargetMutationGrantCount: 0,
      publicMutationGrantCount: 0,
      inheritedMutationGrantCount: 0,
      unreviewedEntryCount: 0,
    },
    connectionEvidence: null,
  };
  refreshConnectionEvidence(evidence);
  return evidence;
}

function refreshConnectionEvidence(evidence, session = SESSION) {
  const privilegeDigest = calculateSyntheticPrincipalPrivilegeDigest({
    principal: evidence.principal,
    roleAttributes: evidence.roleAttributes,
    memberships: evidence.memberships,
    databasePrivileges: evidence.databasePrivileges,
    schemaPrivileges: evidence.schemaPrivileges,
    objectPrivileges: evidence.objectPrivileges,
    functionPrivileges: evidence.functionPrivileges,
    defaultPrivileges: evidence.defaultPrivileges,
  });
  const bound = {
    connectionIdentityDigest: session,
    observationGeneration: evidence.provenance.observationGeneration,
    effectiveRole: evidence.principal.effectiveRole,
    privilegeDigest,
    migrationInventoryDigest: evidence.destination.migrationInventoryDigest,
  };
  evidence.connectionEvidence = {
    preflight: { ...bound },
    mutation: { ...bound },
    cleanup: { ...bound },
  };
}

function createLifecycle({ session = SESSION, generation = "7" } = {}) {
  return STEPS.map((step, index) => ({
    step,
    sessionDigest: session,
    observationGeneration: generation,
    transactionReadOnly: index >= STEPS.indexOf("VERIFY_TRANSACTION_READ_ONLY"),
  }));
}

function createObservationMetadata(evidence, {
  session = SESSION,
  generation = "7",
} = {}) {
  return {
    targetIdentity: evidence.destination.targetIdentity,
    databaseName: evidence.destination.databaseName,
    serverVersion: "PostgreSQL 15.8 synthetic fixture",
    sessionUser: evidence.principal.sessionUser,
    currentUser: evidence.principal.currentUser,
    effectiveRole: evidence.principal.effectiveRole,
    sessionDigest: session,
    observationGeneration: generation,
  };
}

function createRun(overrides = {}) {
  const harness = createWriterPrincipalObservationOfflineHarness();
  const authorization = harness.issueObservationAuthorization({
    operation: WRITER_PRINCIPAL_OBSERVATION_OPERATION,
    transportClass: WRITER_PRINCIPAL_CANDIDATE_TRANSPORT,
  });
  const evidence = overrides.evidence ?? createEvidence();
  const modeled = {
    evidence,
    lifecycle: createLifecycle(),
    observationMetadata: createObservationMetadata(evidence),
    rollbackSucceeded: true,
    disconnectSucceeded: true,
    ...overrides,
  };
  const transport = harness.issueSyntheticTransport(modeled);
  return { harness, authorization, transport, modeled };
}

function observe(run, nowMs = NOW) {
  return run.harness.observe({
    authorization: run.authorization,
    transport: run.transport,
    nowMs,
  });
}

function assertNonAuthorizing(result) {
  assert.equal(result.evidenceClass, WRITER_PRINCIPAL_OBSERVATION_EVIDENCE_CLASS);
  assert.equal(result.evidenceAuthority, "NON_LIVE_NON_AUTHORIZING");
  assert.equal(result.principalApproved, false);
  assert.equal(result.connectionAuthorized, false);
  assert.equal(result.executionAuthorized, false);
  assert.equal(result.mutationReady, false);
  assert.equal(result.livePrincipalVerified, false);
}

test("complete synthetic writer observation is only eligible for HUMAN review", () => {
  const result = observe(createRun());
  assert.equal(result.candidateClassification, "ELIGIBLE_FOR_HUMAN_REVIEW");
  assert.equal(result.reasonCode, "SYNTHETIC_POLICY_SATISFIED");
  assert.equal(result.coverageStatus, "COMPLETE");
  assert.equal(result.summary.transportClass, WRITER_PRINCIPAL_CANDIDATE_TRANSPORT);
  assert.equal(result.summary.runId, "40059971757");
  assertNonAuthorizing(result);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.summary), true);
});

test("observation operation is separate and rejects Phase B, mutation and forged authorization", () => {
  for (const candidate of [
    { operation: "observation", transportClass: WRITER_PRINCIPAL_CANDIDATE_TRANSPORT },
    { operation: "migration", transportClass: WRITER_PRINCIPAL_CANDIDATE_TRANSPORT },
    { operation: WRITER_PRINCIPAL_OBSERVATION_OPERATION, transportClass: "DAILY_GOAL_OBSERVER_DATABASE_URL" },
    { operation: WRITER_PRINCIPAL_OBSERVATION_OPERATION, transportClass: "DATABASE_URL" },
    { operation: WRITER_PRINCIPAL_OBSERVATION_OPERATION, transportClass: "TEST_DATABASE_URL" },
    { operation: WRITER_PRINCIPAL_OBSERVATION_OPERATION, transportClass: WRITER_PRINCIPAL_CANDIDATE_TRANSPORT, authorized: true },
  ]) {
    const harness = createWriterPrincipalObservationOfflineHarness();
    assert.throws(() => harness.issueObservationAuthorization(candidate));
  }
});

test("authorization and transport provenance are factory-local and single use", () => {
  const first = createRun();
  const second = createRun();
  const crossed = first.harness.observe({
    authorization: second.authorization,
    transport: first.transport,
    nowMs: NOW,
  });
  assert.equal(crossed.reasonCode, "OBSERVATION_AUTHORIZATION_UNTRUSTED");
  assertNonAuthorizing(crossed);

  const passed = observe(first);
  assert.equal(passed.candidateClassification, "ELIGIBLE_FOR_HUMAN_REVIEW");
  const replay = observe(first);
  assert.equal(replay.reasonCode, "SYNTHETIC_TRANSPORT_UNTRUSTED");
});

test("read-only must be verified before every catalog observation", () => {
  const missing = createLifecycle();
  missing[2].transactionReadOnly = false;
  assert.equal(observe(createRun({ lifecycle: missing })).reasonCode, "READ_ONLY_VERIFICATION_FAILED");

  const early = createLifecycle();
  early[1].transactionReadOnly = true;
  assert.equal(observe(createRun({ lifecycle: early })).reasonCode, "READ_ONLY_LIFECYCLE_INVALID");

  const reordered = createLifecycle();
  [reordered[2], reordered[3]] = [reordered[3], reordered[2]];
  assert.equal(observe(createRun({ lifecycle: reordered })).reasonCode, "LIFECYCLE_ORDER_INVALID");
});

test("changed connection, generation and classifier bindings fail closed", () => {
  const changed = createLifecycle();
  changed[8].sessionDigest = OTHER_SESSION;
  assert.equal(observe(createRun({ lifecycle: changed })).reasonCode,
    "CONNECTION_CHANGED_DURING_OBSERVATION");

  const generation = createLifecycle();
  generation[7].observationGeneration = "8";
  assert.equal(observe(createRun({ lifecycle: generation })).reasonCode,
    "OBSERVATION_GENERATION_DRIFT");

  const evidence = createEvidence();
  evidence.connectionEvidence.cleanup.connectionIdentityDigest = OTHER_SESSION;
  assert.equal(observe(createRun({ evidence })).reasonCode, "CONNECTION_BINDING_MISMATCH");
});

test("connected target, database, principal and server-version metadata are mandatory", () => {
  const evidence = createEvidence();
  for (const [field, value, code] of [
    ["targetIdentity", "other.invalid:5432/postgres", "CONNECTED_OBSERVATION_MISMATCH"],
    ["databaseName", "other", "CONNECTED_OBSERVATION_MISMATCH"],
    ["sessionUser", "another_role", "CONNECTED_OBSERVATION_MISMATCH"],
    ["currentUser", "another_role", "CONNECTED_OBSERVATION_MISMATCH"],
    ["effectiveRole", "another_role", "CONNECTED_OBSERVATION_MISMATCH"],
    ["serverVersion", "", "SERVER_VERSION_EVIDENCE_INVALID"],
  ]) {
    const observationMetadata = createObservationMetadata(evidence);
    observationMetadata[field] = value;
    assert.equal(observe(createRun({ evidence, observationMetadata })).reasonCode, code);
  }
});

test("wrong target, database, run, attempt and schema are refused by accepted classifier", () => {
  for (const mutate of [
    (e) => { e.destination.targetIdentity = "other.invalid:5432/postgres"; },
    (e) => { e.destination.databaseName = "other"; },
    (e) => { e.destination.runId = "2"; },
    (e) => { e.destination.runAttempt = "2"; },
    (e) => { e.destination.schemaIdentity = "public"; },
  ]) {
    const evidence = createEvidence();
    mutate(evidence);
    const result = observe(createRun({ evidence }));
    assert.equal(result.candidateClassification, "REFUSED");
    assertNonAuthorizing(result);
  }
});

test("session, current user, effective role and role transition mismatches are refused", () => {
  for (const mutate of [
    (e) => { e.principal.sessionUser = "another_role"; },
    (e) => { e.principal.currentUser = "another_role"; },
    (e) => { e.principal.effectiveRole = "another_role"; },
    (e) => { e.principal.roleTransition = "SET_ROLE"; },
  ]) {
    const evidence = createEvidence();
    mutate(evidence);
    refreshConnectionEvidence(evidence);
    const result = observe(createRun({ evidence }));
    assert.notEqual(result.candidateClassification, "ELIGIBLE_FOR_HUMAN_REVIEW");
    assertNonAuthorizing(result);
  }
});

test("dangerous role attributes and membership paths are refused", () => {
  for (const field of ["superuser", "createRole", "createDb", "replication", "bypassRls"]) {
    const evidence = createEvidence();
    evidence.roleAttributes[field] = true;
    refreshConnectionEvidence(evidence);
    assert.equal(observe(createRun({ evidence })).reasonCode, "DANGEROUS_ROLE_ATTRIBUTE");
  }

  const membership = createEvidence();
  membership.memberships = [{
    role: "writer_parent",
    source: "INHERITED",
    inherited: true,
    setRoleAllowed: true,
    adminOption: false,
    dangerous: false,
  }];
  refreshConnectionEvidence(membership);
  assert.equal(observe(createRun({ evidence: membership })).reasonCode,
    "DANGEROUS_MEMBERSHIP_PATH");
});

test("database ownership, CREATE and unapproved TEMPORARY paths are refused", () => {
  for (const field of ["owner", "create", "temporary", "publicTemporary"]) {
    const evidence = createEvidence();
    evidence.databasePrivileges[field] = true;
    refreshConnectionEvidence(evidence);
    assert.equal(observe(createRun({ evidence })).reasonCode,
      "DATABASE_AUTHORITY_PROHIBITED");
  }
});

test("public, foreign and outside-object mutation authority is refused", () => {
  const cases = [
    (e) => { e.schemaPrivileges.public.create = true; },
    (e) => { e.schemaPrivileges.foreign.mutationCount = 1; },
    (e) => { e.objectPrivileges.outsideTableMutationCount = 1; },
    (e) => { e.objectPrivileges.outsideSequenceMutationCount = 1; },
    (e) => { e.objectPrivileges.publicMutationGrantCount = 1; },
    (e) => { e.objectPrivileges.inheritedMutationGrantCount = 1; },
  ];
  for (const mutate of cases) {
    const evidence = createEvidence();
    mutate(evidence);
    refreshConnectionEvidence(evidence);
    const result = observe(createRun({ evidence }));
    assert.equal(result.candidateClassification, "REFUSED");
    assertNonAuthorizing(result);
  }
});

test("dangerous functions and default ACLs are refused", () => {
  for (const mutate of [
    (e) => { e.functionPrivileges.executableSecurityDefinerCount = 1; },
    (e) => { e.functionPrivileges.ambiguousExecutableNonSystemCount = 1; },
    (e) => { e.defaultPrivileges.publicMutationGrantCount = 1; },
    (e) => { e.defaultPrivileges.inheritedMutationGrantCount = 1; },
  ]) {
    const evidence = createEvidence();
    mutate(evidence);
    refreshConnectionEvidence(evidence);
    assert.equal(observe(createRun({ evidence })).candidateClassification, "REFUSED");
  }
});

test("every catalog category requires structural evidence and complete coverage", () => {
  assert.deepEqual(WRITER_PRINCIPAL_CATALOG_INVENTORY.map((item) => item.name), [
    "principal", "roleAttributes", "memberships", "databasePrivileges",
    "schemaPrivileges", "objectPrivileges", "functionPrivileges", "defaultPrivileges",
  ]);
  for (const category of WRITER_PRINCIPAL_CATALOG_INVENTORY) {
    assert.ok(category.fields.length > 0);
    assert.equal(category.incompleteCode, "CATALOG_EVIDENCE_INCOMPLETE");
  }

  for (const field of [
    "catalogCoverageComplete", "roleCoverageComplete", "membershipCoverageComplete",
    "databasePrivilegeCoverageComplete", "schemaPrivilegeCoverageComplete",
    "objectPrivilegeCoverageComplete", "functionPrivilegeCoverageComplete",
    "defaultPrivilegeCoverageComplete",
  ]) {
    const evidence = createEvidence();
    evidence.provenance[field] = false;
    const result = observe(createRun({ evidence }));
    assert.equal(result.candidateClassification, "UNVERIFIED");
    assert.equal(result.reasonCode, "CATALOG_EVIDENCE_INCOMPLETE");
  }
});

test("caller booleans, digests, sensitive fields, functions and custom prototypes cannot forge trust", () => {
  const harness = createWriterPrincipalObservationOfflineHarness();
  const evidence = createEvidence();
  evidence.principalApproved = true;
  assert.throws(() => harness.issueSyntheticTransport({
    evidence,
    lifecycle: createLifecycle(),
    observationMetadata: createObservationMetadata(createEvidence()),
    rollbackSucceeded: true,
    disconnectSucceeded: true,
  }));

  for (const unsafe of [
    { databaseUrl: "postgresql://secret.invalid/db" },
    { rawError: "password=secret" },
    { query: () => undefined },
  ]) {
    assert.throws(() => harness.issueSyntheticTransport({
      evidence: unsafe,
      lifecycle: createLifecycle(),
      observationMetadata: createObservationMetadata(createEvidence()),
      rollbackSucceeded: true,
      disconnectSucceeded: true,
    }));
  }

  const hostile = Object.create({ inherited: true });
  hostile.evidence = createEvidence();
  hostile.lifecycle = createLifecycle();
  hostile.observationMetadata = createObservationMetadata(hostile.evidence);
  hostile.rollbackSucceeded = true;
  hostile.disconnectSucceeded = true;
  assert.throws(() => harness.issueSyntheticTransport(hostile));
});

test("privilege digest drift is refused even when caller supplies a syntactically valid digest", () => {
  const evidence = createEvidence();
  evidence.connectionEvidence.mutation.privilegeDigest = "b".repeat(64);
  assert.equal(observe(createRun({ evidence })).reasonCode, "PRIVILEGE_DIGEST_MISMATCH");
});

test("rollback and disconnect failures are terminal and redacted", () => {
  const rollback = observe(createRun({ rollbackSucceeded: false }));
  assert.equal(rollback.reasonCode, "ROLLBACK_FAILED");
  assertNonAuthorizing(rollback);

  const disconnect = observe(createRun({ disconnectSucceeded: false }));
  assert.equal(disconnect.reasonCode, "DISCONNECT_FAILED");
  assertNonAuthorizing(disconnect);
  assert.doesNotMatch(JSON.stringify({ rollback, disconnect }), /postgresql:|password|secret/i);
});

test("all result shapes are allowlisted and always non-authorizing", () => {
  for (const result of [
    observe(createRun()),
    observe(createRun({ rollbackSucceeded: false })),
    createWriterPrincipalObservationOfflineHarness().observe({}),
  ]) {
    assert.deepEqual(Object.keys(result).sort(), [
      "candidateClassification", "connectionAuthorized", "contractVersion",
      "coverageStatus", "evidenceAuthority", "evidenceClass", "executionAuthorized",
      "livePrincipalVerified", "mutationReady", "principalApproved", "reasonCode", "summary",
    ].sort());
    assertNonAuthorizing(result);
    assert.doesNotMatch(JSON.stringify(result), /databaseUrl|password|token|rawError|connectionHandle/i);
  }
});

test("offline module has no environment, database, SQL, network or subprocess reachability", async () => {
  const source = await readFile(MODULE_PATH, "utf8");
  assert.doesNotMatch(source, /process\.env|PrismaClient|\$executeRaw|\$queryRaw|child_process|spawn\s*\(|exec\s*\(|fetch\s*\(|https?:\/\//);
  assert.doesNotMatch(source, /from\s+["'](?:pg|postgres|@prisma\/client)["']/);
  assert.doesNotMatch(source, /function\s*\([^)]*(?:query|execute|connection|databaseUrl)/i);
  assert.doesNotMatch(source, /DAILY_GOAL_OBSERVER_DATABASE_URL\s*\]/);
});

test("existing Phase B, Context B and Phase D modules remain independent", async () => {
  const [phaseB, contextB, phaseD] = await Promise.all([
    readFile(PHASE_B_PATH, "utf8"),
    readFile(CONTEXT_B_PATH, "utf8"),
    readFile(PHASE_D_PATH, "utf8"),
  ]);
  for (const source of [phaseB, contextB, phaseD]) {
    assert.doesNotMatch(source, /daily-goal-writer-principal-observation-offline/);
  }
  assert.match(contextB, /OBSERVER_MUTATION_PROHIBITED/);
  assert.match(phaseD, /FUTURE_REVIEWED_PHASE_D_MUTATION_PRINCIPAL/);
});

test("Phase D stays terminally disabled and Phase B stays dispatchable", async () => {
  const workflow = await readFile(WORKFLOW_PATH, "utf8");
  const phaseB = extractJob(workflow, "daily-goal-migration-observation");
  const phaseD = extractJob(workflow, "daily-goal-migration-verification");
  assert.doesNotMatch(phaseB.slice(phaseB.indexOf("    if:"), phaseB.indexOf("    runs-on:")),
    /&&\r?\n\s+false/);
  assert.match(phaseD.slice(phaseD.indexOf("    if:"), phaseD.indexOf("    runs-on:")),
    /&&\r?\n\s+false/);
  assert.doesNotMatch(workflow, /daily-goal-writer-principal-observation-offline/);
});

test("migration remains quarantined with exact bytes and no active copy", async () => {
  const draft = await readFile(DRAFT_PATH);
  const { createHash } = await import("node:crypto");
  assert.equal(createHash("sha256").update(draft).digest("hex"),
    "8e468739c3f60693e9ff53d1c3d4107124ac1feaa9d95ac3a665ea8b8c89edb6");
  await assert.rejects(stat(ACTIVE_PATH), (error) => error?.code === "ENOENT");
});

function extractJob(workflow, jobName) {
  const match = workflow.match(new RegExp(
    `^  ${jobName}:\\r?\\n[\\s\\S]*?(?=^  [a-z][a-z0-9-]+:|\\Z)`,
    "m",
  ));
  assert.ok(match, `Expected workflow job ${jobName}`);
  return match[0];
}
