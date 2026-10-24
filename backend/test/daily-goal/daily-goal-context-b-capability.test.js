import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  APPROVED_CONTEXT_B_DATABASE_NAME,
  APPROVED_CONTEXT_B_REPOSITORY,
  APPROVED_CONTEXT_B_TARGET_IDENTITY,
  assessContextBMutationCredential,
  assertSafeContextBSchemaIdentity,
  CONTEXT_B_EVIDENCE_CLASS,
  CONTEXT_B_OFFLINE_MODE,
  ContextBOfflineFailure,
  createContextBOfflineCapability,
  deriveContextBSchemaIdentity,
} from "./daily-goal-context-b-capability.js";
import { DAILY_GOAL_HISTORY_CONTEXTS } from "./daily-goal-ci-contract.js";

const modulePath = fileURLToPath(new URL("./daily-goal-context-b-capability.js", import.meta.url));
const phaseDPath = fileURLToPath(new URL("./daily-goal-phase-d-offline.js", import.meta.url));
const workflowPath = fileURLToPath(new URL("../../../.github/workflows/ci-integration.yml", import.meta.url));
const manifestPath = fileURLToPath(new URL(
  "../../prisma/migration-drafts/daily-goal-v1/manifest.json",
  import.meta.url,
));
const draftPath = fileURLToPath(new URL(
  "../../prisma/migration-drafts/daily-goal-v1/20261022000000_add_daily_goal_v1/migration.sql",
  import.meta.url,
));
const activePath = fileURLToPath(new URL(
  "../../prisma/migrations/20261022000000_add_daily_goal_v1/migration.sql",
  import.meta.url,
));

const CONTEXT_B = DAILY_GOAL_HISTORY_CONTEXTS.RUN_OWNED_SCHEMA;
const CONTEXT_A_MARKER = `elvocab-ci-exclusive:v1:${APPROVED_CONTEXT_B_TARGET_IDENTITY}`;

function identity(overrides = {}) {
  const base = {
    context: CONTEXT_B,
    repository: APPROVED_CONTEXT_B_REPOSITORY,
    runId: "40059971757",
    runAttempt: "1",
    targetIdentity: APPROVED_CONTEXT_B_TARGET_IDENTITY,
    databaseName: APPROVED_CONTEXT_B_DATABASE_NAME,
  };
  return { ...base, schemaIdentity: deriveContextBSchemaIdentity(base), ...overrides };
}

function fakeObservation(evidence, overrides = {}) {
  return {
    evidenceClass: CONTEXT_B_EVIDENCE_CLASS,
    context: evidence.context,
    repository: evidence.repository,
    runId: evidence.runId,
    runAttempt: evidence.runAttempt,
    targetIdentity: evidence.targetIdentity,
    databaseName: evidence.databaseName,
    schemaIdentity: evidence.schemaIdentity,
    ownershipMarker: evidence.ownershipMarker,
    schemaExistedBefore: false,
    foreignOwned: false,
    ...overrides,
  };
}

function assertFailure(operation, code) {
  assert.throws(operation, (error) => error instanceof ContextBOfflineFailure && error.code === code);
}

function beginReadyLifecycle(capability, evidence) {
  const handle = capability.beginFakeLifecycle(evidence);
  capability.proposeCreateFreshSchema(handle);
  capability.recordFakeCreationObservation(handle, fakeObservation(evidence));
  capability.proveFakeInitialHistoryEmpty(handle, []);
  return handle;
}

test("valid identity deterministically binds repository, run, attempt and scope hash", () => {
  const input = identity();
  const schema = deriveContextBSchemaIdentity(input);
  assert.equal(schema, input.schemaIdentity);
  assert.match(schema, /^elvocab_dg_d_40059971757_1_[a-f0-9]{8}$/);
  assert.ok(Buffer.byteLength(schema, "utf8") <= 63);
  assert.equal(deriveContextBSchemaIdentity(input), schema);
});

test("run ID and attempt must be canonical positive decimal strings", () => {
  for (const runId of [undefined, null, "", "0", "01", "-1", "1.0", "a", "1 ", "1".repeat(21)]) {
    assertFailure(() => deriveContextBSchemaIdentity({ ...identity(), runId }), "RUN_ID_INVALID");
  }
  for (const runAttempt of [undefined, null, "", "0", "01", "-1", "a", " 1", "1".repeat(21)]) {
    assertFailure(() => deriveContextBSchemaIdentity({ ...identity(), runAttempt }), "RUN_ATTEMPT_INVALID");
  }
});

test("repository, target and database require exact approved values", () => {
  assertFailure(() => deriveContextBSchemaIdentity({ ...identity(), repository: "foreign/repository" }), "REPOSITORY_INVALID");
  assertFailure(() => deriveContextBSchemaIdentity({ ...identity(), repository: ` ${APPROVED_CONTEXT_B_REPOSITORY}` }), "REPOSITORY_INVALID");
  assertFailure(() => deriveContextBSchemaIdentity({ ...identity(), targetIdentity: APPROVED_CONTEXT_B_TARGET_IDENTITY.toUpperCase() }), "TARGET_IDENTITY_INVALID");
  assertFailure(() => deriveContextBSchemaIdentity({ ...identity(), databaseName: "POSTGRES" }), "DATABASE_NAME_INVALID");
  assertFailure(() => deriveContextBSchemaIdentity({ ...identity(), databaseName: "postgres " }), "DATABASE_NAME_INVALID");
});

test("safe schema policy rejects public, system, malformed and overlength names", () => {
  for (const schema of ["public", "pg_catalog", "pg_temp_1", "pg_toast", "information_schema", "ELVOCAB_DG_D_1_1_deadbeef", "elvocab-dg", "a".repeat(64)]) {
    assertFailure(() => assertSafeContextBSchemaIdentity(schema), "SCHEMA_IDENTITY_INVALID");
  }
});

test("explicit schema must equal the deterministic schema without truncation or collision", () => {
  const capability = createContextBOfflineCapability();
  const expected = identity();
  for (const schemaIdentity of [
    expected.schemaIdentity.slice(0, -1),
    `${expected.schemaIdentity}0`,
  ]) {
    assertFailure(() => capability.issueOfflineOwnershipEvidence({ ...expected, schemaIdentity }), "SCHEMA_IDENTITY_INVALID");
  }
  for (const schemaIdentity of [
    deriveContextBSchemaIdentity({ ...expected, runAttempt: "2" }),
    deriveContextBSchemaIdentity({ ...expected, runId: "40059971758" }),
  ]) {
    assertFailure(() => capability.issueOfflineOwnershipEvidence({ ...expected, schemaIdentity }), "SCHEMA_IDENTITY_BINDING_MISMATCH");
  }
});

test("only RUN_OWNED_SCHEMA context can issue offline evidence", () => {
  const capability = createContextBOfflineCapability();
  assertFailure(() => capability.issueOfflineOwnershipEvidence({
    ...identity(),
    context: DAILY_GOAL_HISTORY_CONTEXTS.EXISTING_TARGET,
  }), "CONTEXT_B_REQUIRED");
});

test("issued evidence is immutable, synthetic and never mutation-ready", () => {
  const capability = createContextBOfflineCapability();
  const evidence = capability.issueOfflineOwnershipEvidence(identity());
  assert.equal(Object.isFrozen(evidence), true);
  assert.equal(evidence.mode, CONTEXT_B_OFFLINE_MODE);
  assert.equal(evidence.evidenceClass, CONTEXT_B_EVIDENCE_CLASS);
  assert.equal(evidence.authenticatedByDatabase, false);
  assert.equal(evidence.connectionAuthorized, false);
  assert.equal(evidence.executionAuthorized, false);
  assert.equal(evidence.mutationReady, false);
  assert.notEqual(evidence.ownershipMarker, CONTEXT_A_MARKER);
  assert.match(evidence.ownershipMarker, /^elvocab-daily-goal-context-b:v1:[a-f0-9]{64}$/);
});

test("ownership evidence accepts exact claims and refuses changed claims", () => {
  const capability = createContextBOfflineCapability();
  const expected = identity();
  const evidence = capability.issueOfflineOwnershipEvidence(expected);
  assert.equal(capability.verifyOfflineOwnershipEvidence(evidence, expected), evidence);
  assertFailure(() => capability.verifyOfflineOwnershipEvidence(evidence, identity({ runAttempt: "2", schemaIdentity: deriveContextBSchemaIdentity({ ...expected, runAttempt: "2" }) })), "OWNERSHIP_EVIDENCE_MISMATCH");
});

test("cloned, forged and cross-factory evidence have no provenance", () => {
  const first = createContextBOfflineCapability();
  const second = createContextBOfflineCapability();
  const expected = identity();
  const evidence = first.issueOfflineOwnershipEvidence(expected);
  for (const candidate of [{ ...evidence }, Object.freeze({ ...evidence }), evidence]) {
    const owner = candidate === evidence ? second : first;
    assertFailure(() => owner.verifyOfflineOwnershipEvidence(candidate, expected), "OWNERSHIP_EVIDENCE_UNTRUSTED");
  }
});

test("one evidence object cannot start two lifecycles", () => {
  const capability = createContextBOfflineCapability();
  const evidence = capability.issueOfflineOwnershipEvidence(identity());
  capability.beginFakeLifecycle(evidence);
  assertFailure(() => capability.beginFakeLifecycle(evidence), "OWNERSHIP_EVIDENCE_REPLAYED");
});

test("lifecycle refuses arbitrary or out-of-order handles", () => {
  const capability = createContextBOfflineCapability();
  assertFailure(() => capability.proposeCreateFreshSchema(Object.freeze({})), "LIFECYCLE_HANDLE_UNTRUSTED");
  const evidence = capability.issueOfflineOwnershipEvidence(identity());
  const handle = capability.beginFakeLifecycle(evidence);
  assertFailure(() => capability.proveFakeInitialHistoryEmpty(handle, []), "LIFECYCLE_ORDER_INVALID");
});

test("fake creation requires fresh exact same-run ownership continuity", () => {
  const fields = [
    ["repository", "foreign/repository"],
    ["runId", "40059971758"],
    ["runAttempt", "2"],
    ["targetIdentity", "foreign.invalid:5432/postgres"],
    ["databaseName", "other"],
    ["schemaIdentity", "public"],
    ["ownershipMarker", CONTEXT_A_MARKER],
    ["foreignOwned", true],
    ["schemaExistedBefore", true],
  ];
  for (const [field, value] of fields) {
    const capability = createContextBOfflineCapability();
    const evidence = capability.issueOfflineOwnershipEvidence(identity());
    const handle = capability.beginFakeLifecycle(evidence);
    capability.proposeCreateFreshSchema(handle);
    assertFailure(() => capability.recordFakeCreationObservation(handle, fakeObservation(evidence, { [field]: value })), "OWNERSHIP_CONTINUITY_INVALID");
    assertFailure(() => capability.revalidateFakeOwnershipBeforeCleanup(handle, fakeObservation(evidence)), "LIFECYCLE_REFUSED");
  }
});

test("initial migration history must be exactly empty", () => {
  const capability = createContextBOfflineCapability();
  const evidence = capability.issueOfflineOwnershipEvidence(identity());
  const handle = capability.beginFakeLifecycle(evidence);
  capability.proposeCreateFreshSchema(handle);
  capability.recordFakeCreationObservation(handle, fakeObservation(evidence));
  assertFailure(() => capability.proveFakeInitialHistoryEmpty(handle, [{ name: "unexpected" }]), "INITIAL_MIGRATION_HISTORY_NOT_EMPTY");
});

test("mutation revalidation is continuity-only and issues no execution capability", () => {
  const capability = createContextBOfflineCapability();
  const evidence = capability.issueOfflineOwnershipEvidence(identity());
  const handle = beginReadyLifecycle(capability, evidence);
  const result = capability.revalidateFakeOwnershipBeforeMutation(handle, fakeObservation(evidence));
  assert.equal(result.status, "OFFLINE_CONTINUITY_ONLY");
  assert.equal(result.mutationReady, false);
  assert.equal(result.executionAuthorized, false);
});

test("changed marker before mutation taints lifecycle and prevents cleanup", () => {
  const capability = createContextBOfflineCapability();
  const evidence = capability.issueOfflineOwnershipEvidence(identity());
  const handle = beginReadyLifecycle(capability, evidence);
  assertFailure(() => capability.revalidateFakeOwnershipBeforeMutation(handle, fakeObservation(evidence, { ownershipMarker: `${evidence.ownershipMarker}0` })), "OWNERSHIP_CONTINUITY_INVALID");
  assertFailure(() => capability.revalidateFakeOwnershipBeforeCleanup(handle, fakeObservation(evidence)), "LIFECYCLE_REFUSED");
});

test("cleanup eligibility requires same-run revalidation and never authorizes drop", () => {
  const capability = createContextBOfflineCapability();
  const evidence = capability.issueOfflineOwnershipEvidence(identity());
  const handle = beginReadyLifecycle(capability, evidence);
  capability.revalidateFakeOwnershipBeforeMutation(handle, fakeObservation(evidence));
  const result = capability.revalidateFakeOwnershipBeforeCleanup(handle, fakeObservation(evidence));
  assert.equal(result.status, "FAKE_CLEANUP_ELIGIBLE");
  assert.equal(result.dropAuthorized, false);
  assert.equal(result.mutationReady, false);
});

test("cleanup rejects another attempt of the same run", () => {
  const capability = createContextBOfflineCapability();
  const evidence = capability.issueOfflineOwnershipEvidence(identity());
  const handle = beginReadyLifecycle(capability, evidence);
  capability.revalidateFakeOwnershipBeforeMutation(handle, fakeObservation(evidence));
  assertFailure(() => capability.revalidateFakeOwnershipBeforeCleanup(handle, fakeObservation(evidence, { runAttempt: "2" })), "OWNERSHIP_CONTINUITY_INVALID");
});

test("fake cleanup success requires exact continuity and remains explicitly non-live", () => {
  const capability = createContextBOfflineCapability();
  const evidence = capability.issueOfflineOwnershipEvidence(identity());
  const handle = beginReadyLifecycle(capability, evidence);
  capability.revalidateFakeOwnershipBeforeMutation(handle, fakeObservation(evidence));
  capability.revalidateFakeOwnershipBeforeCleanup(handle, fakeObservation(evidence));
  const result = capability.recordFakeCleanupResult(handle, {
    evidenceClass: CONTEXT_B_EVIDENCE_CLASS,
    status: "FAKE_SUCCESS",
    schemaIdentity: evidence.schemaIdentity,
    ownershipMarker: evidence.ownershipMarker,
    foreignSchemaTouched: false,
  });
  assert.equal(result.status, "FAKE_CLEANUP_RECORDED");
  assert.equal(result.liveCleanupProven, false);
  assert.equal(result.dropAuthorized, false);
});

test("failed or foreign cleanup results cannot be reported as success", () => {
  for (const override of [
    { status: "FAILED" },
    { schemaIdentity: "public" },
    { ownershipMarker: CONTEXT_A_MARKER },
    { foreignSchemaTouched: true },
  ]) {
    const capability = createContextBOfflineCapability();
    const evidence = capability.issueOfflineOwnershipEvidence(identity());
    const handle = beginReadyLifecycle(capability, evidence);
    capability.revalidateFakeOwnershipBeforeMutation(handle, fakeObservation(evidence));
    capability.revalidateFakeOwnershipBeforeCleanup(handle, fakeObservation(evidence));
    assertFailure(() => capability.recordFakeCleanupResult(handle, {
      evidenceClass: CONTEXT_B_EVIDENCE_CLASS,
      status: "FAKE_SUCCESS",
      schemaIdentity: evidence.schemaIdentity,
      ownershipMarker: evidence.ownershipMarker,
      foreignSchemaTouched: false,
      ...override,
    }), "FAKE_CLEANUP_RESULT_INVALID");
  }
});

test("observer transport is always refused for mutation", () => {
  const result = assessContextBMutationCredential({ transportClass: "DAILY_GOAL_OBSERVER_DATABASE_URL" });
  assert.equal(result.status, "REFUSED");
  assert.equal(result.code, "OBSERVER_MUTATION_PROHIBITED");
  assert.equal(result.mutationReady, false);
});

test("CI writer candidate remains pending and cannot be promoted by caller boolean", () => {
  for (const principalApproved of [undefined, false, true]) {
    const result = assessContextBMutationCredential({ transportClass: "CI_TEST_DATABASE_URL", principalApproved });
    assert.equal(result.status, "PENDING_PRINCIPAL_REVIEW");
    assert.equal(result.code, "CI_WRITER_CANDIDATE_UNVERIFIED");
    assert.equal(result.principalVerified, false);
    assert.equal(result.mutationReady, false);
  }
});

test("future principal label remains pending without connected principal review", () => {
  const result = assessContextBMutationCredential({
    transportClass: "FUTURE_REVIEWED_PHASE_D_MUTATION_PRINCIPAL",
    principalApproved: true,
  });
  assert.equal(result.status, "PENDING_PRINCIPAL_REVIEW");
  assert.equal(result.code, "CONNECTED_PRINCIPAL_UNVERIFIED");
  assert.equal(result.connectionAuthorized, false);
  assert.equal(result.executionAuthorized, false);
});

test("unknown principal and sensitive credential-shaped input are refused", () => {
  assert.equal(assessContextBMutationCredential({ transportClass: "XP_STREAK_WRITER" }).status, "REFUSED");
  for (const candidate of [
    { transportClass: "CI_TEST_DATABASE_URL", databaseUrl: "must-not-be-read" },
    { transportClass: "CI_TEST_DATABASE_URL", password: "must-not-be-read" },
    { transportClass: "CI_TEST_DATABASE_URL", nested: { secret: "must-not-be-read" } },
  ]) {
    const result = assessContextBMutationCredential(candidate);
    assert.equal(result.status, "REFUSED");
    assert.equal(result.code, "CREDENTIAL_POLICY_INPUT_INVALID");
    assert.doesNotMatch(JSON.stringify(result), /must-not-be-read/);
  }
});

test("accessors and custom prototypes cannot spoof identity, credential or cleanup evidence", () => {
  let getterCalled = false;
  const hostileIdentity = { ...identity() };
  Object.defineProperty(hostileIdentity, "repository", {
    enumerable: true,
    get() {
      getterCalled = true;
      return APPROVED_CONTEXT_B_REPOSITORY;
    },
  });
  assertFailure(() => deriveContextBSchemaIdentity(hostileIdentity), "RUN_IDENTITY_REQUIRED");
  assert.equal(getterCalled, false);

  const hostileCredential = Object.create({ inherited: true });
  hostileCredential.transportClass = "FUTURE_REVIEWED_PHASE_D_MUTATION_PRINCIPAL";
  assert.equal(assessContextBMutationCredential(hostileCredential).status, "REFUSED");

  const capability = createContextBOfflineCapability();
  const evidence = capability.issueOfflineOwnershipEvidence(identity());
  const handle = beginReadyLifecycle(capability, evidence);
  capability.revalidateFakeOwnershipBeforeMutation(handle, fakeObservation(evidence));
  capability.revalidateFakeOwnershipBeforeCleanup(handle, fakeObservation(evidence));
  const hostileCleanup = Object.create({ inherited: true });
  Object.assign(hostileCleanup, {
    evidenceClass: CONTEXT_B_EVIDENCE_CLASS,
    status: "FAKE_SUCCESS",
    schemaIdentity: evidence.schemaIdentity,
    ownershipMarker: evidence.ownershipMarker,
    foreignSchemaTouched: false,
  });
  assertFailure(() => capability.recordFakeCleanupResult(handle, hostileCleanup), "FAKE_CLEANUP_RESULT_INVALID");
});

test("credential policy never emits mutation-ready or executable capability", () => {
  for (const transportClass of [
    "DAILY_GOAL_OBSERVER_DATABASE_URL",
    "CI_TEST_DATABASE_URL",
    "FUTURE_REVIEWED_PHASE_D_MUTATION_PRINCIPAL",
    "UNKNOWN",
  ]) {
    const result = assessContextBMutationCredential({ transportClass, principalApproved: true });
    assert.equal(result.mutationReady, false);
    assert.equal(result.connectionAuthorized, false);
    assert.equal(result.executionAuthorized, false);
    assert.equal(Object.values(result).some((value) => typeof value === "function"), false);
  }
});

test("new module has no environment, network, Prisma, SQL or subprocess reachability", async () => {
  const source = await readFile(modulePath, "utf8");
  assert.doesNotMatch(source, /process\.env|node:child_process|spawn\s*\(|exec\s*\(|PrismaClient|\$queryRaw|\$executeRaw|postgres(?:ql)?:\/\/|CREATE\s+SCHEMA|DROP\s+SCHEMA|migrate\s+(?:deploy|status)/i);
  assert.doesNotMatch(source, /DAILY_GOAL_OBSERVER_DATABASE_URL\s*\]|CI_TEST_DATABASE_URL\s*\]/);
});

test("existing Phase D evaluator stays separate and unchanged by imports", async () => {
  const [source, phaseD] = await Promise.all([readFile(modulePath, "utf8"), readFile(phaseDPath, "utf8")]);
  assert.doesNotMatch(phaseD, /daily-goal-context-b-capability/);
  assert.doesNotMatch(source, /createPhaseDOfflineHarness|HUMAN_PHASE_D_EXECUTION_APPROVED/);
});

test("Phase D workflow remains terminally disabled and refusal-only", async () => {
  const workflow = await readFile(workflowPath, "utf8");
  const start = workflow.indexOf("  daily-goal-migration-verification:");
  const end = workflow.indexOf("  integration-summary:", start);
  const job = workflow.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(job, /inputs\.run_daily_goal_migration_verification == true[\s\S]*&&\s*false/);
  assert.match(job, /Refuse live Phase D until separately authorized/);
  assert.match(job, /exit 1/);
  assert.doesNotMatch(job, /PrismaClient|migrate\s+(?:deploy|status)|CI_TEST_DATABASE_URL|DAILY_GOAL_OBSERVER_DATABASE_URL/);
});

test("quarantined migration bytes and inactive state remain exact", async () => {
  const [manifestText, bytes] = await Promise.all([readFile(manifestPath, "utf8"), readFile(draftPath)]);
  const manifest = JSON.parse(manifestText);
  assert.equal(manifest.activation_status, "NOT AUTHORIZED");
  assert.equal(manifest.database_execution, "NOT RUN");
  assert.equal(bytes.length, 11_487);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), "8e468739c3f60693e9ff53d1c3d4107124ac1feaa9d95ac3a665ea8b8c89edb6");
  await assert.rejects(() => access(activePath), { code: "ENOENT" });
});
