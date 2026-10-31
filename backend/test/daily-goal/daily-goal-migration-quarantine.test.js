import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  assertLifecycleMigrationSql,
  assertLifecycleDraftInventory,
  assertDraftAbsentFromActiveMigrations,
  readAndVerifyQuarantinedArtifact,
  readAndVerifyLifecycleArtifacts,
  verifyQuarantinedArtifact,
  verifyLifecycleManifest,
} from "./daily-goal-migration-quarantine.js";

const backendRoot = fileURLToPath(new URL("../../", import.meta.url));
const repositoryRoot = path.dirname(backendRoot);
const manifestPath = fileURLToPath(new URL("../../prisma/migration-drafts/daily-goal-v1/manifest.json", import.meta.url));
const lifecycleManifestPath = fileURLToPath(new URL("../../prisma/migration-drafts/daily-goal-v1/lifecycle-manifest.json", import.meta.url));
const quarantinePath = fileURLToPath(new URL("../../prisma/migration-drafts/daily-goal-v1/20261022000000_add_daily_goal_v1/migration.sql", import.meta.url));
const activeMigrationsPath = fileURLToPath(new URL("../../prisma/migrations/", import.meta.url));
const dailyGoalDraftsPath = fileURLToPath(new URL("../../prisma/migration-drafts/daily-goal-v1/", import.meta.url));
const originalPath = path.join(activeMigrationsPath, "20261022000000_add_daily_goal_v1", "migration.sql");

const manifest = JSON.parse(await (await import("node:fs/promises")).readFile(manifestPath, "utf8"));
const lifecycleManifest = JSON.parse(await readFile(lifecycleManifestPath, "utf8"));
const lifecycleNames = [
  "20261031000000_add_daily_goal_tracking_expired_status",
  "20261031000001_add_daily_goal_lifecycle_expiry",
];
const lifecycleManifestSha256 = "0f98081807cf15380baaeafa71acd85a0fdb0e956f9ddc6dcf472dbd2d80d574";
const expectedLifecycleArtifacts = [
  {
    migration_name: lifecycleNames[0],
    quarantined_path: `backend/prisma/migration-drafts/daily-goal-v1/${lifecycleNames[0]}/migration.sql`,
    byte_count: 159,
    sha256: "83946b364ab9acefb9dabb1e42e415171b99d05bf6a4d12b0485d76ee8ff0c52",
  },
  {
    migration_name: lifecycleNames[1],
    quarantined_path: `backend/prisma/migration-drafts/daily-goal-v1/${lifecycleNames[1]}/migration.sql`,
    byte_count: 3062,
    sha256: "dabb0febe7ad18eaff8321e07b6cd9b28506c290f6b6e0a71e51d32f48c8ef02",
  },
];

test("Q1 preserves the reviewed migration bytes, digest, size and name", async () => {
  const baseManifestBytes = await readFile(manifestPath);
  assert.equal(
    createHash("sha256").update(baseManifestBytes).digest("hex"),
    "ef3fbff961a998b19efe8b034accacb521a63c92d477ff0a6fd20561a1cbaa00",
  );
  assert.equal(manifest.migration_name, "20261022000000_add_daily_goal_v1");
  assert.equal(manifest.activation_status, "NOT AUTHORIZED");
  assert.equal(manifest.database_execution, "NOT RUN");
  assert.deepEqual(await readAndVerifyQuarantinedArtifact(repositoryRoot, manifest), {
    byteCount: 11487,
    sha256: "8e468739c3f60693e9ff53d1c3d4107124ac1feaa9d95ac3a665ea8b8c89edb6",
  });
});

test("Q2 excludes the draft and aliases from the active migration directory", async () => {
  await assert.rejects(() => import("node:fs/promises").then(({ access }) => access(originalPath)));
  await assertDraftAbsentFromActiveMigrations({
    activeMigrationsPath,
    migrationName: manifest.migration_name,
    quarantinedArtifactPath: quarantinePath,
  });
});

test("Q2 preserves ordered lifecycle follow-ons and their pinned base dependency", async () => {
  const lifecycleManifestBytes = await readFile(lifecycleManifestPath);
  assert.equal(
    createHash("sha256").update(lifecycleManifestBytes).digest("hex"),
    lifecycleManifestSha256,
  );
  await assertLifecycleDraftInventory(dailyGoalDraftsPath, [manifest.migration_name, ...lifecycleNames]);
  assert.deepEqual(
    verifyLifecycleManifest(lifecycleManifest, manifest, expectedLifecycleArtifacts)
      .map((artifact) => artifact.migration_name),
    lifecycleNames,
  );
  assert.deepEqual(
    (await readAndVerifyLifecycleArtifacts(repositoryRoot, lifecycleManifest, manifest, expectedLifecycleArtifacts))
      .map((artifact) => artifact.migrationName),
    lifecycleNames,
  );
});

test("Q2 excludes both lifecycle follow-ons and aliases from active migration discovery", async () => {
  for (const artifact of lifecycleManifest.artifacts) {
    const draftPath = path.join(repositoryRoot, ...artifact.quarantined_path.split("/"));
    const activePath = path.join(activeMigrationsPath, artifact.migration_name, "migration.sql");
    await assert.rejects(() => import("node:fs/promises").then(({ access }) => access(activePath)));
    await assertDraftAbsentFromActiveMigrations({
      activeMigrationsPath,
      migrationName: artifact.migration_name,
      quarantinedArtifactPath: draftPath,
    });
  }
});

test("Q2 rejects missing, extra, reordered and digest-divergent lifecycle artifacts", () => {
  assert.throws(() => verifyLifecycleManifest({
    ...lifecycleManifest,
    artifacts: lifecycleManifest.artifacts.slice(0, 1),
  }, manifest, expectedLifecycleArtifacts), /inventory mismatch/);
  assert.throws(() => verifyLifecycleManifest({
    ...lifecycleManifest,
    artifacts: [...lifecycleManifest.artifacts, lifecycleManifest.artifacts[0]],
  }, manifest, expectedLifecycleArtifacts), /inventory mismatch/);
  assert.throws(() => verifyLifecycleManifest({
    ...lifecycleManifest,
    artifacts: [...lifecycleManifest.artifacts].reverse(),
  }, manifest, expectedLifecycleArtifacts), /order mismatch/);
  const bytes = Buffer.from("lifecycle fixture", "utf8");
  assert.throws(() => verifyQuarantinedArtifact(bytes, {
    ...lifecycleManifest.artifacts[0],
    byte_count: bytes.length,
    sha256: "0".repeat(64),
  }), /integrity mismatch/);
});

test("Q2 rejects lifecycle manifest tampering and coordinated SQL/manifest identity changes", () => {
  const tamperedManifestBytes = Buffer.from(JSON.stringify({
    ...lifecycleManifest,
    verification_status: "TAMPERED",
  }));
  assert.notEqual(
    createHash("sha256").update(tamperedManifestBytes).digest("hex"),
    lifecycleManifestSha256,
  );
  assert.throws(() => verifyLifecycleManifest({
    ...lifecycleManifest,
    activation_status: "AUTHORIZED",
  }, manifest, expectedLifecycleArtifacts), /authorization boundary mismatch/);
  const changedBytes = Buffer.from("coordinated replacement", "utf8");
  const changedArtifact = {
    ...lifecycleManifest.artifacts[0],
    byte_count: changedBytes.length,
    sha256: createHash("sha256").update(changedBytes).digest("hex"),
  };
  assert.deepEqual(verifyQuarantinedArtifact(changedBytes, changedArtifact), {
    byteCount: changedBytes.length,
    sha256: changedArtifact.sha256,
  });
  assert.throws(() => verifyLifecycleManifest({
    ...lifecycleManifest,
    artifacts: [changedArtifact, lifecycleManifest.artifacts[1]],
  }, manifest, expectedLifecycleArtifacts), /reviewed identity mismatch/);
  assert.throws(() => verifyLifecycleManifest({
    ...lifecycleManifest,
    artifacts: [{
      ...lifecycleManifest.artifacts[0],
      quarantined_path: "backend/prisma/migration-drafts/daily-goal-v1/../escape/migration.sql",
    }, lifecycleManifest.artifacts[1]],
  }, manifest, expectedLifecycleArtifacts), /traversal is prohibited/);
  assert.throws(() => verifyLifecycleManifest({
    ...lifecycleManifest,
    artifacts: [{
      ...lifecycleManifest.artifacts[0],
      quarantined_path: `backend\\prisma\\migration-drafts\\daily-goal-v1\\${lifecycleNames[0]}\\migration.sql`,
    }, lifecycleManifest.artifacts[1]],
  }, manifest, expectedLifecycleArtifacts), /path is malformed/);
});

test("Q2 rejects an extra physical lifecycle draft directory", async () => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "daily-goal-lifecycle-inventory-"));
  try {
    for (const name of [manifest.migration_name, ...lifecycleNames, "unexpected_lifecycle_artifact"]) {
      await mkdir(path.join(temporaryRoot, name));
    }
    await assert.rejects(
      () => assertLifecycleDraftInventory(temporaryRoot, [manifest.migration_name, ...lifecycleNames]),
      /draft inventory mismatch/,
    );
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("Q2 lifecycle SQL is enum-only first and data-free additive schema second", async () => {
  const [enumSql, lifecycleSql] = await Promise.all(lifecycleManifest.artifacts.map(async (artifact) => (
    readFile(path.join(repositoryRoot, ...artifact.quarantined_path.split("/")), "utf8")
  )));
  assert.doesNotThrow(() => assertLifecycleMigrationSql(enumSql, lifecycleSql));
  for (const changedSql of [
    lifecycleSql.replace('ADD CONSTRAINT "DAILY_GOAL_MONITOR_SESSION_terminal_check"',
      'ADD CONSTRAINT "DAILY_GOAL_MONITOR_SESSION_terminal_check_omitted"'),
    lifecycleSql.replace('CREATE INDEX "DAILY_GOAL_TRACKING_SESSION_status_paused_at_id_idx"',
      'CREATE INDEX "DAILY_GOAL_TRACKING_SESSION_status_paused_at_id_idx_omitted"'),
    lifecycleSql.replace('ADD COLUMN "paused_at" TIMESTAMP(3) WITH TIME ZONE',
      'ADD COLUMN "paused_at" TIMESTAMP WITH TIME ZONE'),
    `${lifecycleSql}\nCREATE TABLE "UNAPPROVED" ("id" UUID);\n`,
    lifecycleSql.replace("BEGIN;", "COMMIT;").replace(/COMMIT;\s*$/, "BEGIN;"),
  ]) {
    assert.throws(
      () => assertLifecycleMigrationSql(enumSql, changedSql),
      /differs from the approved SQL structure/,
    );
  }
  assert.throws(
    () => assertLifecycleMigrationSql(`${enumSql}\nCREATE TYPE "UNAPPROVED" AS ENUM ('VALUE');`, lifecycleSql),
    /unexpected statement/,
  );
});

test("Q2 rejects linked lifecycle artifact files", async (context) => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "daily-goal-linked-draft-"));
  try {
    const migrationName = lifecycleNames[0];
    const quarantineRoot = path.join(temporaryRoot, "backend/prisma/migration-drafts/daily-goal-v1");
    const migrationDirectory = path.join(quarantineRoot, migrationName);
    const outsideDirectory = path.join(temporaryRoot, "outside");
    await mkdir(migrationDirectory, { recursive: true });
    await mkdir(outsideDirectory, { recursive: true });
    const outsideFile = path.join(outsideDirectory, "migration.sql");
    await writeFile(outsideFile, "linked", "utf8");
    const fixtureManifest = {
      migration_name: migrationName,
      quarantined_path: `backend/prisma/migration-drafts/daily-goal-v1/${migrationName}/migration.sql`,
      byte_count: 6,
      sha256: createHash("sha256").update("linked").digest("hex"),
    };
    try {
      await symlink(outsideFile, path.join(migrationDirectory, "migration.sql"), "file");
    } catch (error) {
      if (error?.code === "EPERM") {
        context.skip("File symlink creation is unavailable on this Windows host.");
        return;
      }
      throw error;
    }
    await assert.rejects(
      () => readAndVerifyQuarantinedArtifact(temporaryRoot, fixtureManifest),
      /regular unlinked file/,
    );
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("Q2 rejects linked lifecycle artifact directories", async () => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "daily-goal-linked-directory-"));
  try {
    const migrationName = lifecycleNames[0];
    const quarantineRoot = path.join(temporaryRoot, "backend/prisma/migration-drafts/daily-goal-v1");
    const migrationDirectory = path.join(quarantineRoot, migrationName);
    const outsideDirectory = path.join(temporaryRoot, "outside");
    await mkdir(quarantineRoot, { recursive: true });
    await mkdir(outsideDirectory, { recursive: true });
    await writeFile(path.join(outsideDirectory, "migration.sql"), "linked", "utf8");
    await symlink(outsideDirectory, migrationDirectory, process.platform === "win32" ? "junction" : "dir");
    await assert.rejects(
      () => readAndVerifyQuarantinedArtifact(temporaryRoot, {
        migration_name: migrationName,
        quarantined_path: `backend/prisma/migration-drafts/daily-goal-v1/${migrationName}/migration.sql`,
        byte_count: 6,
        sha256: createHash("sha256").update("linked").digest("hex"),
      }),
      /directory must not be linked/,
    );
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("Q2 rejects active aliases equal to or above a quarantined artifact directory", async () => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "daily-goal-active-alias-"));
  try {
    const fixtureActive = path.join(temporaryRoot, "active");
    const fixtureDraftRoot = path.join(temporaryRoot, "draft");
    const fixtureDraft = path.join(fixtureDraftRoot, lifecycleNames[0], "migration.sql");
    await mkdir(fixtureActive, { recursive: true });
    await mkdir(path.dirname(fixtureDraft), { recursive: true });
    await writeFile(fixtureDraft, "fixture", "utf8");
    await symlink(
      path.dirname(fixtureDraft),
      path.join(fixtureActive, "direct-alias"),
      process.platform === "win32" ? "junction" : "dir",
    );
    await assert.rejects(() => assertDraftAbsentFromActiveMigrations({
      activeMigrationsPath: fixtureActive,
      migrationName: lifecycleNames[0],
      quarantinedArtifactPath: fixtureDraft,
    }), /aliases the quarantined migration/);
    await rm(path.join(fixtureActive, "direct-alias"), { recursive: true, force: true });
    await symlink(
      fixtureDraftRoot,
      path.join(fixtureActive, "parent-alias"),
      process.platform === "win32" ? "junction" : "dir",
    );
    await assert.rejects(() => assertDraftAbsentFromActiveMigrations({
      activeMigrationsPath: fixtureActive,
      migrationName: lifecycleNames[0],
      quarantinedArtifactPath: fixtureDraft,
    }), /aliases the quarantined migration/);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("Q3 Prisma and XP/Streak harnesses discover only the active migrations path", async () => {
  const { readFile } = await import("node:fs/promises");
  const [config, xpHarness, streakHarness] = await Promise.all([
    readFile(path.join(backendRoot, "prisma.config.ts"), "utf8"),
    readFile(path.join(backendRoot, "test/xp-level/xp-level-migration-harness.js"), "utf8"),
    readFile(path.join(backendRoot, "test/streak/streak-migration-harness.js"), "utf8"),
  ]);
  assert.match(config, /migrations:\s*\{\s*path:\s*"prisma\/migrations"/s);
  assert.doesNotMatch(config, /migration-drafts/);
  for (const source of [xpHarness, streakHarness]) {
    assert.match(source, /path\.join\(backendDirectory,\s*"prisma",\s*"migrations"\)/s);
    assert.doesNotMatch(source, /migration-drafts|daily-goal-v1/);
  }
});

test("Q4 shared preparation uses normal Prisma discovery and quarantine code cannot execute commands", async () => {
  const { readFile } = await import("node:fs/promises");
  const [preparation, quarantineHelper] = await Promise.all([
    readFile(path.join(backendRoot, "test/scripts/prepare-test-database.js"), "utf8"),
    readFile(fileURLToPath(new URL("./daily-goal-migration-quarantine.js", import.meta.url)), "utf8"),
  ]);
  assert.match(preparation, /\[prismaCli, "migrate", "deploy"\]/);
  assert.doesNotMatch(preparation, /migration-drafts|daily-goal-v1/);
  assert.doesNotMatch(
    quarantineHelper,
    /node:child_process|PrismaClient|migrate\s+deploy|DATABASE_URL|TEST_DATABASE_URL/,
  );
});

test("Q5 rejects a manifest digest or size mismatch", () => {
  const bytes = Buffer.from("review fixture", "utf8");
  assert.throws(() => verifyQuarantinedArtifact(bytes, {
    ...manifest,
    byte_count: bytes.length,
    sha256: "0".repeat(64),
  }), /integrity mismatch/);
  assert.throws(() => verifyQuarantinedArtifact(bytes, {
    ...manifest,
    byte_count: bytes.length + 1,
    sha256: "0".repeat(64),
  }), /integrity mismatch/);
});

test("Q5 rejects a missing quarantined artifact", async () => {
  const missingName = "20991231000000_missing_daily_goal_artifact";
  await assert.rejects(() => readAndVerifyQuarantinedArtifact(repositoryRoot, {
    ...manifest,
    migration_name: missingName,
    quarantined_path: `backend/prisma/migration-drafts/daily-goal-v1/${missingName}/migration.sql`,
  }), { code: "ENOENT" });
});

test("Q5 detects reappearance inside an offline fixture active directory", async () => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "daily-goal-quarantine-"));
  try {
    const fixtureActive = path.join(temporaryRoot, "migrations");
    const fixtureDraft = path.join(temporaryRoot, "draft", manifest.migration_name, "migration.sql");
    await mkdir(path.dirname(fixtureDraft), { recursive: true });
    await mkdir(path.join(fixtureActive, manifest.migration_name), { recursive: true });
    await writeFile(fixtureDraft, "fixture", "utf8");
    await assert.rejects(() => assertDraftAbsentFromActiveMigrations({
      activeMigrationsPath: fixtureActive,
      migrationName: manifest.migration_name,
      quarantinedArtifactPath: fixtureDraft,
    }), /reappeared/);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("Q6 keeps the shared legacy preparation source unchanged by this amendment", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(path.join(backendRoot, "test/scripts/prepare-test-database.js"), "utf8");
  assert.match(source, /configureTestEnvironment\(\{ requireReset: true \}\)/);
  assert.match(source, /\[prismaCli, "migrate", "deploy"\]/);
  assert.doesNotMatch(source, /prepareDailyGoalDatabase|migration-drafts/);
});
