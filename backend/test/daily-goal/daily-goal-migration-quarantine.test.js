import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  assertDraftAbsentFromActiveMigrations,
  readAndVerifyQuarantinedArtifact,
  verifyQuarantinedArtifact,
} from "./daily-goal-migration-quarantine.js";

const backendRoot = fileURLToPath(new URL("../../", import.meta.url));
const repositoryRoot = path.dirname(backendRoot);
const manifestPath = fileURLToPath(new URL("../../prisma/migration-drafts/daily-goal-v1/manifest.json", import.meta.url));
const quarantinePath = fileURLToPath(new URL("../../prisma/migration-drafts/daily-goal-v1/20261022000000_add_daily_goal_v1/migration.sql", import.meta.url));
const activeMigrationsPath = fileURLToPath(new URL("../../prisma/migrations/", import.meta.url));
const originalPath = path.join(activeMigrationsPath, "20261022000000_add_daily_goal_v1", "migration.sql");

const manifest = JSON.parse(await (await import("node:fs/promises")).readFile(manifestPath, "utf8"));

test("Q1 preserves the reviewed migration bytes, digest, size and name", async () => {
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
  await assert.rejects(() => readAndVerifyQuarantinedArtifact(repositoryRoot, {
    ...manifest,
    quarantined_path: "backend/prisma/migration-drafts/daily-goal-v1/missing/migration.sql",
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
