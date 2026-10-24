import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  APPROVED_CONTEXT_A_OWNERSHIP_MARKER,
  createPhaseDOfflineHarness,
  DAILY_GOAL_MIGRATION,
  DAILY_GOAL_SCHEMA_EVIDENCE,
  PHASE_D_OFFLINE_MODE,
  PhaseDOfflineFailure,
} from "./daily-goal-phase-d-offline.js";
import { DAILY_GOAL_HISTORY_CONTEXTS } from "./daily-goal-ci-contract.js";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
const draftPath = fileURLToPath(new URL(
  "../../prisma/migration-drafts/daily-goal-v1/20261022000000_add_daily_goal_v1/migration.sql",
  import.meta.url,
));
const manifestPath = fileURLToPath(new URL(
  "../../prisma/migration-drafts/daily-goal-v1/manifest.json",
  import.meta.url,
));
const workflowPath = fileURLToPath(new URL("../../../.github/workflows/ci-integration.yml", import.meta.url));
const modulePath = fileURLToPath(new URL("./daily-goal-phase-d-offline.js", import.meta.url));
const activeArtifactPath = fileURLToPath(new URL(
  "../../prisma/migrations/20261022000000_add_daily_goal_v1/migration.sql",
  import.meta.url,
));

const TARGET = "aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres";
const MARKER = APPROVED_CONTEXT_A_OWNERSHIP_MARKER;
const DECISION = "HUMAN_PHASE_D_EXECUTION_APPROVED";
const PRINCIPAL = "FUTURE_REVIEWED_PHASE_D_MUTATION_PRINCIPAL";

const BASELINE = Object.freeze([
  entry("20260916042441_init_user_auth_session", "92035a5a775a727eeb0fb62aaa21036b66f3f5c6eac2284b6174382b617a8702"),
  entry("20260921000000_add_topic", "f6fe9833e31b6e17fd1965348c6945508765b782dbd1447b8a7317ca11dc9fad"),
  entry("20260921000001_add_vocabulary_aggregate", "831d2a2408e5d1cc129e88577425066db092c4b2914c206dd1a056a2591891a3"),
  entry("20260922000000_add_vocabulary_set", "4c7ba91a1230a5772b89e126d6fe90d91115530651bfd44471078b8a3b691afb"),
  entry("20260923000000_add_learning_progress", "d7c6aa672a360c54c9565f22a93437fbed38c04c77edc7ab8c6437f0f5da7079"),
  entry("20260928000000_add_personal_vocabulary_foundation", "c44e2418cfa0a330620ffa961ddb21e1f58c56277b162ecb8d20fe22f60ce7f8"),
  entry("20260930000000_decouple_personal_set_topic", "065a2a4932186d963d36a7a0382be407c05414baa4c35290a672d733a3c8ce94"),
  entry("20261007000000_add_vocabulary_set_metadata", "3e0e6b8927174349e41c8a639f964a52e458cb16f378b1aace701cf77f3d7415"),
  entry("20261016000000_add_xp_level_v1", "8bcf4228f178601d19416cd40c2d1736a36b9e2eab8a73c037a4ae2ce414abae"),
  entry("20261017000000_add_streak_v1", "8ac6901420011a9a2721660add430136772c5581e46b67ae1d72cd04d001bedc"),
  entry("20261018000000_add_streak_srs_receipt", "c123f901cd02f81dd87758618b7b06917640968122bf60df67b077694b60b4da"),
]);
const DAILY = entry(DAILY_GOAL_MIGRATION.name, DAILY_GOAL_MIGRATION.checksum);
const REVIEWED = Object.freeze([...BASELINE, DAILY]);

test("no execution authorization and Context A evidence-shaped objects are refused", async () => {
  const transcript = await contextATranscript();
  const harness = createPhaseDOfflineHarness();
  assertFailure(() => harness.evaluate({ ...transcript, executionAuthorization: undefined }), "EXECUTION_AUTHORIZATION_REQUIRED");
  assertFailure(() => harness.evaluate({
    ...transcript,
    executionAuthorization: Object.freeze({ status: "ACCEPTED", context: "EXISTING_TARGET" }),
  }), "EXECUTION_AUTHORIZATION_REQUIRED");
});

test("Context A accepts only the exact approved target and ownership marker", async () => {
  const harness = createPhaseDOfflineHarness();
  const transcript = await contextATranscript();
  const token = issue(harness, transcript.destination, [DAILY]);
  const result = harness.evaluate({ ...transcript, executionAuthorization: token });
  assert.equal(result.targetIdentity, TARGET);
  assert.equal(transcript.destination.ownershipEvidence, MARKER);
});

test("missing, undefined and null Context A markers fail closed", async () => {
  const transcript = await contextATranscript();
  for (const ownershipEvidence of [undefined, null]) {
    const harness = createPhaseDOfflineHarness();
    assertFailure(() => harness.issueFakeExecutionAuthorization({
      decision: DECISION,
      destination: { ...transcript.destination, ownershipEvidence },
      pending: [DAILY],
    }), "DESTINATION_INVALID");
  }
  const { ownershipEvidence: omitted, ...withoutMarker } = transcript.destination;
  assert.equal(omitted, MARKER);
  const harness = createPhaseDOfflineHarness();
  assertFailure(() => harness.issueFakeExecutionAuthorization({
    decision: DECISION,
    destination: withoutMarker,
    pending: [DAILY],
  }), "DESTINATION_INVALID");
});

test("wrong but syntactically safe Context A marker is refused", async () => {
  await assertContextAMarkerFailure("wrong-but-safe-marker", "CONTEXT_A_OWNERSHIP_MARKER_INVALID");
});

test("suffix-extended Context A marker is refused", async () => {
  await assertContextAMarkerFailure(`${MARKER}-extra`, "CONTEXT_A_OWNERSHIP_MARKER_INVALID");
});

test("case and whitespace differences in Context A marker are refused", async () => {
  await assertContextAMarkerFailure(MARKER.toUpperCase(), "CONTEXT_A_OWNERSHIP_MARKER_INVALID");
  await assertContextAMarkerFailure(` ${MARKER}`, "DESTINATION_INVALID");
  await assertContextAMarkerFailure(`${MARKER} `, "DESTINATION_INVALID");
});

test("approved Context A marker cannot authorize a different target identity", async () => {
  const transcript = await contextATranscript();
  const harness = createPhaseDOfflineHarness();
  assertFailure(() => harness.issueFakeExecutionAuthorization({
    decision: DECISION,
    destination: { ...transcript.destination, targetIdentity: "different.invalid:5432/postgres" },
    pending: [DAILY],
  }), "DESTINATION_INVALID");
});

test("Context A marker cannot substitute for Context B run ownership", async () => {
  const transcript = await contextBTranscript();
  const harness = createPhaseDOfflineHarness();
  assertFailure(() => harness.issueFakeExecutionAuthorization({
    decision: DECISION,
    destination: {
      ...transcript.destination,
      ownershipEvidence: MARKER,
      runOwnership: { ...transcript.destination.runOwnership, marker: MARKER },
    },
    pending: REVIEWED,
  }), "RUN_OWNERSHIP_INVALID");
});

test("Context B run marker cannot substitute for Context A ownership", async () => {
  const a = await contextATranscript();
  const b = await contextBTranscript();
  const harness = createPhaseDOfflineHarness();
  assertFailure(() => harness.issueFakeExecutionAuthorization({
    decision: DECISION,
    destination: { ...a.destination, ownershipEvidence: b.destination.ownershipEvidence },
    pending: [DAILY],
  }), "CONTEXT_A_OWNERSHIP_MARKER_INVALID");
});

test("Context A authorization cannot authorize Context B", async () => {
  const harness = createPhaseDOfflineHarness();
  const a = await contextATranscript();
  const b = await contextBTranscript();
  const token = issue(harness, a.destination, [DAILY]);
  assertFailure(() => harness.evaluate({ ...b, executionAuthorization: token }), "APPROVAL_DESTINATION_MISMATCH");
});

test("Context B authorization cannot authorize Context A", async () => {
  const harness = createPhaseDOfflineHarness();
  const a = await contextATranscript();
  const b = await contextBTranscript();
  const token = issue(harness, b.destination, REVIEWED);
  assertFailure(() => harness.evaluate({ ...a, executionAuthorization: token }), "APPROVAL_DESTINATION_MISMATCH");
});

test("missing, malformed and stale authorization fail closed", async () => {
  const harness = createPhaseDOfflineHarness();
  const transcript = await contextATranscript();
  assertFailure(() => harness.issueFakeExecutionAuthorization({}), "EXECUTION_AUTHORIZATION_REQUIRED");
  assertFailure(() => harness.issueFakeExecutionAuthorization({ decision: DECISION }), "DESTINATION_CONTEXT_INVALID");
  const token = issue(harness, transcript.destination, [DAILY]);
  assertFailure(() => harness.evaluate({
    ...transcript,
    executionAuthorization: token,
    destination: { ...transcript.destination, targetIdentity: "different.invalid:5432/postgres" },
  }), "DESTINATION_INVALID");
  assertFailure(() => harness.issueFakeExecutionAuthorization({
    decision: DECISION,
    destination: { ...transcript.destination, targetIdentity: "production.invalid:5432/postgres" },
    pending: [DAILY],
  }), "DESTINATION_INVALID");
});

test("pending checksum mismatch is refused", async () => {
  const harness = createPhaseDOfflineHarness();
  const transcript = await contextATranscript();
  const token = issue(harness, transcript.destination, [{ ...DAILY, checksum: "0".repeat(64) }]);
  assertFailure(() => harness.evaluate({ ...transcript, executionAuthorization: token }), "DAILY_GOAL_ARTIFACT_NOT_APPROVED");
});

test("missing, unexpected and reordered migration histories are refused", async () => {
  for (const history of [
    applied(BASELINE.slice(0, -1)),
    [...applied(BASELINE), { name: "20261019000000_unexpected", checksum: "a".repeat(64), status: "APPLIED" }],
    [...applied(BASELINE)].reverse(),
  ]) {
    const harness = createPhaseDOfflineHarness();
    const transcript = await contextATranscript();
    const token = issue(harness, transcript.destination, [DAILY]);
    assertFailure(() => harness.evaluate({
      ...transcript,
      executionAuthorization: token,
      preExecutionHistory: history,
      immediateHistory: history,
    }), "MIGRATION_INVENTORY_INVALID");
  }
});

test("history changing after approval reconciliation is refused", async () => {
  const harness = createPhaseDOfflineHarness();
  const transcript = await contextATranscript();
  const token = issue(harness, transcript.destination, [DAILY]);
  assertFailure(() => harness.evaluate({
    ...transcript,
    executionAuthorization: token,
    immediateHistory: applied(REVIEWED),
  }), "MIGRATION_INVENTORY_INVALID");
});

test("unreviewed activation bytes are refused", async () => {
  const harness = createPhaseDOfflineHarness();
  const transcript = await contextATranscript();
  const token = issue(harness, transcript.destination, [DAILY]);
  const changed = Buffer.from(transcript.activationBytes);
  changed[0] ^= 1;
  assertFailure(() => harness.evaluate({ ...transcript, executionAuthorization: token, activationBytes: changed }), "ACTIVATION_BYTES_INVALID");
});

test("Context B requires a concrete non-public schema", async () => {
  const harness = createPhaseDOfflineHarness();
  const transcript = await contextBTranscript();
  for (const schemaIdentity of ["", "public", "BAD-SCHEMA", "x"]) {
    assertFailure(() => harness.issueFakeExecutionAuthorization({
      decision: DECISION,
      destination: {
        ...transcript.destination,
        schemaIdentity,
        runOwnership: { ...transcript.destination.runOwnership, schemaIdentity },
      },
      pending: REVIEWED,
    }), schemaIdentity === ""
      ? "DESTINATION_INVALID" : "RUN_OWNED_SCHEMA_INVALID");
  }
});

test("Context B requires exact run/attempt ownership and fresh non-foreign evidence", async () => {
  const transcript = await contextBTranscript();
  for (const runOwnership of [
    undefined,
    { ...transcript.destination.runOwnership, runId: "other" },
    { ...transcript.destination.runOwnership, runAttempt: "" },
    { ...transcript.destination.runOwnership, schemaIdentity: "foreign_schema" },
    { ...transcript.destination.runOwnership, fresh: false },
    { ...transcript.destination.runOwnership, foreign: true },
    { ...transcript.destination.runOwnership, marker: "wrong-marker" },
  ]) {
    const harness = createPhaseDOfflineHarness();
    assertFailure(() => harness.issueFakeExecutionAuthorization({
      decision: DECISION,
      destination: { ...transcript.destination, runOwnership },
      pending: REVIEWED,
    }), "RUN_OWNERSHIP_INVALID");
  }
});

test("public and foreign schemas can never become Context B cleanup targets", async () => {
  const transcript = await contextBTranscript();
  for (const cleanupEvidence of [
    { ...transcript.cleanupEvidence, targetSchema: "public" },
    { ...transcript.cleanupEvidence, targetSchema: "another_run_schema" },
    { ...transcript.cleanupEvidence, ownershipEvidence: "foreign" },
    { ...transcript.cleanupEvidence, foreignSchemaTouched: true },
  ]) {
    const harness = createPhaseDOfflineHarness();
    const token = issue(harness, transcript.destination, REVIEWED);
    assertFailure(() => harness.evaluate({ ...transcript, executionAuthorization: token, cleanupEvidence }), "RUN_OWNED_CLEANUP_FAILED");
  }
});

test("Context A never accepts a cleanup target", async () => {
  const harness = createPhaseDOfflineHarness();
  const transcript = await contextATranscript();
  const token = issue(harness, transcript.destination, [DAILY]);
  assertFailure(() => harness.evaluate({
    ...transcript,
    executionAuthorization: token,
    cleanupEvidence: { status: "PASS", targetSchema: "public" },
  }), "CONTEXT_A_CLEANUP_PROHIBITED");
});

test("observer, legacy and URL-bearing credential evidence is refused", async () => {
  const transcript = await contextATranscript();
  for (const credentialBoundary of [
    { ...transcript.credentialBoundary, principalClass: "DAILY_GOAL_OBSERVER_DATABASE_URL" },
    { ...transcript.credentialBoundary, principalClass: "CI_TEST_DATABASE_URL" },
    { ...transcript.credentialBoundary, databaseUrl: "must-not-be-accepted" },
    { ...transcript.credentialBoundary, reviewed: false },
  ]) {
    const harness = createPhaseDOfflineHarness();
    const token = issue(harness, transcript.destination, [DAILY]);
    assertFailure(() => harness.evaluate({ ...transcript, executionAuthorization: token, credentialBoundary }), "MUTATION_CREDENTIAL_BOUNDARY_INVALID");
  }
});

test("apply failure never serializes success", async () => {
  const harness = createPhaseDOfflineHarness();
  const transcript = await contextATranscript();
  const token = issue(harness, transcript.destination, [DAILY]);
  assertFailure(() => harness.evaluate({
    ...transcript,
    executionAuthorization: token,
    applicationEvidence: { status: "FAILED", migrations: [DAILY], rawError: "must-not-leak" },
  }), "MIGRATION_APPLY_FAILED");
});

test("incomplete post-migration history never serializes success", async () => {
  const harness = createPhaseDOfflineHarness();
  const transcript = await contextATranscript();
  const token = issue(harness, transcript.destination, [DAILY]);
  assertFailure(() => harness.evaluate({
    ...transcript,
    executionAuthorization: token,
    postExecutionHistory: applied(BASELINE),
  }), "MIGRATION_INVENTORY_INVALID");
});

test("schema verification rejects a missing required primary key", async () => {
  await assertSchemaMutationFails((evidence) => { evidence.primaryKeys.shift(); });
});

test("schema verification rejects an incorrect primary-key column set or order", async () => {
  await assertSchemaMutationFails((evidence) => {
    evidence.primaryKeys[0] = "DAILY_GOAL_DAY_pkey:DAILY_GOAL_DAY:user_id,id";
  });
});

test("schema verification rejects a missing required column", async () => {
  await assertSchemaMutationFails((evidence) => { evidence.columns.splice(10, 1); });
});

test("schema verification rejects an incorrect column SQL type", async () => {
  await assertSchemaMutationFails((evidence) => {
    evidence.columns = replaceCanonical(evidence.columns, "DAILY_GOAL_DAY.active_milliseconds:", "BIGINT", "INTEGER");
  });
});

test("schema verification rejects incorrect column nullability", async () => {
  await assertSchemaMutationFails((evidence) => {
    evidence.columns = replaceCanonical(evidence.columns, "DAILY_GOAL_DAY.last_credited_at:", "NULLABLE", "NOT_NULL");
  });
});

test("schema verification rejects an incorrect database default", async () => {
  await assertSchemaMutationFails((evidence) => {
    evidence.columns = replaceCanonical(evidence.columns, "DAILY_GOAL_OWNER.generation:", "DEFAULT_0", "NO_DEFAULT");
  });
});

test("schema verification rejects an incorrect character-length limit", async () => {
  await assertSchemaMutationFails((evidence) => {
    evidence.columns = replaceCanonical(evidence.columns, "USER_NOTIFICATION.title:", "VARCHAR(160)", "VARCHAR(161)");
  });
});

test("schema verification rejects a missing enum definition or value", async () => {
  await assertSchemaMutationFails((evidence) => { evidence.enums.pop(); });
  await assertSchemaMutationFails((evidence) => {
    evidence.enums[0] = evidence.enums[0].replace(",SPEAKING", "");
  });
});

test("schema verification rejects a missing or altered index", async () => {
  await assertSchemaMutationFails((evidence) => { evidence.indexes.shift(); });
  await assertSchemaMutationFails((evidence) => {
    evidence.indexes[1] = evidence.indexes[1].replace("activity_date DESC", "activity_date ASC");
  });
});

test("schema verification rejects a missing or altered CHECK constraint", async () => {
  await assertSchemaMutationFails((evidence) => { evidence.constraints.shift(); });
  await assertSchemaMutationFails((evidence) => {
    evidence.constraints[0] = evidence.constraints[0].replace("240", "241");
  });
});

test("schema verification rejects a missing or altered FK referential action", async () => {
  await assertSchemaMutationFails((evidence) => { evidence.foreignKeys.pop(); });
  await assertSchemaMutationFails((evidence) => {
    evidence.foreignKeys[0] = evidence.foreignKeys[0].replace("ON_DELETE_CASCADE", "ON_DELETE_RESTRICT");
  });
});

test("complete true cannot authorize an incomplete schema fixture", async () => {
  await assertSchemaMutationFails((evidence) => {
    evidence.columns = DAILY_GOAL_SCHEMA_EVIDENCE.columns.slice(0, 5);
  });
});

test("schema verification rejects extra or inconsistent canonical evidence", async () => {
  await assertSchemaMutationFails((evidence) => {
    evidence.columns.push("DAILY_GOAL_DAY.unreviewed_column:TEXT:NULLABLE:NO_DEFAULT");
  });
});

test("failed Context B cleanup never serializes success", async () => {
  const harness = createPhaseDOfflineHarness();
  const transcript = await contextBTranscript();
  const token = issue(harness, transcript.destination, REVIEWED);
  assertFailure(() => harness.evaluate({
    ...transcript,
    executionAuthorization: token,
    cleanupEvidence: { ...transcript.cleanupEvidence, status: "FAILED", rawError: "secret detail" },
  }), "RUN_OWNED_CLEANUP_FAILED");
});

test("successful Context A fake path requires complete evidence and remains immutable", async () => {
  const harness = createPhaseDOfflineHarness();
  const transcript = await contextATranscript();
  const token = issue(harness, transcript.destination, [DAILY]);
  const result = harness.evaluate({ ...transcript, executionAuthorization: token });
  assert.equal(result.mode, PHASE_D_OFFLINE_MODE);
  assert.equal(result.status, "PASS");
  assert.equal(result.context, DAILY_GOAL_HISTORY_CONTEXTS.EXISTING_TARGET);
  assert.deepEqual(result.pending, [DAILY]);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.verification), true);
  assert.doesNotMatch(JSON.stringify(result), /postgresql:|secret|rawError/i);
});

test("successful Context B fake path proves exact owned cleanup evidence", async () => {
  const harness = createPhaseDOfflineHarness();
  const transcript = await contextBTranscript();
  const token = issue(harness, transcript.destination, REVIEWED);
  const result = harness.evaluate({ ...transcript, executionAuthorization: token });
  assert.equal(result.status, "PASS");
  assert.equal(result.context, DAILY_GOAL_HISTORY_CONTEXTS.RUN_OWNED_SCHEMA);
  assert.equal(result.pending.length, 12);
  assert.equal(result.verification.cleanupVerified, true);
});

test("spoofed getters and diagnostic payloads cannot become authenticated success", async () => {
  const harness = createPhaseDOfflineHarness();
  const transcript = await contextATranscript();
  const token = issue(harness, transcript.destination, [DAILY]);
  const hostile = { ...transcript, executionAuthorization: token };
  Object.defineProperty(hostile, "applicationEvidence", {
    enumerable: true,
    get() { throw new Error("must-not-leak-sensitive-driver-detail"); },
  });
  assertFailure(() => harness.evaluate(hostile), "UNTRUSTED_EVIDENCE");
});

test("offline module has no environment, network, Prisma, SQL or executable callback path", async () => {
  const source = await readFile(modulePath, "utf8");
  assert.doesNotMatch(source, /process\.env|PrismaClient|\$executeRaw|\$queryRaw|child_process|fetch\s*\(|https?:\/\//);
  assert.doesNotMatch(source, /executeAuthorizedOperation|applyMigration|migrate\s+deploy|CREATE\s+SCHEMA|DROP\s+SCHEMA/i);
  assert.doesNotMatch(source, /function\s+\w+\s*\([^)]*(?:callback|operation)/i);
  assert.match(source, /DAILY_GOAL_OBSERVER_DATABASE_URL/);
  assert.match(source, /CI_TEST_DATABASE_URL/);
});

test("Phase D workflow remains terminally disabled and refusal-only", async () => {
  const workflow = await readFile(workflowPath, "utf8");
  const job = workflow.slice(workflow.indexOf("  daily-goal-migration-verification:"), workflow.indexOf("  integration-summary:"));
  assert.match(job, /inputs\.run_daily_goal_migration_verification == true/);
  assert.match(job, /&&\s*false\s*\n\s*runs-on:/);
  assert.match(job, /Refuse live Phase D until separately authorized/);
  assert.match(job, /exit 1/);
  assert.doesNotMatch(job, /prisma\s+migrate|npm run test:daily-goal-phase-d|DATABASE_URL|CI_TEST_DATABASE_URL/);
});

test("quarantine manifest and artifact integrity remain exact and active copy remains absent", async () => {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const bytes = await readFile(draftPath);
  const { createHash } = await import("node:crypto");
  assert.equal(manifest.activation_status, "NOT AUTHORIZED");
  assert.equal(manifest.database_execution, "NOT RUN");
  assert.equal(manifest.sha256, DAILY_GOAL_MIGRATION.checksum);
  assert.equal(manifest.byte_count, DAILY_GOAL_MIGRATION.byteCount);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), DAILY_GOAL_MIGRATION.checksum);
  await assert.rejects(() => readFile(activeArtifactPath), { code: "ENOENT" });
  assert.match(repositoryRoot, /daily-goal-v1[\\/]$/);
});

function entry(name, checksum) {
  return Object.freeze({ name, checksum });
}

function applied(entries) {
  return entries.map((item) => ({ ...item, status: "APPLIED" }));
}

function issue(harness, destination, pending) {
  return harness.issueFakeExecutionAuthorization({ decision: DECISION, destination, pending });
}

async function contextATranscript() {
  const destination = Object.freeze({
    context: DAILY_GOAL_HISTORY_CONTEXTS.EXISTING_TARGET,
    targetIdentity: TARGET,
    databaseName: "postgres",
    schemaIdentity: "public",
    ownershipEvidence: MARKER,
    explicitPublicWriteApproval: true,
  });
  return baseTranscript({
    destination,
    pending: [DAILY],
    before: applied(BASELINE),
    cleanupEvidence: { status: "NOT_APPLICABLE", targetSchema: null },
  });
}

async function contextBTranscript() {
  const schemaIdentity = "elvocab_daily_goal_run_107_1_deadbeef";
  const ownershipEvidence = "run-owned-marker-v1-107-1-deadbeef";
  const destination = Object.freeze({
    context: DAILY_GOAL_HISTORY_CONTEXTS.RUN_OWNED_SCHEMA,
    targetIdentity: TARGET,
    databaseName: "postgres",
    schemaIdentity,
    ownershipEvidence,
    runOwnership: Object.freeze({
      repository: "Hau-2251220056/EngLish-Vocabulary",
      runId: "107",
      runAttempt: "1",
      schemaIdentity,
      marker: ownershipEvidence,
      fresh: true,
      foreign: false,
    }),
  });
  return baseTranscript({
    destination,
    pending: REVIEWED,
    before: [],
    cleanupEvidence: {
      status: "PASS",
      targetSchema: schemaIdentity,
      ownershipEvidence,
      foreignSchemaTouched: false,
    },
  });
}

async function baseTranscript({ destination, pending, before, cleanupEvidence }) {
  return {
    destination,
    reviewedInventory: REVIEWED,
    preExecutionHistory: before,
    immediateHistory: before.map((item) => ({ ...item })),
    activationBytes: await readFile(draftPath),
    credentialBoundary: {
      principalClass: PRINCIPAL,
      reviewed: true,
      context: destination.context,
      schemaIdentity: destination.schemaIdentity,
    },
    applicationEvidence: { status: "APPLIED", migrations: pending },
    postExecutionHistory: applied(REVIEWED),
    schemaEvidence: {
      status: "PASS",
      complete: true,
      enums: [...DAILY_GOAL_SCHEMA_EVIDENCE.enums],
      columns: [...DAILY_GOAL_SCHEMA_EVIDENCE.columns],
      tables: [...DAILY_GOAL_SCHEMA_EVIDENCE.tables],
      primaryKeys: [...DAILY_GOAL_SCHEMA_EVIDENCE.primaryKeys],
      constraints: [...DAILY_GOAL_SCHEMA_EVIDENCE.constraints],
      indexes: [...DAILY_GOAL_SCHEMA_EVIDENCE.indexes],
      foreignKeys: [...DAILY_GOAL_SCHEMA_EVIDENCE.foreignKeys],
    },
    cleanupEvidence,
  };
}

async function assertContextAMarkerFailure(ownershipEvidence, code) {
  const transcript = await contextATranscript();
  const harness = createPhaseDOfflineHarness();
  assertFailure(() => harness.issueFakeExecutionAuthorization({
    decision: DECISION,
    destination: { ...transcript.destination, ownershipEvidence },
    pending: [DAILY],
  }), code);
}

async function assertSchemaMutationFails(mutate) {
  const transcript = await contextATranscript();
  const schemaEvidence = {
    ...transcript.schemaEvidence,
    enums: [...transcript.schemaEvidence.enums],
    columns: [...transcript.schemaEvidence.columns],
    tables: [...transcript.schemaEvidence.tables],
    primaryKeys: [...transcript.schemaEvidence.primaryKeys],
    constraints: [...transcript.schemaEvidence.constraints],
    indexes: [...transcript.schemaEvidence.indexes],
    foreignKeys: [...transcript.schemaEvidence.foreignKeys],
  };
  mutate(schemaEvidence);
  const harness = createPhaseDOfflineHarness();
  const token = issue(harness, transcript.destination, [DAILY]);
  assertFailure(() => harness.evaluate({ ...transcript, executionAuthorization: token, schemaEvidence }), "SCHEMA_VERIFICATION_FAILED");
}

function replaceCanonical(entries, prefix, from, to) {
  const index = entries.findIndex((entryValue) => entryValue.startsWith(prefix));
  assert.notEqual(index, -1);
  const replacement = [...entries];
  replacement[index] = replacement[index].replace(from, to);
  assert.notEqual(replacement[index], entries[index]);
  return replacement;
}

function assertFailure(operation, code) {
  assert.throws(operation, (error) => {
    assert.equal(error instanceof PhaseDOfflineFailure, true);
    assert.equal(error.code, code);
    assert.equal(error.message, `Daily Goal Phase D offline verification failed. Code: ${code}`);
    assert.doesNotMatch(error.message, /postgresql:|password|secret|migration\.sql/i);
    return true;
  });
}
