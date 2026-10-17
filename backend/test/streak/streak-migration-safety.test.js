import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  assertHarnessAuthorization,
  assertMatchingOwnership,
  assertRunIdentity,
  assertSafeSchemaName,
  assertUtcCurrentTimestampDefault,
  buildOwnership,
  buildSchemaName,
  collectExactlyOwnedSchemas,
  createAndRegisterOwnedSchema,
  decodeOwnershipMarker,
  discoveryLikePattern,
  encodeOwnershipMarker,
  resolveHarnessRunIdentity,
} from "./streak-migration-safety.js";

const identity = Object.freeze({
  repository: "Hau-2251220056/EngLish-Vocabulary",
  runId: "123456",
  attempt: "2",
});
const databaseApprovedEnvironment = Object.freeze({
  CI: "true",
  GITHUB_ACTIONS: "true",
  STREAK_MIGRATION_HARNESS_ALLOW: "true",
  TEST_DATABASE_URL: "postgresql://user:secret@ci-db.example.invalid:5432/elvocab_ci",
  CI_TEST_DATABASE_IDENTITY: "ci-db.example.invalid:5432/elvocab_ci",
  STREAK_MIGRATION_APPROVED_TARGET_IDENTITY: "ci-db.example.invalid:5432/elvocab_ci",
});
const approvedEnvironment = Object.freeze({
  ...databaseApprovedEnvironment,
  GITHUB_REPOSITORY: identity.repository,
  GITHUB_RUN_ID: identity.runId,
  GITHUB_RUN_ATTEMPT: identity.attempt,
});
const schemaPath = fileURLToPath(new URL("../../prisma/schema.prisma", import.meta.url));
const migrationPath = fileURLToPath(
  new URL(
    "../../prisma/migrations/20261017000000_add_streak_v1/migration.sql",
    import.meta.url,
  ),
);

test("authorization fails closed without every CI-exclusive approval signal", () => {
  for (const key of Object.keys(databaseApprovedEnvironment)) {
    const environment = { ...databaseApprovedEnvironment };
    delete environment[key];
    assert.throws(() => assertHarnessAuthorization(environment));
  }
  assert.throws(() =>
    assertHarnessAuthorization({
      ...databaseApprovedEnvironment,
      STREAK_MIGRATION_APPROVED_TARGET_IDENTITY: "other-db.example.invalid:5432/elvocab_ci",
    }),
  );
  assert.deepEqual(assertHarnessAuthorization(databaseApprovedEnvironment), {
    targetIdentity: "ci-db.example.invalid:5432/elvocab_ci",
    actualIdentity: "ci-db.example.invalid:5432/elvocab_ci",
  });
});

test("UTC timestamp defaults accept only equivalent PostgreSQL representations", () => {
  for (const value of [
    "timezone('UTC'::text, CURRENT_TIMESTAMP)",
    "(CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text)",
  ]) {
    assert.equal(assertUtcCurrentTimestampDefault(value), value);
  }

  for (const value of [
    "timezone('Asia/Ho_Chi_Minh'::text, CURRENT_TIMESTAMP)",
    "timezone('UTC'::text, CURRENT_DATE)",
    "CURRENT_TIMESTAMP",
  ]) {
    assert.throws(() => assertUtcCurrentTimestampDefault(value));
  }
});

test("owned schema identity and marker round-trip exactly", () => {
  const schemaName = buildSchemaName("clean", identity.runId, identity.attempt, "deadbeef");
  const ownership = buildOwnership({ ...identity, schemaName });
  const marker = encodeOwnershipMarker(ownership);

  assert.deepEqual(decodeOwnershipMarker(marker), ownership);
  assert.deepEqual(assertMatchingOwnership(marker, ownership), ownership);
  assert.equal(
    discoveryLikePattern(identity.runId, identity.attempt),
    "elvocab\\_streak\\_%\\_123456\\_2\\_%",
  );
});

test("unsafe schema and run identities are rejected before use", () => {
  assert.throws(() => assertSafeSchemaName("public"));
  assert.throws(() => assertSafeSchemaName("elvocab_streak_clean_123_2_not-hex"));
  assert.throws(() =>
    assertRunIdentity({ repository: "invalid", runId: "123", attempt: "1" }),
  );
});

test("verification uses actual GitHub identity and rejects recovery targets", () => {
  assert.deepEqual(resolveHarnessRunIdentity(approvedEnvironment, "verify"), identity);
  assert.throws(() =>
    resolveHarnessRunIdentity(
      { ...approvedEnvironment, STREAK_CLEANUP_TARGET_RUN_ID: "999" },
      "verify",
    ),
  );
  assert.throws(() =>
    resolveHarnessRunIdentity(
      { ...approvedEnvironment, STREAK_CLEANUP_TARGET_RUN_ATTEMPT: "3" },
      "verify",
    ),
  );
});

test("cleanup requires separate authorization and exact positive-decimal target strings", () => {
  const cleanupEnvironment = {
    ...approvedEnvironment,
    STREAK_MIGRATION_CLEANUP_ALLOW: "true",
    STREAK_CLEANUP_TARGET_RUN_ID: "900719925474099312345",
    STREAK_CLEANUP_TARGET_RUN_ATTEMPT: "7",
  };
  assert.deepEqual(resolveHarnessRunIdentity(cleanupEnvironment, "cleanup"), {
    repository: identity.repository,
    runId: "900719925474099312345",
    attempt: "7",
  });

  for (const key of [
    "STREAK_MIGRATION_CLEANUP_ALLOW",
    "STREAK_CLEANUP_TARGET_RUN_ID",
    "STREAK_CLEANUP_TARGET_RUN_ATTEMPT",
  ]) {
    const environment = { ...cleanupEnvironment };
    delete environment[key];
    assert.throws(() => resolveHarnessRunIdentity(environment, "cleanup"));
  }
  for (const invalid of ["0", "01", "-1", "1.5", "1e3", " 1", "1 ", ""]) {
    assert.throws(() =>
      resolveHarnessRunIdentity(
        { ...cleanupEnvironment, STREAK_CLEANUP_TARGET_RUN_ID: invalid },
        "cleanup",
      ),
    );
  }
});

test("historical cleanup accepts only exact schema and ownership identity", () => {
  const historicalIdentity = Object.freeze({
    repository: identity.repository,
    runId: "900719925474099312345",
    attempt: "7",
  });
  const schemaName = buildSchemaName(
    "rollback",
    historicalIdentity.runId,
    historicalIdentity.attempt,
    "deadbeef",
  );
  const ownership = buildOwnership({ ...historicalIdentity, schemaName });
  const row = { nspname: schemaName, marker: encodeOwnershipMarker(ownership) };

  assert.deepEqual(collectExactlyOwnedSchemas([row], historicalIdentity), [
    { schemaName, ownership },
  ]);
  assert.deepEqual(collectExactlyOwnedSchemas([], historicalIdentity), []);

  const wrongRun = buildOwnership({
    ...historicalIdentity,
    runId: "900719925474099312346",
    schemaName: buildSchemaName(
      "rollback",
      "900719925474099312346",
      historicalIdentity.attempt,
      "deadbeef",
    ),
  });
  assert.throws(() =>
    collectExactlyOwnedSchemas(
      [{ ...row, marker: encodeOwnershipMarker(wrongRun) }],
      historicalIdentity,
    ),
  );
  const wrongAttempt = buildOwnership({
    ...historicalIdentity,
    attempt: "8",
    schemaName: buildSchemaName(
      "rollback",
      historicalIdentity.runId,
      "8",
      "deadbeef",
    ),
  });
  assert.throws(() =>
    collectExactlyOwnedSchemas(
      [{ ...row, marker: encodeOwnershipMarker(wrongAttempt) }],
      historicalIdentity,
    ),
  );
  assert.throws(() =>
    collectExactlyOwnedSchemas(
      [{ ...row, marker: encodeOwnershipMarker({ ...ownership, repository: "other/repo" }) }],
      historicalIdentity,
    ),
  );
});

test("schema collision never registers ownership", async () => {
  const schemaName = buildSchemaName("clean", identity.runId, identity.attempt, "deadbeef");
  const ownership = buildOwnership({ ...identity, schemaName });
  const registered = [];

  await assert.rejects(
    createAndRegisterOwnedSchema({
      schemaName,
      ownership,
      create: async () => {
        throw new Error("schema already exists");
      },
      register: (name) => registered.push(name),
      assertActive: async () => {},
    }),
  );
  assert.deepEqual(registered, []);
});

test("approved schema and migration retain exact Streak persistence contract", async () => {
  const [schema, migration] = await Promise.all([
    readFile(schemaPath, "utf8"),
    readFile(migrationPath, "utf8"),
  ]);

  for (const model of ["LEARNING_SESSION", "LEARNING_SESSION_ITEM", "STREAK_DAY"]) {
    assert.match(schema, new RegExp(`model ${model} \\{`));
    assert.match(migration, new RegExp(`CREATE TABLE "${model}"`));
  }
  assert.equal(
    schema.match(/CURRENT_TIMESTAMP AT TIME ZONE 'UTC'/g)?.length,
    2,
  );
  assert.equal(
    migration.match(/DEFAULT \(CURRENT_TIMESTAMP AT TIME ZONE 'UTC'\)/g)?.length,
    2,
  );
  assert.match(schema, /evidence_event_id String\?\s+@unique @db\.Uuid/);
  assert.match(
    migration,
    /CREATE UNIQUE INDEX "LEARNING_SESSION_ITEM_evidence_event_id_key"/,
  );
  for (const constraint of [
    "LEARNING_SESSION_snapshot_size_check",
    "LEARNING_SESSION_exact_expiry_check",
    "LEARNING_SESSION_lifecycle_check",
    "LEARNING_SESSION_ITEM_position_check",
    "LEARNING_SESSION_ITEM_evidence_consistency_check",
  ]) {
    assert.match(migration, new RegExp(`CONSTRAINT "${constraint}"`));
  }
  assert.doesNotMatch(migration, /INSERT\s+INTO\s+"(?:LEARNING_SESSION|LEARNING_SESSION_ITEM|STREAK_DAY)"/i);
});
