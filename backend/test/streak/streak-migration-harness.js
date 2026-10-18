import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { configureTestEnvironment } from "../helpers/test-environment.js";
import {
  assertHarnessAuthorization,
  assertMatchingOwnership,
  assertSafeSchemaName,
  assertUtcCurrentTimestampDefault,
  buildOwnership,
  buildSchemaName,
  collectExactlyOwnedSchemas,
  createAndRegisterOwnedSchema,
  discoveryLikePattern,
  resolveHarnessRunIdentity,
} from "./streak-migration-safety.js";

const STREAK_MIGRATION = "20261017000000_add_streak_v1";
const SRS_RECEIPT_MIGRATION = "20261018000000_add_streak_srs_receipt";
const FORCED_FAILURE = `

-- Harness-only failure injected into a temporary migration copy.
DO $$
BEGIN
    RAISE EXCEPTION 'Streak migration harness intentional later-DDL failure';
END
$$;
`;
const backendDirectory = fileURLToPath(new URL("../../", import.meta.url));
const schemaPath = path.join(backendDirectory, "prisma", "schema.prisma");
const migrationsPath = path.join(backendDirectory, "prisma", "migrations");
const productionMigrationPath = path.join(
  migrationsPath,
  STREAK_MIGRATION,
  "migration.sql",
);
const receiptMigrationPath = path.join(
  migrationsPath,
  SRS_RECEIPT_MIGRATION,
  "migration.sql",
);
const prismaCli = path.join(
  backendDirectory,
  "node_modules",
  "prisma",
  "build",
  "index.js",
);
const prismaConfigModule = new URL(
  "../../node_modules/prisma/config.js",
  import.meta.url,
).href;

let temporaryDirectory;
let databaseUrl;
let runIdentity;
const createdSchemas = [];
const ownedSchemas = new Map();

try {
  const mode = requireHarnessMode(process.argv.slice(2));
  ({ databaseUrl, runIdentity } = requireHarnessEnvironment(mode));
  if (mode === "cleanup") {
    await cleanupCurrentRunSchemas();
    console.log("Streak migration harness independent cleanup: PASS");
  } else {
    await runVerificationHarness();
  }
} catch (error) {
  process.exitCode = 1;
  console.error(`Streak migration harness: FAIL - ${safeMessage(error)}`);
} finally {
  const cleanupErrors = [];
  for (const schemaName of [...createdSchemas].reverse()) {
    try {
      await dropHarnessSchema(schemaName);
    } catch (error) {
      cleanupErrors.push(`${schemaName}: ${safeMessage(error)}`);
    }
  }
  if (temporaryDirectory) {
    try {
      await rm(temporaryDirectory, { recursive: true, force: true });
    } catch (error) {
      cleanupErrors.push(`temporary migration directory: ${safeMessage(error)}`);
    }
  }
  if (cleanupErrors.length > 0) {
    process.exitCode = 1;
    console.error(
      `Streak migration harness cleanup: BLOCKING FAILURE - ${cleanupErrors.join("; ")}`,
    );
  }
}

function requireHarnessEnvironment(mode) {
  assertHarnessAuthorization(process.env);
  const identity = resolveHarnessRunIdentity(process.env, mode);
  const configured = configureTestEnvironment({ requireReset: true });
  return { databaseUrl: configured.databaseUrl, runIdentity: identity };
}

function requireHarnessMode(args) {
  if (args.length === 0) return "verify";
  if (args.length === 1 && args[0] === "--cleanup-only") return "cleanup";
  throw new Error("Unsupported Streak migration harness arguments.");
}

async function runVerificationHarness() {
  temporaryDirectory = await mkdtemp(
    path.join(os.tmpdir(), "elvocab-streak-migration-"),
  );
  const suffix = randomBytes(4).toString("hex");
  const schemas = Object.freeze({
    capability: buildSchemaName(
      "capability",
      runIdentity.runId,
      runIdentity.attempt,
      suffix,
    ),
    clean: buildSchemaName("clean", runIdentity.runId, runIdentity.attempt, suffix),
    rollback: buildSchemaName(
      "rollback",
      runIdentity.runId,
      runIdentity.attempt,
      suffix,
    ),
    baselineRollback: buildSchemaName(
      "rollback",
      runIdentity.runId,
      runIdentity.attempt,
      randomBytes(4).toString("hex"),
    ),
  });

  await proveSchemaCapability(schemas.capability);
  console.log("Streak migration harness capability check: PASS");
  await createHarnessSchema(schemas.clean);
  await createHarnessSchema(schemas.rollback);
  await createHarnessSchema(schemas.baselineRollback);

  const legacy = await prepareMigrationCopy("legacy", {
    includeStreak: false,
    includeReceipt: false,
  });
  const streakBaseline = await prepareMigrationCopy("streak-baseline", {
    includeStreak: true,
    includeReceipt: false,
  });
  const complete = await prepareMigrationCopy("complete", {
    includeStreak: true,
    includeReceipt: true,
  });
  const receiptRollback = await prepareMigrationCopy("receipt-rollback", {
    includeStreak: true,
    includeReceipt: true,
    injectReceiptFailure: true,
  });
  const streakRollback = await prepareMigrationCopy("streak-rollback", {
    includeStreak: true,
    includeReceipt: false,
    injectStreakFailure: true,
  });

  await verifyCleanReceiptMigration(
    schemas.clean,
    legacy,
    streakBaseline,
    complete,
  );
  console.log("Streak receipt delta clean migration, no-backfill and constraints: PASS");
  await verifyReceiptMigrationRollback(
    schemas.rollback,
    legacy,
    streakBaseline,
    receiptRollback,
  );
  console.log("Streak receipt delta rollback: PASS");
  await verifyBaselineStreakRollback(
    schemas.baselineRollback,
    legacy,
    streakRollback,
  );
  console.log("Streak baseline later-DDL rollback: PASS");
  console.log("Streak migration harness: PASS");
}

function schemaDatabaseUrl(schemaName) {
  assertSafeSchemaName(schemaName);
  const url = new URL(databaseUrl);
  url.searchParams.set("schema", schemaName);
  return url.toString();
}

function catalogDatabaseUrl() {
  const url = new URL(databaseUrl);
  url.searchParams.set("schema", "pg_catalog");
  return url.toString();
}

function ownershipFor(schemaName) {
  return buildOwnership({
    repository: runIdentity.repository,
    runId: runIdentity.runId,
    attempt: runIdentity.attempt,
    schemaName,
  });
}

async function proveSchemaCapability(schemaName) {
  await createHarnessSchema(schemaName);
  await dropHarnessSchema(schemaName);
  assert.equal(createdSchemas.includes(schemaName), false);
}

async function createHarnessSchema(schemaName) {
  assertSafeSchemaName(schemaName);
  const ownership = ownershipFor(schemaName);
  const { PrismaClient } = await import("../../src/generated/prisma/client.ts");
  const prisma = new PrismaClient({ datasourceUrl: schemaDatabaseUrl(schemaName) });
  try {
    await prisma.$connect();
    await createAndRegisterOwnedSchema({
      schemaName,
      ownership,
      create: async (name, marker) => {
        await prisma.$transaction(async (transaction) => {
          await transaction.$executeRawUnsafe(`CREATE SCHEMA "${name}"`);
          await transaction.$executeRawUnsafe(
            `COMMENT ON SCHEMA "${name}" IS '${marker}'`,
          );
        });
      },
      register: (name) => {
        createdSchemas.push(name);
        ownedSchemas.set(name, ownership);
      },
      assertActive: () => assertActiveSchema(prisma, schemaName),
    });
  } finally {
    await prisma.$disconnect();
  }
}

async function dropHarnessSchema(schemaName) {
  assertSafeSchemaName(schemaName);
  const ownership = ownedSchemas.get(schemaName);
  assert.ok(ownership, `No ownership record exists for ${schemaName}.`);
  await withSchemaClient(schemaName, async (prisma) => {
    await assertDatabaseOwnership(prisma, ownership);
    await prisma.$executeRawUnsafe(`DROP SCHEMA "${schemaName}" CASCADE`);
  });
  const index = createdSchemas.indexOf(schemaName);
  if (index >= 0) createdSchemas.splice(index, 1);
  ownedSchemas.delete(schemaName);
}

async function withSchemaClient(schemaName, action) {
  assertSafeSchemaName(schemaName);
  const { PrismaClient } = await import("../../src/generated/prisma/client.ts");
  const prisma = new PrismaClient({ datasourceUrl: schemaDatabaseUrl(schemaName) });
  try {
    await prisma.$connect();
    await assertActiveSchema(prisma, schemaName);
    return await action(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

async function assertActiveSchema(prisma, expectedSchema) {
  const [row] = await prisma.$queryRawUnsafe(
    "SELECT current_schema() AS current_schema",
  );
  assert.equal(row.current_schema, expectedSchema);
}

async function assertDatabaseOwnership(prisma, expectedOwnership) {
  const [row] = await prisma.$queryRawUnsafe(
    `SELECT obj_description(n.oid, 'pg_namespace') AS marker FROM pg_namespace n WHERE n.nspname = current_schema()`,
  );
  assertMatchingOwnership(row?.marker, expectedOwnership);
}

async function cleanupCurrentRunSchemas() {
  const { PrismaClient } = await import("../../src/generated/prisma/client.ts");
  const prisma = new PrismaClient({ datasourceUrl: catalogDatabaseUrl() });
  try {
    await prisma.$connect();
    const pattern = discoveryLikePattern(runIdentity.runId, runIdentity.attempt);
    const rows = await prisma.$queryRawUnsafe(
      `SELECT nspname, obj_description(oid, 'pg_namespace') AS marker FROM pg_namespace WHERE nspname LIKE '${pattern}' ESCAPE '\\'`,
    );
    for (const { schemaName, ownership } of collectExactlyOwnedSchemas(
      rows,
      runIdentity,
    )) {
      createdSchemas.push(schemaName);
      ownedSchemas.set(schemaName, ownership);
    }
  } finally {
    await prisma.$disconnect();
  }
}

async function prepareMigrationCopy(
  name,
  {
    includeStreak,
    includeReceipt,
    injectReceiptFailure = false,
    injectStreakFailure = false,
  },
) {
  assert.equal(includeReceipt && !includeStreak, false);
  assert.equal(injectReceiptFailure && !includeReceipt, false);
  assert.equal(injectStreakFailure && !includeStreak, false);
  assert.equal(injectReceiptFailure && injectStreakFailure, false);
  const root = path.join(temporaryDirectory, name);
  const copiedMigrations = path.join(root, "migrations");
  await cp(migrationsPath, copiedMigrations, {
    recursive: true,
    filter: (source) =>
      (includeStreak
        || !source.includes(path.join(migrationsPath, STREAK_MIGRATION)))
      && (includeReceipt
        || !source.includes(path.join(migrationsPath, SRS_RECEIPT_MIGRATION))),
  });

  const sourceSql = await readFile(productionMigrationPath, "utf8");
  const sourceHash = sha256(sourceSql);
  const receiptSourceSql = await readFile(receiptMigrationPath, "utf8");
  const receiptSourceHash = sha256(receiptSourceSql);
  if (includeStreak) {
    const copiedMigration = path.join(
      copiedMigrations,
      STREAK_MIGRATION,
      "migration.sql",
    );
    const copiedSql = await readFile(copiedMigration, "utf8");
    assert.equal(sha256(copiedSql), sourceHash);
    if (injectStreakFailure) {
      const commitMatches = copiedSql.match(/^COMMIT;\s*$/gim) ?? [];
      assert.equal(commitMatches.length, 1);
      const injectedSql = copiedSql.replace(
        /^COMMIT;\s*$/im,
        `${FORCED_FAILURE}\nCOMMIT;`,
      );
      await writeFile(copiedMigration, injectedSql, "utf8");
    }
  }
  if (includeReceipt) {
    const copiedReceiptMigration = path.join(
      copiedMigrations,
      SRS_RECEIPT_MIGRATION,
      "migration.sql",
    );
    const copiedReceiptSql = await readFile(copiedReceiptMigration, "utf8");
    assert.equal(sha256(copiedReceiptSql), receiptSourceHash);
    if (injectReceiptFailure) {
      const commitMatches = copiedReceiptSql.match(/^COMMIT;\s*$/gim) ?? [];
      assert.equal(commitMatches.length, 1);
      const injectedSql = copiedReceiptSql.replace(
        /^COMMIT;\s*$/im,
        `${FORCED_FAILURE}\nCOMMIT;`,
      );
      await writeFile(copiedReceiptMigration, injectedSql, "utf8");
    }
  }

  const configPath = path.join(root, "prisma.config.ts");
  await writeFile(
    configPath,
    [
      `import { defineConfig } from ${JSON.stringify(prismaConfigModule)};`,
      "export default defineConfig({",
      `  schema: ${JSON.stringify(schemaPath)},`,
      `  migrations: { path: ${JSON.stringify(copiedMigrations)} },`,
      '  engine: "classic",',
      '  datasource: { url: process.env.DATABASE_URL },',
      "});",
      "",
    ].join("\n"),
    "utf8",
  );
  assert.equal(sha256(await readFile(productionMigrationPath, "utf8")), sourceHash);
  assert.equal(sha256(await readFile(receiptMigrationPath, "utf8")), receiptSourceHash);
  return Object.freeze({ configPath, sourceHash, receiptSourceHash });
}

async function verifyCleanReceiptMigration(
  schemaName,
  legacy,
  streakBaseline,
  complete,
) {
  await migrateDeploy(schemaName, legacy.configPath);
  const fixture = await seedLegacyFixture(schemaName);
  const legacyBefore = await readLegacySnapshot(schemaName);

  await migrateDeploy(schemaName, streakBaseline.configPath);
  assert.deepEqual(await readLegacySnapshot(schemaName), legacyBefore);
  await seedExistingStreakFixture(schemaName, fixture);
  const beforeReceipt = await readPreReceiptSnapshot(schemaName);

  await migrateDeploy(schemaName, complete.configPath);
  await migrateStatus(schemaName, complete.configPath);

  assert.deepEqual(await readPreReceiptSnapshot(schemaName), beforeReceipt);
  await withSchemaClient(schemaName, async (prisma) => {
    assert.equal(
      await scalarCount(prisma, 'SELECT COUNT(*) FROM "LEARNING_SESSION_SRS_RECEIPT"'),
      0,
    );
    assert.equal(
      await scalarCount(
        prisma,
        `SELECT COUNT(*) FROM "_prisma_migrations" WHERE migration_name = '${STREAK_MIGRATION}' AND finished_at IS NOT NULL`,
      ),
      1,
    );
    assert.equal(
      await scalarCount(
        prisma,
        `SELECT COUNT(*) FROM "_prisma_migrations" WHERE migration_name = '${SRS_RECEIPT_MIGRATION}' AND finished_at IS NOT NULL`,
      ),
      1,
    );
    await verifySchemaObjects(prisma);
    const constraintSessionId = await verifyConstraintFailures(prisma, fixture);
    await verifyDeletionBehavior(prisma, fixture, constraintSessionId);
  });
  assert.equal(sha256(await readFile(productionMigrationPath, "utf8")), complete.sourceHash);
  assert.equal(
    sha256(await readFile(receiptMigrationPath, "utf8")),
    complete.receiptSourceHash,
  );
}

async function verifyReceiptMigrationRollback(
  schemaName,
  legacy,
  streakBaseline,
  receiptRollback,
) {
  await migrateDeploy(schemaName, legacy.configPath);
  const fixture = await seedLegacyFixture(schemaName);
  await migrateDeploy(schemaName, streakBaseline.configPath);
  await seedExistingStreakFixture(schemaName, fixture);
  const beforeReceipt = await readPreReceiptSnapshot(schemaName);
  assert.equal(
    await migrateDeploy(schemaName, receiptRollback.configPath, true),
    false,
  );
  assert.deepEqual(await readPreReceiptSnapshot(schemaName), beforeReceipt);
  await assertReceiptObjectsAbsent(schemaName);
  assert.equal(
    sha256(await readFile(productionMigrationPath, "utf8")),
    receiptRollback.sourceHash,
  );
  assert.equal(
    sha256(await readFile(receiptMigrationPath, "utf8")),
    receiptRollback.receiptSourceHash,
  );
}

async function verifyBaselineStreakRollback(schemaName, legacy, streakRollback) {
  await migrateDeploy(schemaName, legacy.configPath);
  await seedLegacyFixture(schemaName);
  const beforeStreak = await readLegacySnapshot(schemaName);
  assert.equal(
    await migrateDeploy(schemaName, streakRollback.configPath, true),
    false,
  );
  assert.deepEqual(await readLegacySnapshot(schemaName), beforeStreak);
  await assertStreakObjectsAbsent(schemaName);
  assert.equal(
    sha256(await readFile(productionMigrationPath, "utf8")),
    streakRollback.sourceHash,
  );
  assert.equal(
    sha256(await readFile(receiptMigrationPath, "utf8")),
    streakRollback.receiptSourceHash,
  );
}

async function seedLegacyFixture(schemaName) {
  const fixture = Object.freeze({
    userA: randomUUID(),
    userB: randomUUID(),
    vocabularyA: randomUUID(),
    vocabularyB: randomUUID(),
    setId: randomUUID(),
    setItemId: randomUUID(),
    progressId: randomUUID(),
    rewardId: randomUUID(),
  });
  await withSchemaClient(schemaName, async (prisma) => {
    for (const [index, userId] of [fixture.userA, fixture.userB].entries()) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "USER" ("id", "email", "password_hash", "display_name", "total_xp", "updated_at") VALUES ('${userId}', 'streak-harness-${userId}@example.invalid', 'not-a-real-password-hash', 'Streak Harness ${index}', ${index * 42}, CURRENT_TIMESTAMP)`,
      );
    }
    for (const [index, vocabularyId] of [
      fixture.vocabularyA,
      fixture.vocabularyB,
    ].entries()) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "VOCABULARY" ("id", "word", "updated_at") VALUES ('${vocabularyId}', 'streak-harness-${vocabularyId}-${index}', CURRENT_TIMESTAMP)`,
      );
    }
    await prisma.$executeRawUnsafe(
      `INSERT INTO "VOCABULARY_SET" ("id", "owner_id", "name", "is_public", "updated_at") VALUES ('${fixture.setId}', '${fixture.userA}', 'Streak Harness Set', false, CURRENT_TIMESTAMP)`,
    );
    await prisma.$executeRawUnsafe(
      `INSERT INTO "VOCABULARY_SET_ITEM" ("id", "vocabulary_set_id", "vocabulary_id", "position") VALUES ('${fixture.setItemId}', '${fixture.setId}', '${fixture.vocabularyA}', 1)`,
    );
    await prisma.$executeRawUnsafe(
      `INSERT INTO "LEARNING_PROGRESS" ("id", "user_id", "vocabulary_id", "status", "updated_at") VALUES ('${fixture.progressId}', '${fixture.userA}', '${fixture.vocabularyA}', 'LEARNING', CURRENT_TIMESTAMP)`,
    );
    await prisma.$executeRawUnsafe(
      `INSERT INTO "XP_REWARD" ("id", "user_id", "vocabulary_id", "reward_type", "reward_cycle", "source_event_id", "xp_amount") VALUES ('${fixture.rewardId}', '${fixture.userA}', '${fixture.vocabularyA}', 'QUIZ_FIRST_CORRECT', 0, '${randomUUID()}', 3)`,
    );
  });
  return fixture;
}

async function readLegacySnapshot(schemaName) {
  return withSchemaClient(schemaName, async (prisma) => ({
    users: await prisma.$queryRawUnsafe(
      'SELECT "id"::text AS id, "total_xp" AS total_xp FROM "USER" ORDER BY "id"',
    ),
    progress: await prisma.$queryRawUnsafe(
      'SELECT "id"::text AS id, "user_id"::text AS user_id, "vocabulary_id"::text AS vocabulary_id, "status"::text AS status FROM "LEARNING_PROGRESS" ORDER BY "id"',
    ),
    rewards: await prisma.$queryRawUnsafe(
      'SELECT "id"::text AS id, "user_id"::text AS user_id, "vocabulary_id"::text AS vocabulary_id, "reward_type"::text AS reward_type, "reward_cycle", "xp_amount" FROM "XP_REWARD" ORDER BY "id"',
    ),
  }));
}

async function seedExistingStreakFixture(schemaName, fixture) {
  const streakFixture = Object.freeze({
    sessionId: randomUUID(),
    itemId: randomUUID(),
    createOperationId: randomUUID(),
    evidenceEventId: randomUUID(),
    completionEventId: randomUUID(),
    streakDayId: randomUUID(),
  });
  await withSchemaClient(schemaName, async (prisma) => {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "LEARNING_SESSION" ("id", "user_id", "vocabulary_set_id", "set_id_snapshot", "mode", "status", "create_operation_id", "snapshot_size", "created_at", "expires_at", "completed_at", "completion_event_id") VALUES ('${streakFixture.sessionId}', '${fixture.userA}', '${fixture.setId}', '${fixture.setId}', 'NORMAL', 'COMPLETED', '${streakFixture.createOperationId}', 1, '2026-10-15T00:00:00.000'::timestamp, '2026-10-22T00:00:00.000'::timestamp, '2026-10-16T00:00:00.000'::timestamp, '${streakFixture.completionEventId}')`,
    );
    await prisma.$executeRawUnsafe(
      `INSERT INTO "LEARNING_SESSION_ITEM" ("id", "session_id", "vocabulary_id", "position", "evidence", "evidence_event_id", "evidence_at") VALUES ('${streakFixture.itemId}', '${streakFixture.sessionId}', '${fixture.vocabularyA}', 0, 'NORMAL_REVEALED', '${streakFixture.evidenceEventId}', '2026-10-16T00:00:00.000'::timestamp)`,
    );
    await prisma.$executeRawUnsafe(
      `INSERT INTO "STREAK_DAY" ("id", "user_id", "activity_date", "first_session_id", "created_at") VALUES ('${streakFixture.streakDayId}', '${fixture.userA}', '2026-10-16', '${streakFixture.sessionId}', '2026-10-16T00:00:00.000'::timestamp)`,
    );
  });
  return streakFixture;
}

async function readPreReceiptSnapshot(schemaName) {
  return withSchemaClient(schemaName, async (prisma) => ({
    legacy: await readLegacySnapshot(schemaName),
    sessions: await prisma.$queryRawUnsafe(
      'SELECT "id"::text AS id, "user_id"::text AS user_id, "vocabulary_set_id"::text AS vocabulary_set_id, "set_id_snapshot"::text AS set_id_snapshot, "mode"::text AS mode, "status"::text AS status, "create_operation_id"::text AS create_operation_id, "snapshot_size", "created_at"::text AS created_at, "expires_at"::text AS expires_at, "completed_at"::text AS completed_at, "completion_event_id"::text AS completion_event_id FROM "LEARNING_SESSION" ORDER BY "id"',
    ),
    items: await prisma.$queryRawUnsafe(
      'SELECT "id"::text AS id, "session_id"::text AS session_id, "vocabulary_id"::text AS vocabulary_id, "position", "evidence"::text AS evidence, "evidence_event_id"::text AS evidence_event_id, "evidence_at"::text AS evidence_at FROM "LEARNING_SESSION_ITEM" ORDER BY "id"',
    ),
    streakDays: await prisma.$queryRawUnsafe(
      'SELECT "id"::text AS id, "user_id"::text AS user_id, "activity_date"::text AS activity_date, "first_session_id"::text AS first_session_id, "created_at"::text AS created_at FROM "STREAK_DAY" ORDER BY "id"',
    ),
  }));
}

async function assertReceiptObjectsAbsent(schemaName) {
  await withSchemaClient(schemaName, async (prisma) => {
    assert.equal(
      await scalarCount(
        prisma,
        `SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = 'LEARNING_SESSION_SRS_RECEIPT'`,
      ),
      0,
    );
    assert.equal(
      await scalarCount(
        prisma,
        `SELECT COUNT(*) FROM "_prisma_migrations" WHERE migration_name = '${STREAK_MIGRATION}' AND finished_at IS NOT NULL`,
      ),
      1,
    );
    assert.equal(
      await scalarCount(
        prisma,
        `SELECT COUNT(*) FROM "_prisma_migrations" WHERE migration_name = '${SRS_RECEIPT_MIGRATION}' AND finished_at IS NOT NULL`,
      ),
      0,
    );
  });
}

async function assertStreakObjectsAbsent(schemaName) {
  await withSchemaClient(schemaName, async (prisma) => {
    for (const table of ["LEARNING_SESSION", "LEARNING_SESSION_ITEM", "STREAK_DAY"]) {
      assert.equal(
        await scalarCount(
          prisma,
          `SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = '${table}'`,
        ),
        0,
      );
    }
    assert.equal(
      await scalarCount(
        prisma,
        `SELECT COUNT(*) FROM "_prisma_migrations" WHERE migration_name = '${STREAK_MIGRATION}' AND finished_at IS NOT NULL`,
      ),
      0,
    );
  });
}

async function verifySchemaObjects(prisma) {
  const receiptColumns = await prisma.$queryRawUnsafe(
    `SELECT column_name, data_type, udt_name, is_nullable, character_maximum_length, datetime_precision FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'LEARNING_SESSION_SRS_RECEIPT' ORDER BY ordinal_position`,
  );
  assert.deepEqual(receiptColumns, [
    {
      column_name: "event_id", data_type: "uuid", udt_name: "uuid",
      is_nullable: "NO", character_maximum_length: null, datetime_precision: null,
    },
    {
      column_name: "session_item_id", data_type: "uuid", udt_name: "uuid",
      is_nullable: "NO", character_maximum_length: null, datetime_precision: null,
    },
    {
      column_name: "rating", data_type: "character varying", udt_name: "varchar",
      is_nullable: "NO", character_maximum_length: 5, datetime_precision: null,
    },
    {
      column_name: "expected_revision", data_type: "integer", udt_name: "int4",
      is_nullable: "NO", character_maximum_length: null, datetime_precision: null,
    },
    {
      column_name: "accepted_revision", data_type: "integer", udt_name: "int4",
      is_nullable: "NO", character_maximum_length: null, datetime_precision: null,
    },
    {
      column_name: "accepted_at", data_type: "timestamp without time zone", udt_name: "timestamp",
      is_nullable: "NO", character_maximum_length: null, datetime_precision: 3,
    },
  ]);

  const expectedEnums = Object.freeze({
    LEARNING_SESSION_MODE: ["NORMAL", "SRS", "QUIZ"],
    LEARNING_SESSION_STATUS: ["ACTIVE", "COMPLETED"],
    SESSION_ITEM_EVIDENCE: [
      "NORMAL_REVEALED",
      "SRS_HARD",
      "SRS_GOOD",
      "SRS_EASY",
      "QUIZ_CORRECT",
      "QUIZ_INCORRECT",
    ],
  });
  for (const [name, labels] of Object.entries(expectedEnums)) {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = current_schema() AND t.typname = '${name}' ORDER BY e.enumsortorder`,
    );
    assert.deepEqual(rows.map(({ enumlabel }) => enumlabel), labels);
  }

  const constraintNames = [
    "LEARNING_SESSION_snapshot_size_check",
    "LEARNING_SESSION_exact_expiry_check",
    "LEARNING_SESSION_lifecycle_check",
    "LEARNING_SESSION_ITEM_position_check",
    "LEARNING_SESSION_ITEM_evidence_consistency_check",
    "LEARNING_SESSION_user_id_fkey",
    "LEARNING_SESSION_vocabulary_set_id_fkey",
    "LEARNING_SESSION_ITEM_session_id_fkey",
    "STREAK_DAY_user_id_fkey",
    "STREAK_DAY_first_session_id_fkey",
    "LEARNING_SESSION_SRS_RECEIPT_rating_check",
    "LEARNING_SESSION_SRS_RECEIPT_revision_check",
    "LEARNING_SESSION_SRS_RECEIPT_session_item_id_fkey",
  ];
  const constraints = await prisma.$queryRawUnsafe(
    `SELECT conname, contype, confdeltype, confupdtype FROM pg_constraint WHERE connamespace = current_schema()::regnamespace AND conname IN (${constraintNames.map((name) => `'${name}'`).join(",")}) ORDER BY conname`,
  );
  assert.deepEqual(
    constraints.map(({ conname }) => conname),
    [...constraintNames].sort(),
  );
  const fkActions = new Map(
    constraints
      .filter(({ contype }) => contype === "f")
      .map(({ conname, confdeltype, confupdtype }) => [
        conname,
        { delete: confdeltype, update: confupdtype },
      ]),
  );
  assert.deepEqual(fkActions.get("LEARNING_SESSION_user_id_fkey"), {
    delete: "r",
    update: "c",
  });
  assert.deepEqual(fkActions.get("LEARNING_SESSION_vocabulary_set_id_fkey"), {
    delete: "n",
    update: "c",
  });
  assert.deepEqual(fkActions.get("LEARNING_SESSION_ITEM_session_id_fkey"), {
    delete: "c",
    update: "c",
  });
  assert.deepEqual(fkActions.get("STREAK_DAY_user_id_fkey"), {
    delete: "r",
    update: "c",
  });
  assert.deepEqual(fkActions.get("STREAK_DAY_first_session_id_fkey"), {
    delete: "n",
    update: "c",
  });
  assert.deepEqual(
    fkActions.get("LEARNING_SESSION_SRS_RECEIPT_session_item_id_fkey"),
    { delete: "c", update: "c" },
  );

  const expectedIndexes = [
    "LEARNING_SESSION_user_id_create_operation_id_key",
    "LEARNING_SESSION_user_id_completion_event_id_key",
    "LEARNING_SESSION_user_id_status_expires_at_idx",
    "LEARNING_SESSION_vocabulary_set_id_idx",
    "LEARNING_SESSION_ITEM_evidence_event_id_key",
    "LEARNING_SESSION_ITEM_session_id_vocabulary_id_key",
    "LEARNING_SESSION_ITEM_session_id_position_key",
    "STREAK_DAY_user_id_activity_date_key",
    "LEARNING_SESSION_SRS_RECEIPT_session_item_id_accepted_revision_idx",
  ];
  const indexes = await prisma.$queryRawUnsafe(
    `SELECT indexname FROM pg_indexes WHERE schemaname = current_schema() AND indexname IN (${expectedIndexes.map((name) => `'${name}'`).join(",")}) ORDER BY indexname`,
  );
  assert.deepEqual(indexes.map(({ indexname }) => indexname), [...expectedIndexes].sort());

  const defaults = await prisma.$queryRawUnsafe(
    `SELECT table_name, column_default FROM information_schema.columns WHERE table_schema = current_schema() AND column_name = 'created_at' AND table_name IN ('LEARNING_SESSION', 'STREAK_DAY') ORDER BY table_name`,
  );
  assert.equal(defaults.length, 2);
  for (const { column_default: value } of defaults) {
    assertUtcCurrentTimestampDefault(value);
  }
}

async function verifyConstraintFailures(prisma, fixture) {
  const createdAt = "2026-10-17T00:00:00.000";
  const expiresAt = "2026-10-24T00:00:00.000";
  await expectRejected(() =>
    insertSession(prisma, {
      id: randomUUID(),
      userId: fixture.userA,
      setId: fixture.setId,
      snapshotSize: 0,
      createdAt,
      expiresAt,
    }),
  );
  await expectRejected(() =>
    insertSession(prisma, {
      id: randomUUID(),
      userId: fixture.userA,
      setId: fixture.setId,
      snapshotSize: 1,
      createdAt,
      expiresAt: "2026-10-23T23:59:59.999",
    }),
  );

  const sessionId = randomUUID();
  await insertSession(prisma, {
    id: sessionId,
    userId: fixture.userA,
    setId: fixture.setId,
    snapshotSize: 2,
    createdAt,
    expiresAt,
  });
  const firstItemId = await insertItem(prisma, {
    sessionId,
    vocabularyId: fixture.vocabularyA,
    position: 0,
  });
  await insertItem(prisma, {
    sessionId,
    vocabularyId: fixture.vocabularyB,
    position: 1,
  });
  await expectRejected(() =>
    insertItem(prisma, {
      sessionId,
      vocabularyId: randomUUID(),
      position: 10,
    }),
  );

  const receiptEventId = randomUUID();
  await insertSrsReceipt(prisma, {
    eventId: receiptEventId,
    sessionItemId: firstItemId,
    rating: "AGAIN",
    expectedRevision: 0,
    acceptedRevision: 1,
    acceptedAt: createdAt,
  });
  await expectRejected(() => insertSrsReceipt(prisma, {
    eventId: randomUUID(), sessionItemId: firstItemId, rating: "INVALID",
    expectedRevision: 1, acceptedRevision: 2, acceptedAt: createdAt,
  }));
  await expectRejected(() => insertSrsReceipt(prisma, {
    eventId: randomUUID(), sessionItemId: firstItemId, rating: "GOOD",
    expectedRevision: 1, acceptedRevision: 3, acceptedAt: createdAt,
  }));
  await expectRejected(() => insertSrsReceipt(prisma, {
    eventId: receiptEventId, sessionItemId: firstItemId, rating: "AGAIN",
    expectedRevision: 0, acceptedRevision: 1, acceptedAt: createdAt,
  }));
  await expectRejected(() =>
    prisma.$executeRawUnsafe(
      `UPDATE "LEARNING_SESSION_ITEM" SET "evidence" = 'NORMAL_REVEALED' WHERE "session_id" = '${sessionId}' AND "position" = 0`,
    ),
  );

  const evidenceEventId = randomUUID();
  await prisma.$executeRawUnsafe(
    `UPDATE "LEARNING_SESSION_ITEM" SET "evidence" = 'NORMAL_REVEALED', "evidence_event_id" = '${evidenceEventId}', "evidence_at" = '${createdAt}'::timestamp WHERE "session_id" = '${sessionId}' AND "position" = 0`,
  );
  await expectRejected(() =>
    prisma.$executeRawUnsafe(
      `UPDATE "LEARNING_SESSION_ITEM" SET "evidence" = 'NORMAL_REVEALED', "evidence_event_id" = '${evidenceEventId}', "evidence_at" = '${createdAt}'::timestamp WHERE "session_id" = '${sessionId}' AND "position" = 1`,
    ),
  );

  const dayId = randomUUID();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "STREAK_DAY" ("id", "user_id", "activity_date", "first_session_id") VALUES ('${dayId}', '${fixture.userA}', '2026-10-17', '${sessionId}')`,
  );
  await expectRejected(() =>
    prisma.$executeRawUnsafe(
      `INSERT INTO "STREAK_DAY" ("id", "user_id", "activity_date", "first_session_id") VALUES ('${randomUUID()}', '${fixture.userA}', '2026-10-17', '${sessionId}')`,
    ),
  );
  return sessionId;
}

async function verifyDeletionBehavior(prisma, fixture, sessionId) {
  await prisma.$executeRawUnsafe(
    `DELETE FROM "VOCABULARY_SET_ITEM" WHERE "id" = '${fixture.setItemId}'`,
  );
  await prisma.$executeRawUnsafe(
    `DELETE FROM "VOCABULARY_SET" WHERE "id" = '${fixture.setId}'`,
  );
  const [session] = await prisma.$queryRawUnsafe(
    `SELECT "vocabulary_set_id", "set_id_snapshot"::text AS set_id_snapshot FROM "LEARNING_SESSION" WHERE "id" = '${sessionId}'`,
  );
  assert.equal(session.vocabulary_set_id, null);
  assert.equal(session.set_id_snapshot, fixture.setId);
  assert.equal(
    await scalarCount(
      prisma,
      `SELECT COUNT(*) FROM "LEARNING_SESSION_ITEM" WHERE "session_id" = '${sessionId}'`,
    ),
    2,
  );
  const [receipt] = await prisma.$queryRawUnsafe(
    'SELECT "session_item_id"::text AS session_item_id FROM "LEARNING_SESSION_SRS_RECEIPT" LIMIT 1',
  );
  await prisma.$executeRawUnsafe(
    `DELETE FROM "LEARNING_SESSION_ITEM" WHERE "id" = '${receipt.session_item_id}'`,
  );
  assert.equal(
    await scalarCount(prisma, 'SELECT COUNT(*) FROM "LEARNING_SESSION_SRS_RECEIPT"'),
    0,
  );
  await expectRejected(() =>
    prisma.$executeRawUnsafe(`DELETE FROM "USER" WHERE "id" = '${fixture.userA}'`),
  );
}

async function insertSession(
  prisma,
  { id, userId, setId, snapshotSize, createdAt, expiresAt },
) {
  await prisma.$executeRawUnsafe(
    `INSERT INTO "LEARNING_SESSION" ("id", "user_id", "vocabulary_set_id", "set_id_snapshot", "mode", "status", "create_operation_id", "snapshot_size", "created_at", "expires_at") VALUES ('${id}', '${userId}', '${setId}', '${setId}', 'NORMAL', 'ACTIVE', '${randomUUID()}', ${snapshotSize}, '${createdAt}'::timestamp, '${expiresAt}'::timestamp)`,
  );
}

async function insertItem(prisma, { sessionId, vocabularyId, position }) {
  const id = randomUUID();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "LEARNING_SESSION_ITEM" ("id", "session_id", "vocabulary_id", "position") VALUES ('${id}', '${sessionId}', '${vocabularyId}', ${position})`,
  );
  return id;
}

async function insertSrsReceipt(
  prisma,
  { eventId, sessionItemId, rating, expectedRevision, acceptedRevision, acceptedAt },
) {
  await prisma.$executeRawUnsafe(
    `INSERT INTO "LEARNING_SESSION_SRS_RECEIPT" ("event_id", "session_item_id", "rating", "expected_revision", "accepted_revision", "accepted_at") VALUES ('${eventId}', '${sessionItemId}', '${rating}', ${expectedRevision}, ${acceptedRevision}, '${acceptedAt}'::timestamp)`,
  );
}

async function expectRejected(operation) {
  await assert.rejects(operation);
}

async function scalarCount(prisma, sql) {
  const [row] = await prisma.$queryRawUnsafe(sql);
  return Number(row.count);
}

async function migrateDeploy(schemaName, configPath, expectFailure = false) {
  const exitCode = await runPrisma(schemaName, [
    "migrate",
    "deploy",
    "--config",
    configPath,
  ]);
  if (expectFailure) return exitCode === 0;
  assert.equal(exitCode, 0, `Prisma migrate deploy failed for ${schemaName}.`);
  return true;
}

async function migrateStatus(schemaName, configPath) {
  const exitCode = await runPrisma(schemaName, [
    "migrate",
    "status",
    "--config",
    configPath,
  ]);
  assert.equal(exitCode, 0, `Prisma migrate status failed for ${schemaName}.`);
}

async function runPrisma(schemaName, args) {
  assertSafeSchemaName(schemaName);
  await withSchemaClient(schemaName, async () => {});
  const scopedUrl = schemaDatabaseUrl(schemaName);
  const exitCode = await run(process.execPath, [prismaCli, ...args], {
    ...process.env,
    TEST_DATABASE_URL: scopedUrl,
    DATABASE_URL: scopedUrl,
  });
  await withSchemaClient(schemaName, async () => {});
  return exitCode;
}

function run(command, args, environment) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: backendDirectory,
      env: environment,
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function safeMessage(error) {
  const message = error instanceof Error ? error.message : String(error);
  const withoutUrls = message.replace(
    /postgres(?:ql)?:\/\/\S+/gi,
    "<redacted-database-url>",
  );
  return databaseUrl
    ? withoutUrls.replaceAll(databaseUrl, "<redacted-database-url>")
    : withoutUrls;
}
