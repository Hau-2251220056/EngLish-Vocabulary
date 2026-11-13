import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createCefrHarness } from "./cefr-learning-path-migration-harness.js";

const enabled = process.env.CEFR_TEST_DATABASE_ALLOW_OPERATION === "true";
const backendRoot = fileURLToPath(new URL("../../", import.meta.url));
const productionPrisma = path.join(backendRoot, "prisma");
const productionMigrations = path.join(productionPrisma, "migrations");
const prismaConfigModule = new URL("../../node_modules/prisma/config.js", import.meta.url).href;
const cefrMigration = "20261103000000_add_cefr_learning_path_v1";
const cefrV2Migration = "20261112000000_add_cefr_learning_progress_v2";

test("V1 rehearsal config excludes V2 until the explicit upgrade step", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "elvocab-cefr-v2-ordering-"));
  try {
    const rehearsal = await prepareV2UpgradeWorkspace(temporary);
    await assertConfiguredMigrationSet(rehearsal, false);
    await addV2Migration(rehearsal);
    await assertConfiguredMigrationSet(rehearsal, true);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test("guarded CEFR migration, constraints, lifecycle, concurrency, and cleanup", { skip: !enabled, timeout: 180_000 }, async () => {
  const harness = await createCefrHarness();
  const temporary = await mkdtemp(path.join(os.tmpdir(), "elvocab-cefr-integration-"));
  try {
    const clean = await harness.createSchema("clean");
    await harness.deployMigrations(clean);
    await harness.withClient(clean, async (prisma) => {
      await assertCatalog(prisma);
      await assertScopeConstraints(prisma);
      await assertPassLifecycleAndDeletion(prisma);
    });

    const upgrade = await harness.createSchema("upgrade");
    const copiedPrisma = path.join(temporary, "prisma");
    await cp(productionPrisma, copiedPrisma, { recursive: true,
      filter: (source) => !source.includes(path.join("migrations", cefrMigration)) });
    const copiedSchema = path.join(copiedPrisma, "schema.prisma");
    await harness.deployMigrations(upgrade, copiedSchema);
    const legacy = await harness.withClient(upgrade, seedLegacyRows);
    await cp(path.join(productionPrisma, "migrations", cefrMigration),
      path.join(copiedPrisma, "migrations", cefrMigration), { recursive: true });
    await harness.deployMigrations(upgrade, copiedSchema);
    await harness.withClient(upgrade, async (prisma) => {
      assert.equal(await prisma.uSER.count({ where: { id: legacy.userId } }), 1);
      assert.equal(await prisma.vOCABULARY_SET.count({ where: { id: legacy.setId } }), 1);
      assert.equal(await prisma.lEARNING_PROGRESS.count({ where: { user_id: legacy.userId } }), 1);
      assert.equal(await prisma.lEARNING_SESSION.count({ where: { user_id: legacy.userId, scope: "SET" } }), 1);
      assert.equal(await prisma.cEFR_LEARNING_PASS.count({ where: { user_id: legacy.userId } }), 0);
      assert.equal(await prisma.cEFR_LEARNING_PATH_STATE.count({ where: { user_id: legacy.userId } }), 0);
    });
  } finally {
    const cleanupErrors = [];
    await harness.cleanup().catch((error) => cleanupErrors.push(error));
    await rm(temporary, { recursive: true, force: true }).catch((error) => cleanupErrors.push(error));
    assert.equal(cleanupErrors.length, 0, "CEFR integration cleanup is a hard requirement.");
  }
});

test("guarded CEFR V2 upgrade backfills only exact V1 evidence and preserves lifecycle state", { skip: !enabled, timeout: 180_000 }, async () => {
  const harness = await createCefrHarness();
  const temporary = await mkdtemp(path.join(os.tmpdir(), "elvocab-cefr-v2-integration-"));
  try {
    const rehearsal = await prepareV2UpgradeWorkspace(temporary);
    await assertConfiguredMigrationSet(rehearsal, false);

    const upgrade = await harness.createSchema("v2_upgrade");
    await harness.deployMigrationsFromConfig(upgrade, rehearsal.configPath);
    await harness.withClient(upgrade, assertV2NotApplied);
    const fixture = await harness.withClient(upgrade, (prisma) => seedV1Evidence(prisma));
    const rejected = await harness.createSchema("v2_reject");
    await harness.deployMigrationsFromConfig(rejected, rehearsal.configPath);
    await harness.withClient(rejected, assertV2NotApplied);
    const inconsistent = await harness.withClient(rejected, (prisma) => seedV1Evidence(prisma, {
      inconsistentUser: true,
    }));
    await addV2Migration(rehearsal);
    await assertConfiguredMigrationSet(rehearsal, true);
    await harness.deployMigrationsFromConfig(upgrade, rehearsal.configPath);
    await harness.withClient(upgrade, async (prisma) => {
      await assertV2AppliedOnce(prisma);
      const credited = await prisma.cEFR_LEARNING_PASS_ITEM.findMany({
        where: { pass_id: fixture.passId },
        orderBy: { position: "asc" },
      });
      assert.deepEqual(credited.map((item) => item.first_credit_event_id), [
        fixture.earlierEventId,
        fixture.expiredSessionEventId,
        null,
      ]);
      assert.equal(credited[0].first_credit_source, "NORMAL_REVEALED");
      assert.equal(credited[0].first_credit_session_id, fixture.earlierSessionId);
      assert.equal(credited[1].first_credit_session_id, fixture.expiredSessionId);
      assert.equal(
        credited[1].first_credit_accepted_at.toISOString(),
        "2026-10-02T12:00:00.000Z",
      );
      assert.equal(credited[2].first_credit_source, null);
      const expiredSession = await prisma.lEARNING_SESSION.findUniqueOrThrow({
        where: { id: fixture.expiredSessionId },
      });
      assert.equal(expiredSession.status, "ACTIVE");
      assert.equal(expiredSession.created_at.toISOString(), "2026-10-01T00:00:00.000Z");
      assert.equal(expiredSession.expires_at.toISOString(), "2026-10-08T00:00:00.000Z");
      const pass = await prisma.cEFR_LEARNING_PASS.findUniqueOrThrow({ where: { id: fixture.passId } });
      assert.equal(pass.status, "ACTIVE");
      assert.equal(pass.completed_at, null);
      assert.equal(pass.completion_event_id, null);
      const completed = await prisma.cEFR_LEARNING_PASS.findUniqueOrThrow({
        where: { id: fixture.completedPassId },
      });
      assert.equal(completed.status, "COMPLETED");
      assert.equal(completed.completed_at.toISOString(), fixture.completedAt.toISOString());
      assert.equal(completed.completion_event_id, fixture.completionEventId);
      const state = await prisma.cEFR_LEARNING_PATH_STATE.findUniqueOrThrow({
        where: { user_id: fixture.userId },
      });
      assert.equal(state.highest_unlocked_level, "A2");
      assert.equal(state.path_completed_at, null);
    });

    await harness.deployMigrationsExpectFailureFromConfig(rejected, rehearsal.configPath);
    await harness.withClient(rejected, async (prisma) => {
      const pass = await prisma.$queryRawUnsafe(
        `SELECT "status", "completed_at", "completion_event_id" FROM "CEFR_LEARNING_PASS" WHERE "id" = '${inconsistent.passId}'::uuid`,
      );
      assert.deepEqual(pass, [{ status: "ACTIVE", completed_at: null, completion_event_id: null }]);
      const columns = await prisma.$queryRawUnsafe(
        `SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema()
         AND table_name = 'CEFR_LEARNING_PASS_ITEM' AND column_name = 'first_credit_event_id'`,
      );
      assert.equal(columns.length, 0, "Failed migration transaction must roll back additive columns.");
    });
  } finally {
    const cleanupErrors = [];
    await harness.cleanup().catch((error) => cleanupErrors.push(error));
    await rm(temporary, { recursive: true, force: true }).catch((error) => cleanupErrors.push(error));
    assert.equal(cleanupErrors.length, 0, "CEFR V2 integration cleanup is a hard requirement.");
  }
});

async function prepareV2UpgradeWorkspace(temporary) {
  const prismaDirectory = path.join(temporary, "prisma");
  const migrationsDirectory = path.join(prismaDirectory, "migrations");
  await cp(productionPrisma, prismaDirectory, {
    recursive: true,
    filter: (source) => isMigrationThroughV1(source),
  });
  const schemaPath = path.join(prismaDirectory, "schema.prisma");
  const configPath = path.join(temporary, "prisma.config.ts");
  await writeFile(configPath, [
    `import { defineConfig } from ${JSON.stringify(prismaConfigModule)};`,
    "export default defineConfig({",
    `  schema: ${JSON.stringify(schemaPath)},`,
    `  migrations: { path: ${JSON.stringify(migrationsDirectory)} },`,
    '  engine: "classic",',
    '  datasource: { url: process.env.DATABASE_URL },',
    "});",
    "",
  ].join("\n"), "utf8");
  return Object.freeze({ configPath, migrationsDirectory, schemaPath });
}

function isMigrationThroughV1(source) {
  const relative = path.relative(productionMigrations, source);
  if (relative.startsWith("..") || path.isAbsolute(relative) || relative === "") return true;
  const [entry] = relative.split(path.sep);
  return entry === "migration_lock.toml" || entry <= cefrMigration;
}

async function addV2Migration(rehearsal) {
  await cp(
    path.join(productionMigrations, cefrV2Migration),
    path.join(rehearsal.migrationsDirectory, cefrV2Migration),
    { recursive: true },
  );
}

async function assertConfiguredMigrationSet(rehearsal, includesV2) {
  const entries = await readdir(rehearsal.migrationsDirectory);
  assert.equal(entries.includes(cefrMigration), true, "V1 migration must be present.");
  assert.equal(entries.includes(cefrV2Migration), includesV2);
  assert.equal(
    entries.filter((entry) => /^\d{14}_/.test(entry) && entry > cefrMigration && entry !== cefrV2Migration).length,
    0,
    "V1 rehearsal must not include migrations after the approved V1 boundary.",
  );
  const config = await readFile(rehearsal.configPath, "utf8");
  assert.match(config, new RegExp(escapeRegExp(JSON.stringify(rehearsal.migrationsDirectory))));
  assert.match(config, new RegExp(escapeRegExp(JSON.stringify(rehearsal.schemaPath))));
}

async function assertV2NotApplied(prisma) {
  const migrations = await prisma.$queryRawUnsafe(
    `SELECT "migration_name" FROM "_prisma_migrations" WHERE "migration_name" = '${cefrV2Migration}'`,
  );
  assert.equal(migrations.length, 0, "V2 must not be recorded before V1 evidence is seeded.");
  const columns = await prisma.$queryRawUnsafe(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema()
     AND table_name = 'CEFR_LEARNING_PASS_ITEM' AND column_name LIKE 'first_credit_%'`,
  );
  assert.equal(columns.length, 0, "V2 first-credit columns must be absent during V1 seeding.");
}

async function assertV2AppliedOnce(prisma) {
  const migrations = await prisma.$queryRawUnsafe(
    `SELECT "migration_name", "finished_at", "rolled_back_at" FROM "_prisma_migrations"
     WHERE "migration_name" = '${cefrV2Migration}'`,
  );
  assert.equal(migrations.length, 1, "V2 migration must be recorded exactly once.");
  assert.ok(migrations[0].finished_at instanceof Date);
  assert.equal(migrations[0].rolled_back_at, null);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function assertCatalog(prisma) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname=current_schema() AND c.relname IN
      ('CEFR_LEARNING_PASS','CEFR_LEARNING_PASS_ITEM','CEFR_LEARNING_PATH_STATE',
       'CEFR_LEARNING_PASS_active_user_set_key','CEFR_LEARNING_PASS_completed_user_set_key')`,
  );
  assert.deepEqual(new Set(rows.map(({ name }) => name)), new Set([
    "CEFR_LEARNING_PASS", "CEFR_LEARNING_PASS_ITEM", "CEFR_LEARNING_PATH_STATE",
    "CEFR_LEARNING_PASS_active_user_set_key", "CEFR_LEARNING_PASS_completed_user_set_key",
  ]));
}

async function assertScopeConstraints(prisma) {
  const fixture = await seedCurriculum(prisma, "scope");
  const base = sessionData(fixture);
  await prisma.lEARNING_SESSION.create({ data: { ...base, mode: "NORMAL", scope: "SET" } });
  await prisma.lEARNING_SESSION.create({ data: {
    ...base, id: randomUUID(), create_operation_id: randomUUID(), scope: "GLOBAL", mode: "SRS",
    vocabulary_set_id: null, set_id_snapshot: null,
  } });
  await assert.rejects(prisma.lEARNING_SESSION.create({ data: {
    ...base, id: randomUUID(), create_operation_id: randomUUID(), scope: "GLOBAL", mode: "NORMAL",
    vocabulary_set_id: null, set_id_snapshot: null,
  } }));
  await assert.rejects(prisma.lEARNING_SESSION.create({ data: {
    ...base, id: randomUUID(), create_operation_id: randomUUID(), scope: "GLOBAL", mode: "QUIZ",
    vocabulary_set_id: null, set_id_snapshot: null,
  } }));
  const pass = await prisma.cEFR_LEARNING_PASS.create({ data: {
    user_id: fixture.userId,
    vocabulary_set_id: fixture.setId,
    set_id_snapshot: fixture.setId,
    create_operation_id: randomUUID(),
    snapshot_size: 1,
    items: { create: [{ vocabulary_id: fixture.vocabularyId, position: 0 }] },
  } });
  await prisma.lEARNING_SESSION.create({ data: {
    ...base,
    id: randomUUID(),
    create_operation_id: randomUUID(),
    mode: "SRS",
    scope: "SET",
    cefr_learning_pass_id: pass.id,
  } });
  await assert.rejects(prisma.lEARNING_SESSION.create({ data: {
    ...base,
    id: randomUUID(),
    create_operation_id: randomUUID(),
    mode: "QUIZ",
    scope: "SET",
    cefr_learning_pass_id: pass.id,
  } }));
}

async function assertPassLifecycleAndDeletion(prisma) {
  const fixture = await seedCurriculum(prisma, "pass");
  const createPass = (status = "ACTIVE") => {
    const completionTimestamp = status === "COMPLETED" ? new Date() : null;
    return prisma.cEFR_LEARNING_PASS.create({ data: {
      user_id: fixture.userId, vocabulary_set_id: fixture.setId, set_id_snapshot: fixture.setId,
      status, create_operation_id: randomUUID(), snapshot_size: 1,
      ...(status === "COMPLETED" ? { created_at: completionTimestamp, completed_at: completionTimestamp, completion_event_id: randomUUID() } : {}),
      items: { create: [{ vocabulary_id: fixture.vocabularyId, position: 0 }] },
    } });
  };
  const [first, second] = await Promise.allSettled([createPass(), createPass()]);
  assert.equal([first, second].filter(({ status }) => status === "fulfilled").length, 1);
  const active = first.status === "fulfilled" ? first.value : second.value;
  await prisma.cEFR_LEARNING_PASS.update({ where: { id: active.id }, data: { status: "INVALIDATED", invalidated_at: new Date() } });
  await createPass("COMPLETED");
  await assert.rejects(createPass("COMPLETED"));
  await prisma.vOCABULARY_SET.delete({ where: { id: fixture.setId } });
  const retained = await prisma.cEFR_LEARNING_PASS.findMany({ where: { user_id: fixture.userId } });
  assert.equal(retained.length, 2);
  assert.equal(retained.every(({ vocabulary_set_id, set_id_snapshot }) => vocabulary_set_id === null && set_id_snapshot === fixture.setId), true);
}

async function seedLegacyRows(prisma) {
  const fixture = await seedCurriculum(prisma, "legacy");
  await prisma.lEARNING_PROGRESS.create({ data: {
    user_id: fixture.userId, vocabulary_id: fixture.vocabularyId, status: "LEARNING", review_count: 1,
    revision: 1, last_event_id: randomUUID(), last_reviewed_at: new Date(),
  } });
  await prisma.$executeRawUnsafe(
    `WITH session_clock AS (SELECT CURRENT_TIMESTAMP AT TIME ZONE 'UTC' AS created_at)
     INSERT INTO "LEARNING_SESSION" ("id","user_id","vocabulary_set_id","set_id_snapshot","mode","status","create_operation_id","snapshot_size","created_at","expires_at")
     SELECT '${randomUUID()}'::uuid,'${fixture.userId}'::uuid,'${fixture.setId}'::uuid,'${fixture.setId}'::uuid,'NORMAL','ACTIVE','${randomUUID()}'::uuid,1,created_at,created_at + INTERVAL '7 days'
     FROM session_clock`,
  );
  return fixture;
}

async function seedV1Evidence(prisma, { inconsistentUser = false } = {}) {
  const fixture = await seedCurriculum(prisma, `v2-${inconsistentUser ? "bad" : "valid"}`);
  const otherUserId = randomUUID();
  if (inconsistentUser) {
    await prisma.uSER.create({ data: {
      id: otherUserId,
      email: `v2-other-${randomUUID()}@cefr.integration.test`,
      password_hash: "test-only",
      display_name: "CEFR V2 other",
    } });
  }
  const secondVocabularyId = randomUUID();
  const untouchedVocabularyId = randomUUID();
  await prisma.vOCABULARY.createMany({ data: [
    { id: secondVocabularyId, word: `cefr-v2-second-${randomUUID()}` },
    { id: untouchedVocabularyId, word: `cefr-v2-untouched-${randomUUID()}` },
  ] });
  await prisma.vOCABULARY_SET_ITEM.createMany({ data: [
    { vocabulary_set_id: fixture.setId, vocabulary_id: secondVocabularyId, position: 2 },
    { vocabulary_set_id: fixture.setId, vocabulary_id: untouchedVocabularyId, position: 3 },
  ] });

  const passId = randomUUID();
  const passItems = [fixture.vocabularyId, secondVocabularyId, untouchedVocabularyId];
  await prisma.$executeRawUnsafe(
    `INSERT INTO "CEFR_LEARNING_PASS" ("id","user_id","vocabulary_set_id","set_id_snapshot","status","create_operation_id","snapshot_size")
     VALUES ('${passId}'::uuid,'${fixture.userId}'::uuid,'${fixture.setId}'::uuid,'${fixture.setId}'::uuid,'ACTIVE','${randomUUID()}'::uuid,3)`,
  );
  for (const [position, vocabularyId] of passItems.entries()) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "CEFR_LEARNING_PASS_ITEM" ("id","pass_id","vocabulary_id","position")
       VALUES ('${randomUUID()}'::uuid,'${passId}'::uuid,'${vocabularyId}'::uuid,${position})`,
    );
  }
  await prisma.$executeRawUnsafe(
    `INSERT INTO "CEFR_LEARNING_PATH_STATE" ("user_id","highest_unlocked_level","updated_at")
     VALUES ('${fixture.userId}'::uuid,'A2',TIMESTAMP '2026-11-01 00:00:00')`,
  );

  const acceptedAt = "2026-11-02 12:00:00";
  const earlierEventId = "10000000-0000-4000-8000-000000000001";
  const laterEventId = "20000000-0000-4000-8000-000000000002";
  const earlierSessionId = randomUUID();
  const laterSessionId = randomUUID();
  const expiredSessionId = randomUUID();
  const expiredSessionEventId = randomUUID();
  const evidenceUserId = inconsistentUser ? otherUserId : fixture.userId;
  await insertV1Session(prisma, {
    id: earlierSessionId, userId: evidenceUserId, setId: fixture.setId, passId,
    vocabularyId: fixture.vocabularyId, eventId: earlierEventId, acceptedAt,
  });
  if (!inconsistentUser) {
    await insertV1Session(prisma, {
      id: laterSessionId, userId: fixture.userId, setId: fixture.setId, passId,
      vocabularyId: fixture.vocabularyId, eventId: laterEventId, acceptedAt,
    });
    await insertV1Session(prisma, {
      id: expiredSessionId, userId: fixture.userId, setId: fixture.setId, passId,
      vocabularyId: secondVocabularyId, eventId: expiredSessionEventId,
      acceptedAt: "2026-10-02 12:00:00", status: "ACTIVE",
      createdAt: "2026-10-01 00:00:00", expiresAt: "2026-10-08 00:00:00",
    });
    await insertV1Session(prisma, {
      id: randomUUID(), userId: fixture.userId, setId: fixture.setId, passId: null,
      vocabularyId: untouchedVocabularyId, eventId: randomUUID(), acceptedAt,
    });
    await insertV1Session(prisma, {
      id: randomUUID(), userId: fixture.userId, setId: fixture.setId, passId: null,
      vocabularyId: untouchedVocabularyId, eventId: randomUUID(), acceptedAt,
      mode: "SRS", evidence: "SRS_GOOD",
    });
    await insertV1Session(prisma, {
      id: randomUUID(), userId: fixture.userId, setId: fixture.setId, passId: null,
      vocabularyId: untouchedVocabularyId, eventId: randomUUID(), acceptedAt,
      mode: "QUIZ", evidence: "QUIZ_CORRECT",
    });
    await insertV1Session(prisma, {
      id: randomUUID(), userId: fixture.userId, setId: null, passId: null,
      vocabularyId: untouchedVocabularyId, eventId: randomUUID(), acceptedAt,
      scope: "GLOBAL", mode: "SRS", evidence: "SRS_EASY",
    });
  }
  const completed = inconsistentUser ? {} : await seedCompletedV1Pass(prisma, fixture.userId);
  return {
    ...fixture,
    passId,
    earlierEventId,
    earlierSessionId,
    expiredSessionEventId,
    expiredSessionId,
    ...completed,
  };
}

async function seedCompletedV1Pass(prisma, userId) {
  const vocabularyId = randomUUID();
  const setId = randomUUID();
  const topicId = randomUUID();
  const passId = randomUUID();
  const sessionId = randomUUID();
  const evidenceEventId = randomUUID();
  const completionEventId = randomUUID();
  const completedAt = new Date("2026-11-03T00:00:00.000Z");
  await prisma.vOCABULARY.create({ data: {
    id: vocabularyId,
    word: `cefr-v2-completed-${randomUUID()}`,
  } });
  await prisma.tOPIC.create({ data: { id: topicId, name: `CEFR V2 completed ${randomUUID()}` } });
  await prisma.vOCABULARY_SET.create({ data: {
    id: setId,
    topic_id: topicId,
    owner_id: userId,
    name: "CEFR V2 completed history",
    is_public: true,
    cefr_level: "A1",
    items: { create: [{ vocabulary_id: vocabularyId, position: 1 }] },
  } });
  await prisma.$executeRawUnsafe(
    `INSERT INTO "CEFR_LEARNING_PASS" ("id","user_id","vocabulary_set_id","set_id_snapshot","status","create_operation_id","snapshot_size","created_at","completed_at","completion_event_id")
     VALUES ('${passId}'::uuid,'${userId}'::uuid,'${setId}'::uuid,'${setId}'::uuid,'COMPLETED','${randomUUID()}'::uuid,1,TIMESTAMP '2026-11-01 00:00:00',TIMESTAMP '2026-11-03 00:00:00','${completionEventId}'::uuid)`,
  );
  await prisma.$executeRawUnsafe(
    `INSERT INTO "CEFR_LEARNING_PASS_ITEM" ("id","pass_id","vocabulary_id","position")
     VALUES ('${randomUUID()}'::uuid,'${passId}'::uuid,'${vocabularyId}'::uuid,0)`,
  );
  await insertV1Session(prisma, {
    id: sessionId,
    userId,
    setId,
    passId,
    vocabularyId,
    eventId: evidenceEventId,
    acceptedAt: "2026-11-02 00:00:00",
  });
  return { completedPassId: passId, completedAt, completionEventId };
}

async function insertV1Session(prisma, {
  id, userId, setId, passId, vocabularyId, eventId, acceptedAt,
  status = "ACTIVE", createdAt = "2026-11-01 00:00:00", expiresAt = "2026-11-08 00:00:00",
  scope = "SET", mode = "NORMAL", evidence = "NORMAL_REVEALED",
}) {
  const setIdentity = setId ? `'${setId}'::uuid` : "NULL";
  await prisma.$executeRawUnsafe(
    `INSERT INTO "LEARNING_SESSION" ("id","user_id","vocabulary_set_id","set_id_snapshot","scope","mode","status","create_operation_id","snapshot_size","created_at","expires_at","cefr_learning_pass_id")
     VALUES ('${id}'::uuid,'${userId}'::uuid,${setIdentity},${setIdentity},'${scope}','${mode}','${status}','${randomUUID()}'::uuid,1,TIMESTAMP '${createdAt}',TIMESTAMP '${expiresAt}',${passId ? `'${passId}'::uuid` : "NULL"})`,
  );
  await prisma.$executeRawUnsafe(
    `INSERT INTO "LEARNING_SESSION_ITEM" ("id","session_id","vocabulary_id","position","evidence","evidence_event_id","evidence_at")
     VALUES ('${randomUUID()}'::uuid,'${id}'::uuid,'${vocabularyId}'::uuid,0,'${evidence}','${eventId}'::uuid,TIMESTAMP '${acceptedAt}')`,
  );
}

async function seedCurriculum(prisma, suffix) {
  const userId = randomUUID(), vocabularyId = randomUUID(), setId = randomUUID(), topicId = randomUUID();
  await prisma.uSER.create({ data: { id: userId, email: `${suffix}-${randomUUID()}@cefr.integration.test`, password_hash: "test-only", display_name: `CEFR ${suffix}` } });
  await prisma.vOCABULARY.create({ data: { id: vocabularyId, word: `cefr-${suffix}-${randomUUID()}` } });
  await prisma.tOPIC.create({ data: { id: topicId, name: `CEFR ${suffix} ${randomUUID()}` } });
  await prisma.vOCABULARY_SET.create({ data: {
    id: setId, topic_id: topicId, owner_id: userId, name: `CEFR ${suffix}`, is_public: true, cefr_level: "A1",
    items: { create: [{ vocabulary_id: vocabularyId, position: 1 }] },
  } });
  return { userId, vocabularyId, setId };
}

function sessionData(fixture) {
  const createdAt = new Date();
  return {
    id: randomUUID(), user_id: fixture.userId, vocabulary_set_id: fixture.setId,
    set_id_snapshot: fixture.setId, scope: "SET", mode: "NORMAL", status: "ACTIVE",
    create_operation_id: randomUUID(), snapshot_size: 1, created_at: createdAt,
    expires_at: new Date(createdAt.getTime() + 7 * 24 * 60 * 60 * 1000),
    items: { create: [{ vocabulary_id: fixture.vocabularyId, position: 0 }] },
  };
}
