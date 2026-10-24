import assert from "node:assert/strict";
import { access, cp, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { assertNotSymbolicLink, withEphemeralMigrationActivation } from "./daily-goal-migration-activation.js";
import { compareMigrationInventory, verifyConnectedTarget } from "./daily-goal-migration-domain.js";
import { orchestrateDailyGoalMigrationPhaseA, readMigrationInventory } from "./daily-goal-migration-harness.js";
import {
  DAILY_GOAL_PHASE_B_FAILURE_CODES,
  getDailyGoalPhaseBFailureCode,
} from "./daily-goal-phase-b-diagnostics.js";

const backendRoot = fileURLToPath(new URL("../../", import.meta.url));
const repositoryRoot = path.dirname(backendRoot);
const manifestPath = path.join(backendRoot, "prisma/migration-drafts/daily-goal-v1/manifest.json");
const activePath = path.join(backendRoot, "prisma/migrations");
const DAILY_NAME = "20261022000000_add_daily_goal_v1";
const DAILY_HASH = "8e468739c3f60693e9ff53d1c3d4107124ac1feaa9d95ac3a665ea8b8c89edb6";
const IDENTITY = "ci-db.example.invalid:5432/elvocab_ci";
const environment = Object.freeze({
  CI: "true", GITHUB_ACTIONS: "true", NODE_ENV: "test",
  DAILY_GOAL_DATABASE_TARGET_CLASS: "CI_EXCLUSIVE",
  CI_TEST_DATABASE_URL: "postgresql://ci_user:offline-fixture@ci-db.example.invalid:5432/elvocab_ci",
  CI_TEST_DATABASE_IDENTITY: IDENTITY,
  DAILY_GOAL_APPROVED_TARGET_IDENTITY: IDENTITY,
  DAILY_GOAL_MIGRATION_ALLOW: "true",
});
const expectedTarget = Object.freeze({
  targetIdentity: IDENTITY, databaseName: "elvocab_ci", serverEndpoint: "10.0.0.8",
  serverPort: "5432", schemaName: "public", ownershipMarker: "elvocab-ci-exclusive-fixture",
});
const observation = Object.freeze({ ...expectedTarget, evidenceSource: "CONNECTED_POSTGRESQL", derivedFromConfiguration: false });

test("connected observation requires independent complete evidence and the approved identity", () => {
  const authorization = { targetIdentity: IDENTITY };
  const bindingToken = Object.freeze({ opaque: true });
  assert.equal(verifyConnectedTarget({ authorization, expected: expectedTarget, observation, targetBindingToken: bindingToken }).targetBindingToken, bindingToken);
  for (const bad of [
    undefined,
    { ...observation, targetIdentity: "other.example.invalid:5432/elvocab_ci" },
    { ...observation, ownershipMarker: "wrong" },
    { ...observation, evidenceSource: "CONFIGURATION" },
    { ...observation, derivedFromConfiguration: true },
  ]) assert.throws(() => verifyConnectedTarget({ authorization, expected: expectedTarget, observation: bad, targetBindingToken: bindingToken }));
  assert.throws(() => verifyConnectedTarget({ authorization, expected: expectedTarget, observation, targetBindingToken: undefined }));
  assert.throws(() => verifyConnectedTarget({ authorization, expected: expectedTarget, observation, targetBindingToken: Object.freeze({ query() {} }) }), failureCode(DAILY_GOAL_PHASE_B_FAILURE_CODES.INTERNAL_EVIDENCE_INVALID));
  assert.throws(() => verifyConnectedTarget({ authorization, expected: expectedTarget, observation, targetBindingToken: Object.freeze({ nested: Object.freeze({ execute() {} }) }) }), failureCode(DAILY_GOAL_PHASE_B_FAILURE_CODES.INTERNAL_EVIDENCE_INVALID));
  const accessorToken = {};
  Object.defineProperty(accessorToken, "value", { get: () => "side-effect" });
  assert.throws(() => verifyConnectedTarget({ authorization, expected: expectedTarget, observation, targetBindingToken: Object.freeze(accessorToken) }), failureCode(DAILY_GOAL_PHASE_B_FAILURE_CODES.INTERNAL_EVIDENCE_INVALID));
  const customPrototypeToken = Object.freeze(Object.create({ query() {} }));
  assert.throws(() => verifyConnectedTarget({ authorization, expected: expectedTarget, observation, targetBindingToken: customPrototypeToken }), failureCode(DAILY_GOAL_PHASE_B_FAILURE_CODES.INTERNAL_EVIDENCE_INVALID));
});

test("connected observation validates diagnostics without treating them as stable identity", () => {
  const authorization = { targetIdentity: IDENTITY };
  const bindingToken = Object.freeze({ opaque: true });
  const changedBackend = { ...observation, serverEndpoint: "2001:db8::8", serverPort: "6543" };
  const result = verifyConnectedTarget({
    authorization, expected: expectedTarget, observation: changedBackend, targetBindingToken: bindingToken,
  });
  assert.equal(result.observation.serverEndpoint, "2001:db8::8");
  assert.equal(result.observation.serverPort, "6543");
  assert.ok(Object.isFrozen(result.observation));

  for (const serverEndpoint of ["10.0.0.8", "2001:db8::8", "::ffff:10.0.0.8"]) {
    assert.doesNotThrow(() => verifyConnectedTarget({
      authorization,
      expected: expectedTarget,
      observation: { ...observation, serverEndpoint },
      targetBindingToken: bindingToken,
    }));
  }

  for (const invalid of [
    { serverEndpoint: "" }, { serverEndpoint: "pooler.example.invalid" },
    { serverEndpoint: "10.0.0.8/32" }, { serverEndpoint: "2001:db8::8/128" },
    { serverEndpoint: null }, { serverPort: "0" }, { serverPort: "65536" },
    { serverPort: "54.32" }, { serverPort: 5432 },
  ]) assert.throws(() => verifyConnectedTarget({
    authorization,
    expected: expectedTarget,
    observation: { ...observation, ...invalid },
    targetBindingToken: bindingToken,
  }));
});

test("connected-target predicates have fixed trusted diagnostics without changing acceptance", () => {
  const bindingToken = Object.freeze({ opaque: true });
  const authorization = { targetIdentity: IDENTITY };
  const cases = [
    {
      code: DAILY_GOAL_PHASE_B_FAILURE_CODES.INTERNAL_EVIDENCE_INVALID,
      input: { targetBindingToken: undefined },
    },
    {
      code: DAILY_GOAL_PHASE_B_FAILURE_CODES.CONNECTED_EVIDENCE_INVALID,
      input: { observation: { ...observation, evidenceSource: "CONFIGURATION" } },
    },
    {
      code: DAILY_GOAL_PHASE_B_FAILURE_CODES.CONNECTED_EVIDENCE_INVALID,
      input: { observation: { ...observation, derivedFromConfiguration: true } },
    },
    {
      code: DAILY_GOAL_PHASE_B_FAILURE_CODES.TARGET_FIELD_INVALID,
      input: { observation: { ...observation, targetIdentity: " invalid" } },
    },
    {
      code: DAILY_GOAL_PHASE_B_FAILURE_CODES.TARGET_IDENTITY_MISMATCH,
      input: { observation: { ...observation, targetIdentity: "other.example.invalid:5432/elvocab_ci" } },
    },
    {
      code: DAILY_GOAL_PHASE_B_FAILURE_CODES.DATABASE_NAME_MISMATCH,
      input: { observation: { ...observation, databaseName: "other_db" } },
    },
    {
      code: DAILY_GOAL_PHASE_B_FAILURE_CODES.SCHEMA_NAME_MISMATCH,
      input: { observation: { ...observation, schemaName: "other_schema" } },
    },
    {
      code: DAILY_GOAL_PHASE_B_FAILURE_CODES.OWNERSHIP_MARKER_MISMATCH,
      input: { observation: { ...observation, ownershipMarker: "other-marker" } },
    },
    {
      code: DAILY_GOAL_PHASE_B_FAILURE_CODES.ENDPOINT_DIAGNOSTIC_INVALID,
      input: { observation: { ...observation, serverEndpoint: "pooler.example.invalid" } },
    },
    {
      code: DAILY_GOAL_PHASE_B_FAILURE_CODES.PORT_DIAGNOSTIC_INVALID,
      input: { observation: { ...observation, serverPort: "54.32" } },
    },
    {
      code: DAILY_GOAL_PHASE_B_FAILURE_CODES.PORT_DIAGNOSTIC_INVALID,
      input: { observation: { ...observation, serverPort: "65536" } },
    },
    {
      code: DAILY_GOAL_PHASE_B_FAILURE_CODES.AUTHORIZATION_CONTINUITY_FAILED,
      input: { authorization: { targetIdentity: "other.example.invalid:5432/elvocab_ci" } },
    },
  ];

  for (const { code, input } of cases) {
    assert.throws(() => verifyConnectedTarget({
      authorization,
      expected: expectedTarget,
      observation,
      targetBindingToken: bindingToken,
      ...input,
    }), failureCode(code));
  }

  assert.doesNotThrow(() => verifyConnectedTarget({
    authorization, expected: expectedTarget, observation, targetBindingToken: bindingToken,
  }));

  for (const field of ["targetIdentity", "databaseName", "schemaName", "ownershipMarker"]) {
    for (const invalidValue of [undefined, ` invalid-${field}`]) {
      assert.throws(() => verifyConnectedTarget({
        authorization,
        expected: expectedTarget,
        observation: { ...observation, [field]: invalidValue },
        targetBindingToken: bindingToken,
      }), failureCode(DAILY_GOAL_PHASE_B_FAILURE_CODES.TARGET_FIELD_INVALID));
    }
  }
});

test("multiple target failures retain the pre-existing deterministic evaluation order", () => {
  const bindingToken = Object.freeze({ opaque: true });
  const authorization = { targetIdentity: "unauthorized.example.invalid:5432/elvocab_ci" };
  const invalid = {
    ...observation,
    targetIdentity: "other.example.invalid:5432/elvocab_ci",
    databaseName: "other_db",
    serverEndpoint: "not-an-ip",
  };

  assert.throws(() => verifyConnectedTarget({
    authorization, expected: expectedTarget, observation: invalid, targetBindingToken: undefined,
  }), failureCode(DAILY_GOAL_PHASE_B_FAILURE_CODES.INTERNAL_EVIDENCE_INVALID));
  assert.throws(() => verifyConnectedTarget({
    authorization,
    expected: expectedTarget,
    observation: { ...invalid, evidenceSource: "CONFIGURATION" },
    targetBindingToken: bindingToken,
  }), failureCode(DAILY_GOAL_PHASE_B_FAILURE_CODES.CONNECTED_EVIDENCE_INVALID));
  assert.throws(() => verifyConnectedTarget({
    authorization, expected: expectedTarget, observation: invalid, targetBindingToken: bindingToken,
  }), failureCode(DAILY_GOAL_PHASE_B_FAILURE_CODES.TARGET_IDENTITY_MISMATCH));
  assert.throws(() => verifyConnectedTarget({
    authorization,
    expected: expectedTarget,
    observation: { ...observation, serverEndpoint: "not-an-ip", serverPort: "0" },
    targetBindingToken: bindingToken,
  }), failureCode(DAILY_GOAL_PHASE_B_FAILURE_CODES.ENDPOINT_DIAGNOSTIC_INVALID));
});

test("migration inventory accepts only an exact approved pending suffix", () => {
  const a = entry("20260101000000_a", "a");
  const b = entry("20260102000000_b", "b");
  const result = compareMigrationInventory({ reviewed: [a, b], target: [{ ...a, status: "APPLIED" }], approvedPending: [b] });
  assert.deepEqual(result.pending, [b]);
  assert.ok(Object.isFrozen(result.pending));
});

test("migration inventory rejects extra pending, approval mismatch and missing history", () => {
  const a = entry("20260101000000_a", "a"); const b = entry("20260102000000_b", "b"); const c = entry("20260103000000_c", "c");
  assert.throws(() => compareMigrationInventory({ reviewed: [a, b], target: [], approvedPending: [b] }), /exactly match/);
  assert.throws(() => compareMigrationInventory({ reviewed: [a, b, c], target: [{ ...a, status: "APPLIED" }, { ...c, status: "APPLIED" }], approvedPending: [b] }), /missing historical/);
  assert.throws(() => compareMigrationInventory({ reviewed: [a, b], target: [{ ...a, status: "APPLIED" }], approvedPending: [] }), /exactly match/);
});

test("migration inventory rejects failed, divergent, unexpected and malformed target state", () => {
  const a = entry("20260101000000_a", "a");
  for (const target of [
    [{ ...a, status: "FAILED" }], [{ ...a, status: "INCOMPLETE" }],
    [{ ...a, checksum: hash("other"), status: "APPLIED" }],
    [{ ...entry("20260101000000_unknown", "x"), status: "APPLIED" }],
    [{ name: "bad", checksum: "no", status: "UNKNOWN" }],
  ]) assert.throws(() => compareMigrationInventory({ reviewed: [a], target, approvedPending: [] }));
});

test("ephemeral activation preserves reviewed bytes and cleans up after success", async () => {
  let workspace;
  const result = await withEphemeralMigrationActivation({ repositoryRoot, manifestPath, operation: async (activation) => {
    workspace = activation.workspace;
    assert.equal(activation.artifact.name, DAILY_NAME);
    assert.equal(activation.artifact.checksum, DAILY_HASH);
    assert.equal((await readFile(activation.destinationPath)).equals(await readFile(path.join(backendRoot, "prisma/migration-drafts/daily-goal-v1", DAILY_NAME, "migration.sql"))), true);
    return "offline-only";
  }});
  assert.equal(result, "offline-only");
  await assert.rejects(() => access(workspace), { code: "ENOENT" });
  await assert.rejects(() => access(path.join(activePath, DAILY_NAME, "migration.sql")), { code: "ENOENT" });
});

test("ephemeral activation cleans up after callback failure", async () => {
  let workspace;
  await assert.rejects(() => withEphemeralMigrationActivation({ repositoryRoot, manifestPath, operation: async (activation) => {
    workspace = activation.workspace; throw new Error("fixture failure");
  }}), /fixture failure/);
  await assert.rejects(() => access(workspace), { code: "ENOENT" });
});

test("activation rejects tampered manifest, missing draft, unsafe path and active conflict", async () => {
  for (const mutate of [
    (manifest) => ({ ...manifest, sha256: "0".repeat(64) }),
    (manifest) => ({ ...manifest, byte_count: manifest.byte_count + 1 }),
    (manifest) => ({ ...manifest, migration_name: "20261022000000_wrong" }),
    (manifest) => ({ ...manifest, quarantined_path: "../escape.sql" }),
    (manifest) => ({ ...manifest, quarantined_path: "backend/prisma/migration-drafts/missing.sql" }),
  ]) await withFixtureRepository(mutate, async ({ root, manifest }) => {
    await assert.rejects(() => withEphemeralMigrationActivation({ repositoryRoot: root, manifestPath: manifest, operation: async () => {} }));
  });
  await withFixtureRepository((manifest) => manifest, async ({ root, manifest }) => {
    await mkdir(path.join(root, "backend/prisma/migrations", DAILY_NAME), { recursive: true });
    await writeFile(path.join(root, "backend/prisma/migrations", DAILY_NAME, "migration.sql"), "conflict");
    await assert.rejects(() => withEphemeralMigrationActivation({ repositoryRoot: root, manifestPath: manifest, operation: async () => {} }), /already exists/);
  });
});

test("activation rejects symbolic-link metadata deterministically", () => {
  assert.throws(() => assertNotSymbolicLink({ isSymbolicLink: () => true }), /Symbolic links/);
  assert.doesNotThrow(() => assertNotSymbolicLink({ isSymbolicLink: () => false }));
  assert.throws(() => assertNotSymbolicLink({}), /metadata/);
});

test("harness invokes the mock executor only after every offline gate succeeds", async () => {
  const historical = await readMigrationInventory(activePath);
  const calls = []; const bindingToken = Object.freeze({ opaque: true });
  const result = await orchestrateDailyGoalMigrationPhaseA({
    environment, repositoryRoot, manifestPath, expectedTarget,
    approvedPending: [{ name: DAILY_NAME, checksum: DAILY_HASH }],
    observeConnectedTarget: async () => { calls.push("observe"); return { observation, targetBindingToken: bindingToken }; },
    readTargetMigrationHistory: async ({ targetBindingToken }) => { calls.push("history"); assert.equal(targetBindingToken, bindingToken); return historical.map((item) => ({ ...item, status: "APPLIED" })); },
    executeAuthorizedOperation: async (verified) => { calls.push("execute"); assert.equal(verified.targetBindingToken, bindingToken); assert.ok(Object.isFrozen(verified)); assert.ok(Object.isFrozen(verified.inventory.pending)); return "mocked"; },
  });
  assert.equal(result, "mocked"); assert.deepEqual(calls, ["observe", "history", "execute"]);
});

test("harness fails closed before executor for authorization, observation, artifact and inventory failures", async () => {
  const historical = await readMigrationInventory(activePath);
  const cases = [
    { environment: { ...environment, CI: undefined } },
    { environment: { ...environment, DATABASE_URL: environment.CI_TEST_DATABASE_URL } },
    { environment: { ...environment, DAILY_GOAL_RESET_ALLOW: "true" } },
    { observeConnectedTarget: async () => { throw new Error("observer failed"); } },
    { observeConnectedTarget: async () => ({ observation: { ...observation, ownershipMarker: "wrong" }, targetBindingToken: Object.freeze({ opaque: true }) }) },
    { approvedPending: [] },
    { readTargetMigrationHistory: async () => [{ ...historical[0], status: "FAILED" }] },
  ];
  for (const override of cases) {
    let executed = false;
    await assert.rejects(() => orchestrateDailyGoalMigrationPhaseA({
      environment, repositoryRoot, manifestPath, expectedTarget,
      approvedPending: [{ name: DAILY_NAME, checksum: DAILY_HASH }],
      observeConnectedTarget: async () => ({ observation, targetBindingToken: Object.freeze({ opaque: true }) }),
      readTargetMigrationHistory: async () => historical.map((item) => ({ ...item, status: "APPLIED" })),
      executeAuthorizedOperation: async () => { executed = true; },
      ...override,
    }));
    assert.equal(executed, false);
  }
});

test("harness requires every boundary callback and has no import-time execution", async () => {
  for (const missing of ["observeConnectedTarget", "readTargetMigrationHistory", "executeAuthorizedOperation"]) {
    const input = { environment, repositoryRoot, manifestPath, expectedTarget, approvedPending: [] };
    input.observeConnectedTarget = async () => ({ observation, targetBindingToken: Object.freeze({ opaque: true }) });
    input.readTargetMigrationHistory = async () => [];
    input.executeAuthorizedOperation = async () => {};
    delete input[missing];
    await assert.rejects(() => orchestrateDailyGoalMigrationPhaseA(input), /callbacks are required/);
  }
});

function entry(name, seed) { return { name, checksum: hash(seed) }; }
function hash(seed) { return (seed.charCodeAt(0).toString(16).padStart(2, "0")).repeat(32); }

function failureCode(expectedCode) {
  return (error) => {
    assert.equal(getDailyGoalPhaseBFailureCode(error), expectedCode);
    assert.equal(error.message, "Daily Goal connected-target verification failed.");
    return true;
  };
}

async function withFixtureRepository(transformManifest, action) {
  const root = await mkdtemp(path.join(os.tmpdir(), "daily-goal-phase-a-fixture-"));
  try {
    await mkdir(path.join(root, "backend/prisma/migrations"), { recursive: true });
    const sourceDraftRoot = path.join(backendRoot, "prisma/migration-drafts/daily-goal-v1");
    const fixtureDraftRoot = path.join(root, "backend/prisma/migration-drafts/daily-goal-v1");
    await cp(sourceDraftRoot, fixtureDraftRoot, { recursive: true });
    const fixtureManifest = path.join(fixtureDraftRoot, "manifest.json");
    const original = JSON.parse(await readFile(fixtureManifest, "utf8"));
    await writeFile(fixtureManifest, JSON.stringify(transformManifest(original)));
    await action({ root, manifest: fixtureManifest, artifact: path.join(fixtureDraftRoot, DAILY_NAME, "migration.sql") });
  } finally { await rm(root, { recursive: true, force: true }); }
}
