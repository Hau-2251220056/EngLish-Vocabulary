import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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
  classifyPhaseDPrincipalEvidence,
  PHASE_D_PRINCIPAL_COLLECTOR_VERSION,
  PHASE_D_PRINCIPAL_EVIDENCE_CLASS,
  PHASE_D_PRINCIPAL_EVIDENCE_CONTRACT,
  PHASE_D_PRINCIPAL_REASON_CODES,
  PHASE_D_PRINCIPAL_REVIEWED_COMMIT,
  PHASE_D_PRINCIPAL_STATES,
  PHASE_D_REVIEWED_MIGRATION_INVENTORY,
  PHASE_D_REVIEWED_MIGRATION_INVENTORY_DIGEST,
} from "./daily-goal-phase-d-principal-evidence.js";

const NOW = 2_000_000;
const CONNECTION_DIGEST = "a".repeat(64);
const ROLE = "elvocab_daily_goal_phase_d_candidate";
const MODULE_PATH = fileURLToPath(new URL(
  "./daily-goal-phase-d-principal-evidence.js",
  import.meta.url,
));
const PHASE_D_PATH = fileURLToPath(new URL(
  "./daily-goal-phase-d-offline.js",
  import.meta.url,
));
const WORKFLOW_PATH = fileURLToPath(new URL(
  "../../../.github/workflows/ci-integration.yml",
  import.meta.url,
));
const MANIFEST_PATH = fileURLToPath(new URL(
  "../../prisma/migration-drafts/daily-goal-v1/manifest.json",
  import.meta.url,
));
const DRAFT_PATH = fileURLToPath(new URL(
  "../../prisma/migration-drafts/daily-goal-v1/20261022000000_add_daily_goal_v1/migration.sql",
  import.meta.url,
));
const ACTIVE_PATH = fileURLToPath(new URL(
  "../../prisma/migrations/20261022000000_add_daily_goal_v1/migration.sql",
  import.meta.url,
));

function createFixture(overrides = {}) {
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
  const base = {
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
      transportClass: "CI_TEST_DATABASE_URL",
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
      target: {
        name: schemaIdentity,
        owner: true,
        usage: true,
        create: true,
        mutation: true,
      },
      public: {
        name: "public",
        owner: false,
        usage: true,
        create: false,
        mutation: false,
      },
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
  Object.assign(base, overrides);
  refreshConnectionEvidence(base);
  return base;
}

function refreshConnectionEvidence(fixture) {
  const privilegeDigest = calculateSyntheticPrincipalPrivilegeDigest({
    principal: fixture.principal,
    roleAttributes: fixture.roleAttributes,
    memberships: fixture.memberships,
    databasePrivileges: fixture.databasePrivileges,
    schemaPrivileges: fixture.schemaPrivileges,
    objectPrivileges: fixture.objectPrivileges,
    functionPrivileges: fixture.functionPrivileges,
    defaultPrivileges: fixture.defaultPrivileges,
  });
  const evidence = {
    connectionIdentityDigest: CONNECTION_DIGEST,
    observationGeneration: fixture.provenance.observationGeneration,
    effectiveRole: fixture.principal.effectiveRole,
    privilegeDigest,
    migrationInventoryDigest: fixture.destination.migrationInventoryDigest,
  };
  fixture.connectionEvidence = {
    preflight: { ...evidence },
    mutation: { ...evidence },
    cleanup: { ...evidence },
  };
  return fixture;
}

function clone(value) {
  return structuredClone(value);
}

function classify(fixture, nowMs = NOW) {
  return classifyPhaseDPrincipalEvidence(fixture, { nowMs });
}

function assertState(result, state, reasonCode) {
  assert.equal(result.state, state);
  assert.equal(result.reasonCode, reasonCode);
  assertAuthorizationFalse(result);
}

function assertAuthorizationFalse(result) {
  assert.equal(result.principalApproved, false);
  assert.equal(result.connectionAuthorized, false);
  assert.equal(result.executionAuthorized, false);
  assert.equal(result.mutationReady, false);
  assert.equal(result.livePrincipalVerified, false);
  assert.equal(result.evidenceAuthority, "NON_LIVE_NON_AUTHORIZING");
}

test("complete safe synthetic evidence is only eligible for HUMAN review", () => {
  const result = classify(createFixture());
  assertState(
    result,
    PHASE_D_PRINCIPAL_STATES.ELIGIBLE_FOR_HUMAN_REVIEW,
    PHASE_D_PRINCIPAL_REASON_CODES.SYNTHETIC_POLICY_SATISFIED,
  );
  assert.equal(result.evidenceClass, "SYNTHETIC_ONLY");
  assert.equal(result.summary.migrationCount, 12);
  assert.equal(result.summary.membershipCount, 0);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.summary), true);
});

test("missing evidence and explicit no-observation state remain non-authorizing", () => {
  assertState(
    classifyPhaseDPrincipalEvidence(undefined, { nowMs: NOW }),
    PHASE_D_PRINCIPAL_STATES.UNVERIFIED,
    PHASE_D_PRINCIPAL_REASON_CODES.EVIDENCE_REQUIRED,
  );
  const fixture = createFixture();
  fixture.observationState = "NOT_OBSERVED";
  assertState(
    classify(fixture),
    PHASE_D_PRINCIPAL_STATES.PENDING_LIVE_OBSERVATION,
    PHASE_D_PRINCIPAL_REASON_CODES.LIVE_OBSERVATION_REQUIRED,
  );
});

test("wrong repository, target or database is refused with exact case semantics", () => {
  for (const [field, value] of [
    ["repository", APPROVED_CONTEXT_B_REPOSITORY.toLowerCase()],
    ["targetIdentity", APPROVED_CONTEXT_B_TARGET_IDENTITY.toUpperCase()],
    ["databaseName", "POSTGRES"],
    ["databaseName", "postgres "],
  ]) {
    const fixture = createFixture();
    fixture.destination[field] = value;
    assertState(classify(fixture), "REFUSED", "DESTINATION_BINDING_MISMATCH");
  }
});

test("wrong Context B run, attempt or schema binding is refused", () => {
  for (const mutate of [
    (fixture) => { fixture.destination.context = "EXISTING_TARGET"; },
    (fixture) => { fixture.destination.runId = "40059971758"; },
    (fixture) => { fixture.destination.runAttempt = "2"; },
    (fixture) => { fixture.destination.schemaIdentity = "public"; },
    (fixture) => { fixture.destination.ownershipMarker += "0"; },
  ]) {
    const fixture = createFixture();
    mutate(fixture);
    assertState(classify(fixture), "REFUSED", "DESTINATION_BINDING_MISMATCH");
  }
});

test("observer credential misuse and direct semantic promotion are refused", () => {
  const observer = createFixture();
  observer.principal.transportClass = "DAILY_GOAL_OBSERVER_DATABASE_URL";
  refreshConnectionEvidence(observer);
  assertState(classify(observer), "REFUSED", "PRINCIPAL_CLASS_PROHIBITED");

  const promoted = createFixture();
  promoted.principal.principalClass = "FUTURE_REVIEWED_PHASE_D_MUTATION_PRINCIPAL";
  refreshConnectionEvidence(promoted);
  assertState(classify(promoted), "REFUSED", "PRINCIPAL_CLASS_PROHIBITED");
});

test("forged HUMAN or authorization booleans are refused before classification", () => {
  for (const [key, value] of [
    ["humanApproved", true],
    ["principalApproved", true],
    ["sameConnectionVerified", true],
  ]) {
    const fixture = createFixture();
    fixture.principal[key] = value;
    assertState(classify(fixture), "REFUSED", "FORGED_AUTHORIZATION_CLAIM");
  }
});

test("wrong session, current or effective principal binding is refused", () => {
  for (const field of ["sessionUser", "currentUser", "effectiveRole"]) {
    const fixture = createFixture();
    fixture.principal[field] = "another_role";
    refreshConnectionEvidence(fixture);
    assertState(classify(fixture), "REFUSED", "PRINCIPAL_BINDING_MISMATCH");
  }
});

test("role transitions require a future separately reviewed exact binding", () => {
  const fixture = createFixture();
  fixture.principal.currentUser = "scoped_executor_role";
  fixture.principal.effectiveRole = "scoped_executor_role";
  fixture.principal.expectedEffectiveRole = "scoped_executor_role";
  fixture.principal.roleTransition = "REVIEWED_EXACT_TRANSITION";
  refreshConnectionEvidence(fixture);
  assertState(classify(fixture), "UNVERIFIED", "ROLE_TRANSITION_UNREVIEWED");
});

test("dangerous direct role attributes are refused", () => {
  for (const field of ["superuser", "createRole", "createDb", "replication", "bypassRls"]) {
    const fixture = createFixture();
    fixture.roleAttributes[field] = true;
    refreshConnectionEvidence(fixture);
    assertState(classify(fixture), "REFUSED", "DANGEROUS_ROLE_ATTRIBUTE");
  }
});

test("inherited dangerous membership and SET ROLE/admin paths are refused", () => {
  for (const membership of [
    { role: "dangerous_parent", source: "INHERITED", inherited: true, setRoleAllowed: false, adminOption: false, dangerous: true },
    { role: "writer_parent", source: "DIRECT", inherited: false, setRoleAllowed: true, adminOption: false, dangerous: false },
    { role: "admin_parent", source: "DIRECT", inherited: false, setRoleAllowed: false, adminOption: true, dangerous: false },
  ]) {
    const fixture = createFixture();
    fixture.memberships = [membership];
    refreshConnectionEvidence(fixture);
    assertState(classify(fixture), "REFUSED", "DANGEROUS_MEMBERSHIP_PATH");
  }
});

test("membership inventory must be bounded, sorted and unique", () => {
  const fixture = createFixture();
  fixture.memberships = [
    { role: "z_role", source: "DIRECT", inherited: false, setRoleAllowed: false, adminOption: false, dangerous: false },
    { role: "a_role", source: "DIRECT", inherited: false, setRoleAllowed: false, adminOption: false, dangerous: false },
  ];
  refreshConnectionEvidence(fixture);
  assertState(classify(fixture), "UNVERIFIED", "CATALOG_EVIDENCE_INCOMPLETE");
});

test("database ownership, CREATE and all TEMPORARY paths are refused", () => {
  for (const field of ["owner", "create", "temporary", "publicTemporary"]) {
    const fixture = createFixture();
    fixture.databasePrivileges[field] = true;
    refreshConnectionEvidence(fixture);
    assertState(classify(fixture), "REFUSED", "DATABASE_AUTHORITY_PROHIBITED");
  }
});

test("database CONNECT is required but does not itself authorize execution", () => {
  const fixture = createFixture();
  fixture.databasePrivileges.connect = false;
  refreshConnectionEvidence(fixture);
  assertState(classify(fixture), "UNVERIFIED", "DATABASE_AUTHORITY_PROHIBITED");
});

test("public, system and foreign schema ownership or CREATE is refused", () => {
  for (const mutate of [
    (fixture) => { fixture.schemaPrivileges.public.owner = true; },
    (fixture) => { fixture.schemaPrivileges.public.create = true; },
    (fixture) => { fixture.schemaPrivileges.system.ownedCount = 1; },
    (fixture) => { fixture.schemaPrivileges.foreign.createCount = 1; },
    (fixture) => { fixture.schemaPrivileges.foreign.mutationCount = 1; },
  ]) {
    const fixture = createFixture();
    mutate(fixture);
    refreshConnectionEvidence(fixture);
    assertState(classify(fixture), "REFUSED", "OUTSIDE_SCHEMA_AUTHORITY_PROHIBITED");
  }
});

test("outside-target table, sequence, ownership, PUBLIC and inherited mutation is refused", () => {
  for (const field of [
    "outsideTableMutationCount", "outsideSequenceMutationCount",
    "outsideOwnershipCount", "publicMutationGrantCount", "inheritedMutationGrantCount",
  ]) {
    const fixture = createFixture();
    fixture.objectPrivileges[field] = 1;
    refreshConnectionEvidence(fixture);
    assertState(classify(fixture), "REFUSED", "OUTSIDE_OBJECT_AUTHORITY_PROHIBITED");
  }
});

test("SECURITY DEFINER and ambiguous executable functions are refused", () => {
  for (const field of [
    "executableSecurityDefinerCount", "ambiguousExecutableNonSystemCount",
    "unreviewedExecutableCount",
  ]) {
    const fixture = createFixture();
    fixture.functionPrivileges[field] = 1;
    refreshConnectionEvidence(fixture);
    assertState(classify(fixture), "REFUSED", "FUNCTION_AUTHORITY_UNVERIFIED");
  }
});

test("unreviewed default ACL mutation scope is refused", () => {
  for (const field of [
    "outsideTargetMutationGrantCount", "publicMutationGrantCount",
    "inheritedMutationGrantCount", "unreviewedEntryCount",
  ]) {
    const fixture = createFixture();
    fixture.defaultPrivileges[field] = 1;
    refreshConnectionEvidence(fixture);
    assertState(classify(fixture), "REFUSED", "DEFAULT_PRIVILEGE_AUTHORITY_PROHIBITED");
  }
});

test("missing, incomplete or overflowed catalog evidence is unverified", () => {
  const cases = [
    (fixture) => { fixture.provenance.catalogCoverageComplete = false; },
    (fixture) => { fixture.objectPrivileges.coverageComplete = false; },
    (fixture) => { fixture.objectPrivileges.inventoryOverflow = true; },
    (fixture) => { fixture.functionPrivileges.inventoryOverflow = true; },
    (fixture) => { fixture.defaultPrivileges.coverageComplete = false; },
  ];
  for (const mutate of cases) {
    const fixture = createFixture();
    mutate(fixture);
    refreshConnectionEvidence(fixture);
    assertState(classify(fixture), "UNVERIFIED", "CATALOG_EVIDENCE_INCOMPLETE");
  }
});

test("stale, future-dated and overlong observations are unverified", () => {
  for (const mutate of [
    (fixture) => { fixture.provenance.expiresAtMs = NOW; },
    (fixture) => { fixture.provenance.observedAtMs = NOW + 1; },
    (fixture) => { fixture.provenance.expiresAtMs = fixture.provenance.observedAtMs + 300_001; },
  ]) {
    const fixture = createFixture();
    mutate(fixture);
    assertState(classify(fixture), "UNVERIFIED", "EVIDENCE_STALE");
  }
});

test("preflight evidence cannot authorize a different mutation or cleanup connection", () => {
  for (const phase of ["mutation", "cleanup"]) {
    const fixture = createFixture();
    fixture.connectionEvidence[phase].connectionIdentityDigest = "b".repeat(64);
    assertState(classify(fixture), "REFUSED", "CONNECTION_BINDING_MISMATCH");
  }
});

test("generation, role and privilege drift fail closed", () => {
  const generation = createFixture();
  generation.connectionEvidence.mutation.observationGeneration = "8";
  assertState(classify(generation), "REFUSED", "OBSERVATION_GENERATION_MISMATCH");

  const role = createFixture();
  role.connectionEvidence.mutation.effectiveRole = "changed_role";
  assertState(classify(role), "REFUSED", "PRINCIPAL_BINDING_MISMATCH");

  const digest = createFixture();
  digest.connectionEvidence.mutation.privilegeDigest = "b".repeat(64);
  assertState(classify(digest), "REFUSED", "PRIVILEGE_DIGEST_MISMATCH");
});

test("migration inventory order, checksum and digest are exact bindings", () => {
  const checksum = createFixture();
  checksum.destination.migrationInventory[0].checksum = "0".repeat(64);
  assertState(classify(checksum), "REFUSED", "MIGRATION_INVENTORY_MISMATCH");

  const order = createFixture();
  order.destination.migrationInventory.reverse();
  assertState(classify(order), "REFUSED", "MIGRATION_INVENTORY_MISMATCH");

  const digest = createFixture();
  digest.destination.migrationInventoryDigest = "0".repeat(64);
  assertState(classify(digest), "REFUSED", "MIGRATION_INVENTORY_MISMATCH");
});

test("search_path and URL schema cannot substitute for privilege enforcement", () => {
  const spoofed = createFixture();
  spoofed.schemaPrivileges.public.create = true;
  spoofed.schemaPrivileges.searchPath = [spoofed.destination.schemaIdentity, "pg_catalog"];
  spoofed.schemaPrivileges.urlSchema = spoofed.destination.schemaIdentity;
  refreshConnectionEvidence(spoofed);
  assertState(classify(spoofed), "REFUSED", "OUTSIDE_SCHEMA_AUTHORITY_PROHIBITED");

  const wrongPath = createFixture();
  wrongPath.schemaPrivileges.searchPath = ["public", "pg_catalog"];
  refreshConnectionEvidence(wrongPath);
  assertState(classify(wrongPath), "REFUSED", "DESTINATION_BINDING_MISMATCH");
});

test("connected source labels and caller-calculated digests never authenticate LIVE evidence", () => {
  const connected = createFixture();
  connected.provenance.source = "CONNECTED_POSTGRESQL_READ_ONLY";
  assertState(classify(connected), "REFUSED", "CONNECTED_SOURCE_SPOOFED");

  const synthetic = createFixture();
  const result = classify(synthetic);
  assert.equal(result.state, "ELIGIBLE_FOR_HUMAN_REVIEW");
  assertAuthorizationFalse(result);
});

test("getters, setters, functions, cycles and custom prototypes are refused without invocation", () => {
  let getterCalled = false;
  const getter = createFixture();
  Object.defineProperty(getter.destination, "repository", {
    enumerable: true,
    get() {
      getterCalled = true;
      return APPROVED_CONTEXT_B_REPOSITORY;
    },
  });
  assertState(classify(getter), "REFUSED", "UNSAFE_EVIDENCE_SHAPE");
  assert.equal(getterCalled, false);

  const custom = Object.create({ inherited: true });
  Object.assign(custom, createFixture());
  assertState(classify(custom), "REFUSED", "UNSAFE_EVIDENCE_SHAPE");

  const cycle = createFixture();
  cycle.destination.loop = cycle;
  assertState(classify(cycle), "REFUSED", "UNSAFE_EVIDENCE_SHAPE");

  const executable = createFixture();
  executable.destination.callback = () => true;
  assertState(classify(executable), "REFUSED", "UNSAFE_EVIDENCE_SHAPE");

  let clockGetterCalled = false;
  const hostileClock = {};
  Object.defineProperty(hostileClock, "nowMs", {
    enumerable: true,
    get() {
      clockGetterCalled = true;
      throw new Error("must-not-leak-clock-secret");
    },
  });
  const clockResult = classifyPhaseDPrincipalEvidence(createFixture(), hostileClock);
  assertState(clockResult, "REFUSED", "UNSAFE_EVIDENCE_SHAPE");
  assert.equal(clockGetterCalled, false);
  assert.doesNotMatch(JSON.stringify(clockResult), /must-not-leak/);
});

test("missing and unknown fields fail closed", () => {
  const missing = createFixture();
  delete missing.databasePrivileges.coverageComplete;
  assertState(classify(missing), "UNVERIFIED", "REQUIRED_FIELD_MISSING");

  const extra = createFixture();
  extra.databasePrivileges.unreviewed = false;
  assertState(classify(extra), "REFUSED", "UNEXPECTED_FIELD");
});

test("secret-shaped fields and raw errors are never emitted", () => {
  for (const [key, secret] of [
    ["databaseUrl", "postgresql://user:password@private.example/postgres"],
    ["password", "super-sensitive-password"],
    ["rawError", "driver-secret-detail"],
  ]) {
    const fixture = createFixture();
    fixture.principal[key] = secret;
    const result = classify(fixture);
    assertState(result, "REFUSED", "SENSITIVE_INPUT_PROHIBITED");
    assert.doesNotMatch(JSON.stringify(result), /postgresql:|password@|super-sensitive|driver-secret/i);
  }
});

test("every state retains all authorization booleans false", () => {
  const fixtures = [
    createFixture(),
    { ...createFixture(), observationState: "NOT_OBSERVED" },
    null,
    (() => {
      const fixture = createFixture();
      fixture.roleAttributes.superuser = true;
      refreshConnectionEvidence(fixture);
      return fixture;
    })(),
  ];
  for (const fixture of fixtures) {
    assertAuthorizationFalse(classifyPhaseDPrincipalEvidence(fixture, { nowMs: NOW }));
  }
});

test("output is allowlisted and contains no raw catalog, URL, handle or callback", () => {
  const result = classify(createFixture());
  assert.deepEqual(Object.keys(result).sort(), [
    "connectionAuthorized", "contractVersion", "evidenceAuthority", "evidenceClass",
    "executionAuthorized", "livePrincipalVerified", "mutationReady",
    "principalApproved", "reasonCode", "state", "summary",
  ].sort());
  assert.doesNotMatch(
    JSON.stringify(result),
    /"migrationInventory":|"memberships":|"databasePrivileges":|"connectionEvidence":|postgresql:/,
  );
  assert.equal(Object.values(result).some((value) => typeof value === "function"), false);
});

test("existing Context B lifecycle remains isolated from principal evidence", () => {
  const fixture = createFixture();
  const capability = createContextBOfflineCapability();
  const ownership = capability.issueOfflineOwnershipEvidence({
    context: fixture.destination.context,
    repository: fixture.destination.repository,
    runId: fixture.destination.runId,
    runAttempt: fixture.destination.runAttempt,
    targetIdentity: fixture.destination.targetIdentity,
    databaseName: fixture.destination.databaseName,
    schemaIdentity: fixture.destination.schemaIdentity,
  });
  assert.equal(ownership.mutationReady, false);
  assert.equal(ownership.ownershipMarker, fixture.destination.ownershipMarker);
  assertAuthorizationFalse(classify(fixture));
});

test("existing Phase D evaluator still rejects observer and CI_TEST principal classes", async () => {
  const source = await readFile(PHASE_D_PATH, "utf8");
  assert.match(source, /value\.principalClass === "DAILY_GOAL_OBSERVER_DATABASE_URL"/);
  assert.match(source, /value\.principalClass === "CI_TEST_DATABASE_URL"/);
  assert.match(source, /FUTURE_REVIEWED_PHASE_D_MUTATION_PRINCIPAL/);
  assert.doesNotMatch(source, /daily-goal-phase-d-principal-evidence/);
});

test("principal evidence module has no environment, DB, Prisma, network or subprocess reachability", async () => {
  const source = await readFile(MODULE_PATH, "utf8");
  assert.doesNotMatch(source, /process\.env|PrismaClient|\$executeRaw|\$queryRaw|child_process|spawn\s*\(|exec\s*\(|fetch\s*\(|https?:\/\//);
  assert.doesNotMatch(source, /postgres(?:ql)?:\/\/|CREATE\s+SCHEMA|DROP\s+SCHEMA|migrate\s+(?:deploy|status)/i);
});

test("Phase D workflow remains terminally disabled and refusal-only", async () => {
  const workflow = await readFile(WORKFLOW_PATH, "utf8");
  const start = workflow.indexOf("  daily-goal-migration-verification:");
  const end = workflow.indexOf("  integration-summary:", start);
  const job = workflow.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(job, /inputs\.run_daily_goal_migration_verification == true[\s\S]*&&\s*false/);
  assert.match(job, /Refuse live Phase D until separately authorized/);
  assert.match(job, /exit 1/);
  assert.doesNotMatch(job, /prisma\s+migrate|npm run test:daily-goal-phase-d|CI_TEST_DATABASE_URL/);
});

test("quarantine manifest, bytes and inactive migration state remain exact", async () => {
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
  const bytes = await readFile(DRAFT_PATH);
  const { createHash } = await import("node:crypto");
  assert.equal(manifest.activation_status, "NOT AUTHORIZED");
  assert.equal(manifest.database_execution, "NOT RUN");
  assert.equal(manifest.sha256, "8e468739c3f60693e9ff53d1c3d4107124ac1feaa9d95ac3a665ea8b8c89edb6");
  assert.equal(manifest.byte_count, 11_487);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), manifest.sha256);
  await assert.rejects(() => readFile(ACTIVE_PATH), { code: "ENOENT" });
});
