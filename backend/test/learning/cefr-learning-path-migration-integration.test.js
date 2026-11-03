import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { cp, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createCefrHarness } from "./cefr-learning-path-migration-harness.js";

const enabled = process.env.CEFR_TEST_DATABASE_ALLOW_OPERATION === "true";
const backendRoot = fileURLToPath(new URL("../../", import.meta.url));
const productionPrisma = path.join(backendRoot, "prisma");
const cefrMigration = "20261103000000_add_cefr_learning_path_v1";

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
}

async function assertPassLifecycleAndDeletion(prisma) {
  const fixture = await seedCurriculum(prisma, "pass");
  const createPass = (status = "ACTIVE") => prisma.cEFR_LEARNING_PASS.create({ data: {
    user_id: fixture.userId, vocabulary_set_id: fixture.setId, set_id_snapshot: fixture.setId,
    status, create_operation_id: randomUUID(), snapshot_size: 1,
    ...(status === "COMPLETED" ? { completed_at: new Date(), completion_event_id: randomUUID() } : {}),
    items: { create: [{ vocabulary_id: fixture.vocabularyId, position: 0 }] },
  } });
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
    `INSERT INTO "LEARNING_SESSION" ("id","user_id","vocabulary_set_id","set_id_snapshot","mode","status","create_operation_id","snapshot_size","expires_at")
     VALUES ('${randomUUID()}'::uuid,'${fixture.userId}'::uuid,'${fixture.setId}'::uuid,'${fixture.setId}'::uuid,'NORMAL','ACTIVE','${randomUUID()}'::uuid,1,CURRENT_TIMESTAMP + INTERVAL '1 hour')`,
  );
  return fixture;
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
  return {
    id: randomUUID(), user_id: fixture.userId, vocabulary_set_id: fixture.setId,
    set_id_snapshot: fixture.setId, scope: "SET", mode: "NORMAL", status: "ACTIVE",
    create_operation_id: randomUUID(), snapshot_size: 1, expires_at: new Date(Date.now() + 60_000),
    items: { create: [{ vocabulary_id: fixture.vocabularyId, position: 0 }] },
  };
}
