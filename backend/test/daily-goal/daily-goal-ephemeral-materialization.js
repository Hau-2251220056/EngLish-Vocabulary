import { createHash } from "node:crypto";
import { lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DAILY_GOAL_MIGRATION } from "./daily-goal-phase-d-offline.js";
import {
  attachCleanupStage, BASELINE_MIGRATIONS, EphemeralMigrationFailure,
  REVIEWED_INVENTORY, migrationInventoryDigest,
} from "./daily-goal-ephemeral-migration-core.js";

export async function withDailyGoalEphemeralWorkspace({ repositoryRoot, operation, cleanup = rm }) {
  if (typeof operation !== "function") throw new TypeError("Ephemeral operation is required.");
  const sourceMigrations = path.join(repositoryRoot, "backend", "prisma", "migrations");
  const draft = path.join(repositoryRoot, "backend", "prisma", "migration-drafts", "daily-goal-v1", DAILY_GOAL_MIGRATION.name, "migration.sql");
  const activeCopy = path.join(sourceMigrations, DAILY_GOAL_MIGRATION.name, "migration.sql");
  const sourceLock = path.join(sourceMigrations, MIGRATION_LOCK.name);
  await assertMissing(activeCopy);
  const draftBytes = await readRegularLfFile(draft);
  assertDigest(draftBytes);
  const lockBytes = await readCanonicalMigrationLock(sourceLock);
  const workspace = await mkdtemp(path.join(os.tmpdir(), "daily-goal-ephemeral-"));
  let primaryFailure;
  try {
    const repositoryReal = await realpath(repositoryRoot);
    const workspaceReal = await realpath(workspace);
    if (workspaceReal === repositoryReal || workspaceReal.startsWith(`${repositoryReal}${path.sep}`)) throw new Error("Workspace must be outside repository.");
    const prismaPath = path.join(workspace, "prisma");
    const migrationsPath = path.join(prismaPath, "migrations");
    await copyCanonicalMigrationsTree(sourceMigrations, migrationsPath, lockBytes);
    await writeFile(path.join(prismaPath, "schema.prisma"), [
      "datasource db {", "  provider = \"postgresql\"", "  url = env(\"DAILY_GOAL_EPHEMERAL_JOB_DATABASE_URL\")", "}", "",
    ].join("\n"), { flag: "wx" });
    let materialized = false;
    let baselineVerified = false;
    const materializeDaily = async () => {
      if (!baselineVerified) throw new Error("Baseline destination must be verified before materialization.");
      if (materialized) throw new Error("Daily Goal migration materialization is single-use.");
      materialized = true;
      const directory = path.join(migrationsPath, DAILY_GOAL_MIGRATION.name);
      await mkdir(directory, { recursive: false });
      const destination = path.join(directory, "migration.sql");
      await writeFile(destination, draftBytes, { flag: "wx" });
      assertDigest(await readFile(destination));
    };
    const verifyBaselineDestination = async () => {
      const evidence = await verifyDestinationInventory(migrationsPath, BASELINE_MIGRATIONS);
      baselineVerified = true;
      return evidence;
    };
    const verifyCompleteDestination = async () => {
      if (!materialized) throw new Error("Daily Goal migration must be materialized before complete verification.");
      return verifyDestinationInventory(migrationsPath, REVIEWED_INVENTORY);
    };
    return await operation(Object.freeze({
      workspace, migrationsPath, schemaPath: path.join(prismaPath, "schema.prisma"),
      verifyBaselineDestination, materializeDaily, verifyCompleteDestination,
      artifact: Object.freeze({ name: DAILY_GOAL_MIGRATION.name, checksum: DAILY_GOAL_MIGRATION.checksum, byteCount: DAILY_GOAL_MIGRATION.byteCount }),
    }));
  } catch (error) {
    primaryFailure = error;
    throw error;
  } finally {
    try { await cleanup(workspace, { recursive: true, force: true }); }
    catch {
      if (primaryFailure) throw attachCleanupStage(primaryFailure, "WORKSPACE_CLEANUP");
      throw new EphemeralMigrationFailure("CLEANUP_FAILED", "WORKSPACE_CLEANUP");
    }
  }
}

export async function verifyDestinationInventory(migrationsPath, expected) {
  const entries = (await readdir(migrationsPath, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name));
  const lockEntry = entries.find((item) => item.name === MIGRATION_LOCK.name);
  const migrationEntries = entries.filter((item) => item.name !== MIGRATION_LOCK.name);
  if (entries.length !== expected.length + 1 || !lockEntry || !lockEntry.isFile() || lockEntry.isSymbolicLink()
    || migrationEntries.length !== expected.length
    || migrationEntries.some((item, index) => !item.isDirectory() || item.isSymbolicLink() || item.name !== expected[index].name)) {
    throw new Error("Destination migration inventory mismatch.");
  }
  const lockBytes = await readCanonicalMigrationLock(path.join(migrationsPath, MIGRATION_LOCK.name));
  const observed = [];
  for (const item of migrationEntries) {
    const directory = path.join(migrationsPath, item.name);
    const children = await readdir(directory, { withFileTypes: true });
    if (children.length !== 1 || children[0].name !== "migration.sql" || !children[0].isFile() || children[0].isSymbolicLink()) {
      throw new Error("Destination migration directory is not canonical.");
    }
    const bytes = await readRegularLfFile(path.join(directory, "migration.sql"));
    const checksum = createHash("sha256").update(bytes).digest("hex");
    const required = expected[observed.length];
    if (checksum !== required.checksum) throw new Error("Destination migration checksum mismatch.");
    observed.push(Object.freeze({ name: item.name, checksum }));
  }
  const digest = migrationInventoryDigest(observed);
  const expectedDigest = migrationInventoryDigest(expected);
  if (digest !== expectedDigest) throw new Error("Destination migration digest mismatch.");
  return Object.freeze({
    count: observed.length, digest, entries: Object.freeze(observed),
    migrationLock: Object.freeze({ byteCount: lockBytes.length, checksum: sha256(lockBytes) }),
  });
}

export const MIGRATION_LOCK = Object.freeze({
  name: "migration_lock.toml",
  byteCount: 128,
  checksum: "99836963713b4f5b269ad49af0ed3d7b0b2e336115c2f92dc9ac683d139d0900",
});

async function copyCanonicalMigrationsTree(source, destination, lockBytes) {
  const stats = await lstat(source);
  if (stats.isSymbolicLink() || !stats.isDirectory()) throw new Error("Migration source tree is invalid.");
  const entries = (await readdir(source, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name));
  const expectedNames = [MIGRATION_LOCK.name, ...BASELINE_MIGRATIONS.map((item) => item.name)].sort();
  if (entries.length !== expectedNames.length || entries.some((item, index) => item.name !== expectedNames[index])) {
    throw new Error("Migration source root layout is invalid.");
  }
  await mkdir(destination, { recursive: true });
  await writeFile(path.join(destination, MIGRATION_LOCK.name), lockBytes, { flag: "wx" });
  for (const expected of BASELINE_MIGRATIONS) {
    const entry = entries.find((item) => item.name === expected.name);
    if (!entry?.isDirectory() || entry.isSymbolicLink()) throw new Error("Migration source directory is invalid.");
    await copyRegularTree(path.join(source, expected.name), path.join(destination, expected.name));
  }
}

async function copyRegularTree(source, destination) {
  const stats = await lstat(source);
  if (stats.isSymbolicLink() || !stats.isDirectory()) throw new Error("Migration source tree is invalid.");
  await mkdir(destination, { recursive: true });
  for (const item of await readdir(source, { withFileTypes: true })) {
    const from = path.join(source, item.name);
    const to = path.join(destination, item.name);
    if (item.isSymbolicLink()) throw new Error("Migration symlinks are prohibited.");
    if (item.isDirectory()) await copyRegularTree(from, to);
    else if (item.isFile()) await writeFile(to, await readFile(from), { flag: "wx" });
    else throw new Error("Unexpected migration source entry.");
  }
}

async function readCanonicalMigrationLock(file) {
  const bytes = await readRegularLfFile(file);
  const text = bytes.toString("utf8");
  if (bytes.length !== MIGRATION_LOCK.byteCount || sha256(bytes) !== MIGRATION_LOCK.checksum
    || !/^provider = "postgresql"$/m.test(text)) {
    throw new Error("migration_lock.toml does not match the canonical PostgreSQL contract.");
  }
  return bytes;
}

async function readRegularLfFile(file) {
  const stats = await lstat(file);
  if (!stats.isFile() || stats.isSymbolicLink()) throw new Error("Migration artifact must be a regular file.");
  const bytes = await readFile(file);
  if (bytes.includes(Buffer.from("\r"))) throw new Error("Migration artifact must be LF-only.");
  return bytes;
}

function assertDigest(bytes) {
  if (bytes.length !== DAILY_GOAL_MIGRATION.byteCount || sha256(bytes) !== DAILY_GOAL_MIGRATION.checksum) {
    throw new Error("Daily Goal migration bytes do not match the reviewed artifact.");
  }
}

function sha256(bytes) { return createHash("sha256").update(bytes).digest("hex"); }

async function assertMissing(file) {
  try { await lstat(file); } catch (error) { if (error.code === "ENOENT") return; throw error; }
  throw new Error("Permanent active Daily Goal migration copy is prohibited.");
}
