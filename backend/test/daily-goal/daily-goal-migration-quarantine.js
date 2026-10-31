import { createHash } from "node:crypto";
import { lstat, readFile, realpath, readdir } from "node:fs/promises";
import path from "node:path";

const QUARANTINE_RELATIVE_PARTS = ["backend", "prisma", "migration-drafts", "daily-goal-v1"];
const MIGRATION_NAME_PATTERN = /^\d{14}_[a-z0-9_]+$/;

const EXPECTED_LIFECYCLE_SQL = `
BEGIN;
ALTER TABLE "DAILY_GOAL_TRACKING_SESSION"
ADD COLUMN "paused_at" TIMESTAMP(3) WITH TIME ZONE,
ADD COLUMN "expired_at" TIMESTAMP(3) WITH TIME ZONE;
ALTER TABLE "DAILY_GOAL_MONITOR_SESSION"
ADD COLUMN "expired_at" TIMESTAMP(3) WITH TIME ZONE;
ALTER TABLE "DAILY_GOAL_TRACKING_SESSION"
DROP CONSTRAINT "DAILY_GOAL_TRACKING_SESSION_lifecycle_check",
DROP CONSTRAINT "DAILY_GOAL_TRACKING_SESSION_time_order_check",
ADD CONSTRAINT "DAILY_GOAL_TRACKING_SESSION_lifecycle_check" CHECK (
("status" = 'CLOSED' AND "closed_at" IS NOT NULL AND "expired_at" IS NULL)
OR ("status" = 'EXPIRED' AND "expired_at" IS NOT NULL AND "closed_at" IS NULL)
OR ("status" IN ('ACTIVE', 'PAUSED') AND "closed_at" IS NULL AND "expired_at" IS NULL)
),
ADD CONSTRAINT "DAILY_GOAL_TRACKING_SESSION_pause_state_check" CHECK (
"status" = 'PAUSED' OR "paused_at" IS NULL
),
ADD CONSTRAINT "DAILY_GOAL_TRACKING_SESSION_time_order_check" CHECK (
("last_meaningful_at" IS NULL OR "last_meaningful_at" >= "created_at")
AND ("engagement_expires_at" IS NULL OR "last_meaningful_at" IS NOT NULL)
AND ("engagement_expires_at" IS NULL OR "engagement_expires_at" > "last_meaningful_at")
AND ("paused_at" IS NULL OR "paused_at" >= "created_at")
AND ("expired_at" IS NULL OR "expired_at" >= "created_at")
AND ("closed_at" IS NULL OR "closed_at" >= "created_at")
);
ALTER TABLE "DAILY_GOAL_MONITOR_SESSION"
DROP CONSTRAINT "DAILY_GOAL_MONITOR_SESSION_time_order_check",
ADD CONSTRAINT "DAILY_GOAL_MONITOR_SESSION_terminal_check" CHECK (
NOT ("closed_at" IS NOT NULL AND "expired_at" IS NOT NULL)
),
ADD CONSTRAINT "DAILY_GOAL_MONITOR_SESSION_time_order_check" CHECK (
"last_seen_at" >= "started_at" AND "continuity_started_at" >= "started_at"
AND "eligible_baseline_at" >= "continuity_started_at"
AND ("expired_at" IS NULL OR "expired_at" >= "started_at")
AND ("closed_at" IS NULL OR "closed_at" >= "started_at")
);
CREATE INDEX "DAILY_GOAL_TRACKING_SESSION_status_created_at_id_idx"
ON "DAILY_GOAL_TRACKING_SESSION"("status", "created_at", "id");
CREATE INDEX "DAILY_GOAL_TRACKING_SESSION_status_engagement_expires_at_id_idx"
ON "DAILY_GOAL_TRACKING_SESSION"("status", "engagement_expires_at", "id");
CREATE INDEX "DAILY_GOAL_TRACKING_SESSION_status_paused_at_id_idx"
ON "DAILY_GOAL_TRACKING_SESSION"("status", "paused_at", "id");
CREATE INDEX "DAILY_GOAL_TRACKING_SESSION_expired_at_id_idx"
ON "DAILY_GOAL_TRACKING_SESSION"("expired_at", "id");
CREATE INDEX "DG_MONITOR_closed_expired_seen_id_idx"
ON "DAILY_GOAL_MONITOR_SESSION"("closed_at", "expired_at", "last_seen_at", "id");
CREATE INDEX "DAILY_GOAL_MONITOR_SESSION_expired_at_id_idx"
ON "DAILY_GOAL_MONITOR_SESSION"("expired_at", "id");
COMMIT;
`;

export function verifyQuarantinedArtifact(bytes, manifest) {
  if (!Buffer.isBuffer(bytes)) throw new TypeError("Migration artifact bytes are required.");
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (bytes.length !== manifest.byte_count || digest !== manifest.sha256) {
    throw new Error("Quarantined migration integrity mismatch.");
  }
  if (path.basename(path.dirname(manifest.quarantined_path)) !== manifest.migration_name) {
    throw new Error("Quarantined migration name mismatch.");
  }
  return Object.freeze({ byteCount: bytes.length, sha256: digest });
}

export async function readAndVerifyQuarantinedArtifact(repositoryRoot, manifest) {
  const artifactPath = await resolveQuarantinedArtifact(repositoryRoot, manifest);
  const bytes = await readFile(artifactPath);
  return verifyQuarantinedArtifact(bytes, manifest);
}

export function verifyLifecycleManifest(manifest, baseManifest, expectedArtifacts) {
  if (!manifest || !baseManifest || !Array.isArray(expectedArtifacts) || expectedArtifacts.length === 0) {
    throw new TypeError("Lifecycle migration manifest inputs are required.");
  }
  const expectedNames = expectedArtifacts.map((artifact) => artifact.migration_name);
  if (new Set(expectedNames).size !== expectedNames.length) {
    throw new TypeError("Expected lifecycle migration identities must be unique.");
  }
  const dependency = manifest.base_dependency;
  if (!dependency
    || dependency.migration_name !== baseManifest.migration_name
    || dependency.quarantined_path !== baseManifest.quarantined_path
    || dependency.byte_count !== baseManifest.byte_count
    || dependency.sha256 !== baseManifest.sha256) {
    throw new Error("Lifecycle migration base dependency mismatch.");
  }
  if (manifest.activation_status !== "NOT AUTHORIZED" || manifest.database_execution !== "NOT RUN") {
    throw new Error("Lifecycle migration authorization boundary mismatch.");
  }
  if (!Array.isArray(manifest.artifacts) || manifest.artifacts.length !== expectedNames.length) {
    throw new Error("Lifecycle migration artifact inventory mismatch.");
  }
  const names = manifest.artifacts.map((artifact) => artifact?.migration_name);
  if (names.some((name, index) => name !== expectedNames[index]) || new Set(names).size !== names.length) {
    throw new Error("Lifecycle migration artifact order mismatch.");
  }
  const expectedOrder = [baseManifest.migration_name, ...expectedNames];
  if (!Array.isArray(manifest.execution_order)
    || manifest.execution_order.length !== expectedOrder.length
    || manifest.execution_order.some((name, index) => name !== expectedOrder[index])) {
    throw new Error("Lifecycle migration execution order mismatch.");
  }
  const paths = new Set();
  for (let index = 0; index < manifest.artifacts.length; index += 1) {
    const artifact = manifest.artifacts[index];
    const expected = expectedArtifacts[index];
    validateManifestArtifactPath(artifact);
    if (paths.has(artifact.quarantined_path)) {
      throw new Error("Lifecycle migration path is duplicated.");
    }
    paths.add(artifact.quarantined_path);
    if (artifact.quarantined_path !== expected.quarantined_path
      || artifact.byte_count !== expected.byte_count
      || artifact.sha256 !== expected.sha256) {
      throw new Error("Lifecycle migration reviewed identity mismatch.");
    }
  }
  return Object.freeze(manifest.artifacts.map((artifact) => Object.freeze({ ...artifact })));
}

export async function readAndVerifyLifecycleArtifacts(repositoryRoot, manifest, baseManifest, expectedArtifacts) {
  const artifacts = verifyLifecycleManifest(manifest, baseManifest, expectedArtifacts);
  return Promise.all(artifacts.map(async (artifact) => Object.freeze({
    migrationName: artifact.migration_name,
    ...await readAndVerifyQuarantinedArtifact(repositoryRoot, artifact),
  })));
}

export async function assertLifecycleDraftInventory(draftsPath, expectedNames) {
  if (!Array.isArray(expectedNames) || new Set(expectedNames).size !== expectedNames.length) {
    throw new TypeError("Expected lifecycle migration names are required.");
  }
  const directories = [];
  for (const name of await readdir(draftsPath)) {
    const stats = await lstat(path.join(draftsPath, name));
    if (stats.isDirectory() && !stats.isSymbolicLink()) directories.push(name);
  }
  directories.sort();
  const expected = [...expectedNames].sort();
  if (directories.length !== expected.length
    || directories.some((name, index) => name !== expected[index])) {
    throw new Error("Lifecycle migration draft inventory mismatch.");
  }
}

export function assertLifecycleMigrationSql(enumSql, lifecycleSql) {
  if (typeof enumSql !== "string" || typeof lifecycleSql !== "string") {
    throw new TypeError("Lifecycle migration SQL is required.");
  }
  const enumStatement = stripSqlComments(enumSql).trim().replace(/\s+/g, " ");
  if (enumStatement !== 'ALTER TYPE "DAILY_GOAL_TRACKING_STATUS" ADD VALUE \'EXPIRED\';') {
    throw new Error("Lifecycle enum migration contains an unexpected statement.");
  }
  if (normalizeSql(lifecycleSql) !== normalizeSql(EXPECTED_LIFECYCLE_SQL)) {
    throw new Error("Lifecycle migration differs from the approved SQL structure.");
  }
}

export async function assertDraftAbsentFromActiveMigrations({
  activeMigrationsPath,
  migrationName,
  quarantinedArtifactPath,
}) {
  const quarantinedRealPath = await realpath(quarantinedArtifactPath);
  const entries = await walk(activeMigrationsPath);
  for (const entry of entries) {
    if (entry.name === migrationName) {
      throw new Error("Daily Goal migration reappeared in the active migration directory.");
    }
    if (entry.stats.isSymbolicLink()) {
      let target;
      try {
        target = await realpath(entry.path);
      } catch {
        throw new Error("Active migration directory contains an unresolved symbolic link.");
      }
      const quarantinedDirectory = path.dirname(quarantinedRealPath);
      if (samePath(target, quarantinedRealPath)
        || samePath(target, quarantinedDirectory)
        || isWithin(target, quarantinedDirectory)
        || isWithin(quarantinedDirectory, target)) {
        throw new Error("Active migration directory aliases the quarantined migration.");
      }
    }
  }
}

async function walk(directory) {
  const results = [];
  for (const name of await readdir(directory)) {
    const entryPath = path.join(directory, name);
    const stats = await lstat(entryPath);
    const entry = { name, path: entryPath, stats };
    results.push(entry);
    if (stats.isDirectory() && !stats.isSymbolicLink()) {
      results.push(...await walk(entryPath));
    }
  }
  return results;
}

function stripSqlComments(sql) {
  return sql.replace(/--[^\r\n]*/g, "");
}

function normalizeSql(sql) {
  return stripSqlComments(sql).trim().replace(/\s+/g, " ");
}

function validateManifestArtifactPath(manifest) {
  if (!manifest || typeof manifest.migration_name !== "string"
    || !MIGRATION_NAME_PATTERN.test(manifest.migration_name)
    || typeof manifest.quarantined_path !== "string") {
    throw new Error("Quarantined migration identity is malformed.");
  }
  const suppliedPath = manifest.quarantined_path;
  if (path.posix.isAbsolute(suppliedPath) || path.win32.isAbsolute(suppliedPath)
    || suppliedPath.includes("\\") || suppliedPath.includes("//")) {
    throw new Error("Quarantined migration path is malformed.");
  }
  const parts = suppliedPath.split("/");
  if (parts.some((part) => part === "" || part === "." || part === "..")) {
    throw new Error("Quarantined migration path traversal is prohibited.");
  }
  const expected = [...QUARANTINE_RELATIVE_PARTS, manifest.migration_name, "migration.sql"];
  if (parts.length !== expected.length || parts.some((part, index) => part !== expected[index])) {
    throw new Error("Quarantined migration path is outside the approved root.");
  }
  return parts;
}

async function resolveQuarantinedArtifact(repositoryRoot, manifest) {
  const parts = validateManifestArtifactPath(manifest);
  const repositoryRealPath = await realpath(repositoryRoot);
  let current = repositoryRealPath;
  for (const part of QUARANTINE_RELATIVE_PARTS) {
    current = path.join(current, part);
    const stats = await lstat(current);
    if (!stats.isDirectory() || stats.isSymbolicLink()) {
      throw new Error("Quarantine root contains an invalid directory component.");
    }
  }
  const quarantineRealPath = await realpath(current);
  if (!isWithin(repositoryRealPath, quarantineRealPath)) {
    throw new Error("Quarantine root escapes the repository.");
  }
  const migrationDirectory = path.join(quarantineRealPath, manifest.migration_name);
  const directoryStats = await lstat(migrationDirectory);
  if (!directoryStats.isDirectory() || directoryStats.isSymbolicLink()) {
    throw new Error("Quarantined migration directory must not be linked.");
  }
  const directoryRealPath = await realpath(migrationDirectory);
  if (!isWithin(quarantineRealPath, directoryRealPath) || !samePath(directoryRealPath, migrationDirectory)) {
    throw new Error("Quarantined migration directory escapes the approved root.");
  }
  const artifactPath = path.join(directoryRealPath, parts.at(-1));
  const artifactStats = await lstat(artifactPath);
  if (!artifactStats.isFile() || artifactStats.isSymbolicLink()) {
    throw new Error("Quarantined migration artifact must be a regular unlinked file.");
  }
  const artifactRealPath = await realpath(artifactPath);
  if (!isWithin(quarantineRealPath, artifactRealPath) || !samePath(artifactRealPath, artifactPath)) {
    throw new Error("Quarantined migration artifact escapes the approved root.");
  }
  return artifactRealPath;
}

function isWithin(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative !== "" && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function samePath(left, right) {
  return path.relative(left, right) === "";
}
