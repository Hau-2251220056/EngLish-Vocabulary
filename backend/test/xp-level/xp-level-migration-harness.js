import assert from "node:assert/strict";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import {
  cp,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { configureTestEnvironment } from "../helpers/test-environment.js";
import {
  assertMatchingOwnership,
  assertRunIdentity,
  assertSafeSchemaName,
  buildOwnership,
  buildSchemaName,
  createAndRegisterOwnedSchema,
  discoveryLikePattern,
} from "./xp-level-migration-safety.js";

const XP_MIGRATION = "20261016000000_add_xp_level_v1";
const FORCED_FAILURE = `

-- Harness-only failure injected into a temporary migration copy.
DO $$
BEGIN
    RAISE EXCEPTION 'XP migration harness intentional later-DDL failure';
END
$$;
`;

const backendDirectory = fileURLToPath(new URL("../../", import.meta.url));
const schemaPath = path.join(backendDirectory, "prisma", "schema.prisma");
const migrationsPath = path.join(backendDirectory, "prisma", "migrations");
const productionMigrationPath = path.join(
  migrationsPath,
  XP_MIGRATION,
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
const repositoryIntegrationTest = fileURLToPath(
  new URL("./xp-reward-repository.integration.test.js", import.meta.url),
);
const learningXpIntegrationTest = fileURLToPath(
  new URL("./srs-xp-postgresql.integration.test.js", import.meta.url),
);
const learningRegressionTest = fileURLToPath(
  new URL("../learning/learning.test.js", import.meta.url),
);

let temporaryDirectory;
let databaseUrl;
let runIdentity;
const createdSchemas = [];
const ownedSchemas = new Map();

try {
  ({ databaseUrl, runIdentity } = requireHarnessEnvironment());
  const mode = requireHarnessMode(process.argv.slice(2));
  if (mode === "cleanup") {
    await cleanupCurrentRunSchemas();
    console.log("XP migration harness independent cleanup: PASS");
  } else if (mode === "repository") {
    await runRepositoryVerificationHarness();
  } else if (mode === "learning") {
    await runLearningVerificationHarness();
  } else {
    await runVerificationHarness();
  }
} catch (error) {
  process.exitCode = 1;
  console.error(`XP migration harness: FAIL - ${safeMessage(error)}`);
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
      `XP migration harness cleanup: BLOCKING FAILURE - ${cleanupErrors.join("; ")}`,
    );
  }
}

async function runVerificationHarness() {
  temporaryDirectory = await mkdtemp(
    path.join(os.tmpdir(), "elvocab-xp-migration-"),
  );

  const suffix = randomBytes(4).toString("hex");
  const schemas = Object.freeze({
    capability: buildSchemaName(
      "capability",
      runIdentity.runId,
      runIdentity.attempt,
      suffix,
    ),
    clean: buildSchemaName(
      "clean",
      runIdentity.runId,
      runIdentity.attempt,
      suffix,
    ),
    negative: buildSchemaName(
      "negative",
      runIdentity.runId,
      runIdentity.attempt,
      suffix,
    ),
    rollback: buildSchemaName(
      "rollback",
      runIdentity.runId,
      runIdentity.attempt,
      suffix,
    ),
  });

  await proveSchemaCapability(schemas.capability);
  console.log("XP migration harness capability check: PASS");
  await createHarnessSchema(schemas.clean);
  await createHarnessSchema(schemas.negative);
  await createHarnessSchema(schemas.rollback);

  const baseline = await prepareMigrationCopy("baseline", { includeXp: false });
  const complete = await prepareMigrationCopy("complete", { includeXp: true });
  const rollback = await prepareMigrationCopy("rollback", {
    includeXp: true,
    injectFailure: true,
  });

  await verifyCleanMigration(schemas.clean, baseline, complete);
  console.log("XP clean migration and constraints: PASS");
  await verifyNegativePreflight(schemas.negative, baseline, complete);
  console.log("XP negative preflight rollback: PASS");
  await verifyLaterDdlRollback(schemas.rollback, baseline, rollback);
  console.log("XP later-DDL rollback: PASS");
  console.log("XP migration harness: PASS");
}

async function runRepositoryVerificationHarness() {
  temporaryDirectory = await mkdtemp(
    path.join(os.tmpdir(), "elvocab-xp-repository-"),
  );
  const schemaName = buildSchemaName(
    "repository",
    runIdentity.runId,
    runIdentity.attempt,
    randomBytes(4).toString("hex"),
  );

  await createHarnessSchema(schemaName);
  const complete = await prepareMigrationCopy("repository", { includeXp: true });
  await migrateDeploy(schemaName, complete.configPath);
  await assertPreparedRepositorySchema(schemaName);
  await runRepositoryIntegrationTests(schemaName);
  console.log("XP repository integration harness: PASS");
}

async function runLearningVerificationHarness() {
  temporaryDirectory = await mkdtemp(
    path.join(os.tmpdir(), "elvocab-xp-learning-"),
  );
  const schemaName = buildSchemaName(
    "learning",
    runIdentity.runId,
    runIdentity.attempt,
    randomBytes(4).toString("hex"),
  );

  await createHarnessSchema(schemaName);
  const complete = await prepareMigrationCopy("learning", { includeXp: true });
  await migrateDeploy(schemaName, complete.configPath);
  await assertPreparedRepositorySchema(schemaName);
  await runLearningIntegrationTests(schemaName);
  console.log("XP Learning integration harness: PASS");
}

function requireHarnessEnvironment() {
  if (
    process.env.CI !== "true" ||
    process.env.GITHUB_ACTIONS !== "true" ||
    process.env.XP_MIGRATION_HARNESS_ALLOW !== "true"
  ) {
    throw new Error(
      "CI, GITHUB_ACTIONS and XP_MIGRATION_HARNESS_ALLOW must all equal true.",
    );
  }
  const identity = assertRunIdentity({
    repository: process.env.GITHUB_REPOSITORY ?? "",
    runId: process.env.GITHUB_RUN_ID ?? "",
    attempt: process.env.GITHUB_RUN_ATTEMPT ?? "",
  });
  const configured = configureTestEnvironment({ requireReset: true });
  return { databaseUrl: configured.databaseUrl, runIdentity: identity };
}

function requireHarnessMode(args) {
  if (args.length === 0) {
    return "verify";
  }
  if (args.length === 1 && args[0] === "--cleanup-only") {
    return "cleanup";
  }
  if (args.length === 1 && args[0] === "--repository") {
    return "repository";
  }
  if (args.length === 1 && args[0] === "--learning") {
    return "learning";
  }
  throw new Error("Unsupported XP migration harness arguments.");
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
  const prisma = new PrismaClient({
    datasourceUrl: schemaDatabaseUrl(schemaName),
  });
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
    await prisma.$executeRawUnsafe(
      `DROP SCHEMA "${schemaName}" CASCADE`,
    );
  });
  const index = createdSchemas.indexOf(schemaName);
  if (index >= 0) {
    createdSchemas.splice(index, 1);
  }
  ownedSchemas.delete(schemaName);
}

async function withSchemaClient(schemaName, action) {
  assertSafeSchemaName(schemaName);
  const { PrismaClient } = await import("../../src/generated/prisma/client.ts");
  const prisma = new PrismaClient({
    datasourceUrl: schemaDatabaseUrl(schemaName),
  });
  try {
    await prisma.$connect();
    await assertActiveSchema(prisma, schemaName);
    return await action(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

async function assertActiveSchema(prisma, schemaName) {
  assertSafeSchemaName(schemaName);
  await assertResolvedSchema(prisma, schemaName);
}

async function assertResolvedSchema(prisma, expectedSchema) {
  const [row] = await prisma.$queryRawUnsafe(
    "SELECT current_schema() AS schema_name",
  );
  assert.equal(row?.schema_name, expectedSchema);
}

async function assertDatabaseOwnership(prisma, expectedOwnership) {
  const [row] = await prisma.$queryRawUnsafe(
    "SELECT obj_description(current_schema()::regnamespace, 'pg_namespace') AS ownership_marker",
  );
  assertMatchingOwnership(row?.ownership_marker, expectedOwnership);
}

async function assertPreparedRepositorySchema(schemaName) {
  const ownership = ownedSchemas.get(schemaName);
  assert.ok(ownership, `No ownership record exists for ${schemaName}.`);
  await withSchemaClient(schemaName, async (prisma) => {
    await assertDatabaseOwnership(prisma, ownership);
    const requiredTables = await prisma.$queryRawUnsafe(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema() AND table_name IN ('USER', 'VOCABULARY', 'LEARNING_PROGRESS', 'XP_REWARD') ORDER BY table_name",
    );
    assert.deepEqual(
      requiredTables.map(({ table_name }) => table_name),
      ["LEARNING_PROGRESS", "USER", "VOCABULARY", "XP_REWARD"],
    );
  });
}

async function cleanupCurrentRunSchemas() {
  const { PrismaClient } = await import("../../src/generated/prisma/client.ts");
  const prisma = new PrismaClient({ datasourceUrl: catalogDatabaseUrl() });
  let rows;
  try {
    await prisma.$connect();
    await assertResolvedSchema(prisma, "pg_catalog");
    rows = await prisma.$queryRawUnsafe(
      "SELECT nspname, obj_description(oid, 'pg_namespace') AS ownership_marker FROM pg_namespace WHERE nspname LIKE $1 ESCAPE '\\' ORDER BY nspname",
      discoveryLikePattern(runIdentity.runId, runIdentity.attempt),
    );
  } finally {
    await prisma.$disconnect();
  }

  const verified = rows.map(({ nspname, ownership_marker: marker }) => {
    assertSafeSchemaName(nspname);
    const ownership = ownershipFor(nspname);
    assertMatchingOwnership(marker, ownership);
    return { schemaName: nspname, ownership };
  });

  for (const { schemaName, ownership } of verified) {
    createdSchemas.push(schemaName);
    ownedSchemas.set(schemaName, ownership);
  }
  for (const { schemaName } of [...verified].reverse()) {
    await dropHarnessSchema(schemaName);
  }
}

async function prepareMigrationCopy(name, { includeXp, injectFailure = false }) {
  const root = path.join(temporaryDirectory, name);
  const copiedMigrations = path.join(root, "migrations");
  await cp(migrationsPath, copiedMigrations, {
    recursive: true,
    filter: (source) =>
      includeXp || !source.includes(path.join(migrationsPath, XP_MIGRATION)),
  });

  const sourceSql = await readFile(productionMigrationPath, "utf8");
  const sourceHash = sha256(sourceSql);

  if (includeXp) {
    const copiedMigration = path.join(
      copiedMigrations,
      XP_MIGRATION,
      "migration.sql",
    );
    const copiedSql = await readFile(copiedMigration, "utf8");
    assert.equal(sha256(copiedSql), sourceHash);

    if (injectFailure) {
      const commitMatches = copiedSql.match(/^COMMIT;\s*$/gim) ?? [];
      assert.equal(commitMatches.length, 1);
      const injectedSql = copiedSql.replace(
        /^COMMIT;\s*$/im,
        `${FORCED_FAILURE}\nCOMMIT;`,
      );
      assert.notEqual(injectedSql, copiedSql);
      await writeFile(copiedMigration, injectedSql, "utf8");
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

  assert.equal(
    sha256(await readFile(productionMigrationPath, "utf8")),
    sourceHash,
  );
  return Object.freeze({ configPath, sourceHash });
}

async function verifyCleanMigration(schemaName, baseline, complete) {
  await migrateDeploy(schemaName, baseline.configPath);
  const fixture = await seedLegacyBalances(schemaName, [0, 42, 5250]);
  const before = await readBalances(schemaName);

  await migrateDeploy(schemaName, complete.configPath);
  await migrateStatus(schemaName, complete.configPath);

  assert.deepEqual(await readBalances(schemaName), before);
  await withSchemaClient(schemaName, async (prisma) => {
    assert.equal(await scalarCount(prisma, 'SELECT COUNT(*) FROM "XP_REWARD"'), 0);
    await verifySchemaObjects(prisma);
    await verifyConstraintFailures(prisma, fixture);
    await verifyRetention(prisma, fixture);
  });
  assert.equal(
    sha256(await readFile(productionMigrationPath, "utf8")),
    complete.sourceHash,
  );
}

async function verifyNegativePreflight(schemaName, baseline, complete) {
  await migrateDeploy(schemaName, baseline.configPath);
  await seedLegacyBalances(schemaName, [-1, 9]);
  const before = await readBalances(schemaName);

  assert.equal(await migrateDeploy(schemaName, complete.configPath, true), false);
  assert.deepEqual(await readBalances(schemaName), before);
  await assertXpObjectsAbsent(schemaName);
}

async function verifyLaterDdlRollback(schemaName, baseline, rollback) {
  await migrateDeploy(schemaName, baseline.configPath);
  await seedLegacyBalances(schemaName, [7, 99]);
  const before = await readBalances(schemaName);

  assert.equal(await migrateDeploy(schemaName, rollback.configPath, true), false);
  assert.deepEqual(await readBalances(schemaName), before);
  await assertXpObjectsAbsent(schemaName);
  assert.equal(
    sha256(await readFile(productionMigrationPath, "utf8")),
    rollback.sourceHash,
  );
}

async function seedLegacyBalances(schemaName, balances) {
  const users = balances.map((totalXp) => ({ id: randomUUID(), totalXp }));
  const vocabularyIds = [randomUUID(), randomUUID(), randomUUID()];
  await withSchemaClient(schemaName, async (prisma) => {
    for (const [index, user] of users.entries()) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "USER" ("id", "email", "password_hash", "display_name", "total_xp", "updated_at") VALUES ('${user.id}', 'xp-harness-${user.id}@example.invalid', 'not-a-real-password-hash', 'XP Harness ${index}', ${user.totalXp}, CURRENT_TIMESTAMP)`,
      );
    }
    for (const [index, id] of vocabularyIds.entries()) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "VOCABULARY" ("id", "word", "updated_at") VALUES ('${id}', 'xp-harness-${id}-${index}', CURRENT_TIMESTAMP)`,
      );
    }
  });
  return Object.freeze({ users, vocabularyIds });
}

async function readBalances(schemaName) {
  return withSchemaClient(schemaName, (prisma) =>
    prisma.$queryRawUnsafe(
      'SELECT "id"::text AS id, "total_xp" AS total_xp FROM "USER" ORDER BY "id"',
    ),
  );
}

async function assertXpObjectsAbsent(schemaName) {
  await withSchemaClient(schemaName, async (prisma) => {
    assert.equal(
      await scalarCount(
        prisma,
        `SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = 'XP_REWARD'`,
      ),
      0,
    );
    assert.equal(
      await scalarCount(
        prisma,
        `SELECT COUNT(*) FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = current_schema() AND t.typname = 'XP_REWARD_TYPE'`,
      ),
      0,
    );
    assert.equal(
      await scalarCount(
        prisma,
        `SELECT COUNT(*) FROM pg_constraint WHERE connamespace = current_schema()::regnamespace AND conname = 'USER_total_xp_non_negative'`,
      ),
      0,
    );
    assert.equal(
      await scalarCount(
        prisma,
        `SELECT COUNT(*) FROM "_prisma_migrations" WHERE migration_name = '${XP_MIGRATION}' AND finished_at IS NOT NULL`,
      ),
      0,
    );
  });
}

async function verifySchemaObjects(prisma) {
  const enumLabels = await prisma.$queryRawUnsafe(
    `SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = current_schema() AND t.typname = 'XP_REWARD_TYPE' ORDER BY e.enumsortorder`,
  );
  assert.deepEqual(
    enumLabels.map(({ enumlabel }) => enumlabel),
    ["SRS_INITIAL", "QUIZ_FIRST_CORRECT", "SRS_DUE_REVIEW"],
  );

  const constraints = await prisma.$queryRawUnsafe(
    `SELECT conname, contype, confdeltype, confupdtype FROM pg_constraint WHERE connamespace = current_schema()::regnamespace AND conname IN ('USER_total_xp_non_negative', 'XP_REWARD_xp_amount_positive', 'XP_REWARD_reward_cycle_non_negative', 'XP_REWARD_type_cycle_amount_check', 'XP_REWARD_user_id_fkey', 'XP_REWARD_vocabulary_id_fkey') ORDER BY conname`,
  );
  assert.deepEqual(
    constraints.map(({ conname }) => conname),
    [
      "USER_total_xp_non_negative",
      "XP_REWARD_reward_cycle_non_negative",
      "XP_REWARD_type_cycle_amount_check",
      "XP_REWARD_user_id_fkey",
      "XP_REWARD_vocabulary_id_fkey",
      "XP_REWARD_xp_amount_positive",
    ],
  );
  for (const constraint of constraints.filter(({ contype }) => contype === "f")) {
    assert.equal(constraint.confdeltype, "r");
    assert.equal(constraint.confupdtype, "c");
  }

  const indexes = await prisma.$queryRawUnsafe(
    `SELECT indexname FROM pg_indexes WHERE schemaname = current_schema() AND indexname IN ('XP_REWARD_user_id_vocabulary_id_reward_type_reward_cycle_key', 'XP_REWARD_user_id_source_event_id_key', 'XP_REWARD_vocabulary_id_idx') ORDER BY indexname`,
  );
  assert.equal(indexes.length, 3);
}

async function verifyConstraintFailures(prisma, fixture) {
  const [userA, userB] = fixture.users;
  const [vocabularyA, vocabularyB] = fixture.vocabularyIds;
  const initialEvent = randomUUID();
  await insertReward(prisma, {
    userId: userA.id,
    vocabularyId: vocabularyA,
    type: "SRS_INITIAL",
    cycle: 0,
    eventId: initialEvent,
    amount: 3,
  });

  await expectRejected(() =>
    insertReward(prisma, {
      userId: userA.id,
      vocabularyId: vocabularyA,
      type: "SRS_INITIAL",
      cycle: 0,
      eventId: randomUUID(),
      amount: 3,
    }),
  );
  await expectRejected(() =>
    insertReward(prisma, {
      userId: userA.id,
      vocabularyId: vocabularyB,
      type: "QUIZ_FIRST_CORRECT",
      cycle: 0,
      eventId: initialEvent,
      amount: 3,
    }),
  );
  for (const invalid of [
    { type: "SRS_INITIAL", cycle: 0, amount: 0 },
    { type: "SRS_INITIAL", cycle: -1, amount: 3 },
    { type: "SRS_DUE_REVIEW", cycle: 0, amount: 1 },
    { type: "QUIZ_FIRST_CORRECT", cycle: 0, amount: 1 },
  ]) {
    await expectRejected(() =>
      insertReward(prisma, {
        userId: userB.id,
        vocabularyId: vocabularyB,
        eventId: randomUUID(),
        ...invalid,
      }),
    );
  }
  await expectRejected(() =>
    insertReward(prisma, {
      userId: randomUUID(),
      vocabularyId: vocabularyB,
      type: "SRS_INITIAL",
      cycle: 0,
      eventId: randomUUID(),
      amount: 3,
    }),
  );
  await expectRejected(() =>
    insertReward(prisma, {
      userId: userB.id,
      vocabularyId: randomUUID(),
      type: "SRS_INITIAL",
      cycle: 0,
      eventId: randomUUID(),
      amount: 3,
    }),
  );
  await expectRejected(() =>
    prisma.$executeRawUnsafe(
      `UPDATE "USER" SET "total_xp" = -1 WHERE "id" = '${userA.id}'`,
    ),
  );
}

async function verifyRetention(prisma, fixture) {
  const user = fixture.users[0];
  const rewardOnlyUser = fixture.users[1];
  const vocabularyId = fixture.vocabularyIds[0];
  const rewardOnlyVocabulary = fixture.vocabularyIds[1];
  const setId = randomUUID();
  const itemId = randomUUID();
  const progressId = randomUUID();

  await prisma.$executeRawUnsafe(
    `INSERT INTO "VOCABULARY_SET" ("id", "owner_id", "name", "is_public", "updated_at") VALUES ('${setId}', '${user.id}', 'XP Harness Set', false, CURRENT_TIMESTAMP)`,
  );
  await prisma.$executeRawUnsafe(
    `INSERT INTO "VOCABULARY_SET_ITEM" ("id", "vocabulary_set_id", "vocabulary_id", "position") VALUES ('${itemId}', '${setId}', '${vocabularyId}', 1)`,
  );
  await prisma.$executeRawUnsafe(
    `INSERT INTO "LEARNING_PROGRESS" ("id", "user_id", "vocabulary_id", "status", "updated_at") VALUES ('${progressId}', '${user.id}', '${vocabularyId}', 'LEARNING', CURRENT_TIMESTAMP)`,
  );

  await prisma.$executeRawUnsafe(
    `DELETE FROM "VOCABULARY_SET_ITEM" WHERE "id" = '${itemId}'`,
  );
  await prisma.$executeRawUnsafe(
    `DELETE FROM "VOCABULARY_SET" WHERE "id" = '${setId}'`,
  );
  assert.equal(
    await scalarCount(
      prisma,
      `SELECT COUNT(*) FROM "VOCABULARY" WHERE "id" = '${vocabularyId}'`,
    ),
    1,
  );
  assert.equal(
    await scalarCount(
      prisma,
      `SELECT COUNT(*) FROM "LEARNING_PROGRESS" WHERE "id" = '${progressId}'`,
    ),
    1,
  );
  assert.equal(
    await scalarCount(
      prisma,
      `SELECT COUNT(*) FROM "XP_REWARD" WHERE "user_id" = '${user.id}' AND "vocabulary_id" = '${vocabularyId}'`,
    ),
    1,
  );

  await expectRejected(() =>
    prisma.$executeRawUnsafe(
      `DELETE FROM "VOCABULARY" WHERE "id" = '${vocabularyId}'`,
    ),
  );
  await expectRejected(() =>
    prisma.$executeRawUnsafe(`DELETE FROM "USER" WHERE "id" = '${user.id}'`),
  );

  await insertReward(prisma, {
    userId: rewardOnlyUser.id,
    vocabularyId: rewardOnlyVocabulary,
    type: "QUIZ_FIRST_CORRECT",
    cycle: 0,
    eventId: randomUUID(),
    amount: 3,
  });
  await expectRejected(() =>
    prisma.$executeRawUnsafe(
      `DELETE FROM "VOCABULARY" WHERE "id" = '${rewardOnlyVocabulary}'`,
    ),
  );

  const unreferencedVocabulary = fixture.vocabularyIds[2];
  await prisma.$executeRawUnsafe(
    `DELETE FROM "VOCABULARY" WHERE "id" = '${unreferencedVocabulary}'`,
  );
  assert.equal(
    await scalarCount(
      prisma,
      `SELECT COUNT(*) FROM "VOCABULARY" WHERE "id" = '${unreferencedVocabulary}'`,
    ),
    0,
  );
}

async function insertReward(
  prisma,
  { userId, vocabularyId, type, cycle, eventId, amount },
) {
  await prisma.$executeRawUnsafe(
    `INSERT INTO "XP_REWARD" ("id", "user_id", "vocabulary_id", "reward_type", "reward_cycle", "source_event_id", "xp_amount") VALUES ('${randomUUID()}', '${userId}', '${vocabularyId}', '${type}', ${cycle}, '${eventId}', ${amount})`,
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
  if (expectFailure) {
    assert.notEqual(exitCode, 0);
    return false;
  }
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
  const exitCode = await new Promise((resolve, reject) => {
    const scopedUrl = schemaDatabaseUrl(schemaName);
    const child = spawn(process.execPath, [prismaCli, ...args], {
      cwd: backendDirectory,
      env: {
        ...process.env,
        TEST_DATABASE_URL: scopedUrl,
        DATABASE_URL: scopedUrl,
      },
      stdio: "ignore",
    });
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });
  await withSchemaClient(schemaName, async () => {});
  return exitCode;
}

async function runRepositoryIntegrationTests(schemaName) {
  assertSafeSchemaName(schemaName);
  await withSchemaClient(schemaName, async () => {});
  const scopedUrl = schemaDatabaseUrl(schemaName);
  const exitCode = await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["--test", "--test-concurrency=1", repositoryIntegrationTest],
      {
        cwd: backendDirectory,
        env: {
          ...process.env,
          TEST_DATABASE_URL: scopedUrl,
          DATABASE_URL: scopedUrl,
          XP_REPOSITORY_TEST_SCHEMA: schemaName,
        },
        stdio: "inherit",
      },
    );
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });
  assert.equal(exitCode, 0, "XP repository integration tests failed.");
  await withSchemaClient(schemaName, async () => {});
}

async function runLearningIntegrationTests(schemaName) {
  assertSafeSchemaName(schemaName);
  await withSchemaClient(schemaName, async () => {});
  const scopedUrl = schemaDatabaseUrl(schemaName);
  const exitCode = await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        "--test",
        "--test-concurrency=1",
        learningXpIntegrationTest,
        learningRegressionTest,
      ],
      {
        cwd: backendDirectory,
        env: {
          ...process.env,
          TEST_DATABASE_URL: scopedUrl,
          DATABASE_URL: scopedUrl,
          XP_LEARNING_TEST_SCHEMA: schemaName,
        },
        stdio: "inherit",
      },
    );
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });
  assert.equal(exitCode, 0, "XP Learning integration tests failed.");
  await withSchemaClient(schemaName, async () => {});
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
