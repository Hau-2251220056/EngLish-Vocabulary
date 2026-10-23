import { createHash } from "node:crypto";
import { lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { verifyQuarantinedArtifact } from "./daily-goal-migration-quarantine.js";

export async function withEphemeralMigrationActivation({ repositoryRoot, manifestPath, operation }) {
  if (typeof operation !== "function") throw new TypeError("Ephemeral activation operation is required.");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  validateManifest(manifest);
  const activePath = path.join(repositoryRoot, "backend", "prisma", "migrations");
  const artifactPath = safeRepositoryPath(repositoryRoot, manifest.quarantined_path);
  const originalPath = safeRepositoryPath(repositoryRoot, manifest.original_active_path);
  if (originalPath !== path.join(activePath, manifest.migration_name, "migration.sql")) {
    throw new Error("Manifest original migration path is not approved.");
  }
  await rejectLinks(artifactPath);
  const artifactBytes = await readFile(artifactPath);
  const integrity = verifyQuarantinedArtifact(artifactBytes, manifest);
  await assertMissing(originalPath, "Daily Goal migration already exists in the active worktree.");

  const workspace = await mkdtemp(path.join(os.tmpdir(), "daily-goal-migration-"));
  try {
    const workspaceReal = await realpath(workspace);
    const repositoryReal = await realpath(repositoryRoot);
    if (workspaceReal === repositoryReal || workspaceReal.startsWith(`${repositoryReal}${path.sep}`)) {
      throw new Error("Ephemeral activation workspace must be outside the source repository.");
    }
    const migrationsPath = path.join(workspace, "prisma", "migrations");
    await copyRegularTree(activePath, migrationsPath);
    const destinationDirectory = path.join(migrationsPath, manifest.migration_name);
    await mkdir(destinationDirectory, { recursive: false });
    const destinationPath = path.join(destinationDirectory, "migration.sql");
    await writeFile(destinationPath, artifactBytes, { flag: "wx" });
    const copied = await readFile(destinationPath);
    const copiedHash = createHash("sha256").update(copied).digest("hex");
    if (!copied.equals(artifactBytes) || copiedHash !== integrity.sha256) {
      throw new Error("Ephemeral migration activation changed reviewed bytes.");
    }
    return await operation(Object.freeze({
      workspace,
      migrationsPath,
      destinationPath,
      artifact: Object.freeze({ name: manifest.migration_name, checksum: integrity.sha256, byteCount: integrity.byteCount }),
    }));
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}

async function copyRegularTree(source, destination) {
  await rejectLinks(source);
  await mkdir(destination, { recursive: true });
  for (const entry of await readdir(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    if (entry.isSymbolicLink()) throw new Error("Symbolic links are prohibited in migration sources.");
    if (entry.isDirectory()) await copyRegularTree(from, to);
    else if (entry.isFile()) await writeFile(to, await readFile(from), { flag: "wx" });
    else throw new Error("Unexpected migration source entry type.");
  }
}

function safeRepositoryPath(root, relative) {
  if (typeof relative !== "string" || path.isAbsolute(relative)) throw new Error("Manifest path is unsafe.");
  const resolved = path.resolve(root, ...relative.split("/"));
  const prefix = `${path.resolve(root)}${path.sep}`;
  if (!resolved.startsWith(prefix)) throw new Error("Manifest path escapes the repository.");
  return resolved;
}

function validateManifest(manifest) {
  if (manifest.activation_status !== "NOT AUTHORIZED" || manifest.database_execution !== "NOT RUN") {
    throw new Error("Migration manifest approval state is unsafe.");
  }
  if (!/^\d{14}_[a-z0-9_]+$/.test(manifest.migration_name)) throw new Error("Migration name is invalid.");
}

async function rejectLinks(target) {
  const stats = await lstat(target);
  assertNotSymbolicLink(stats);
}

export function assertNotSymbolicLink(stats) {
  if (!stats || typeof stats.isSymbolicLink !== "function") {
    throw new TypeError("Filesystem entry metadata is required.");
  }
  if (stats.isSymbolicLink()) throw new Error("Symbolic links are prohibited for migration artifacts.");
}

async function assertMissing(target, message) {
  try { await lstat(target); } catch (error) { if (error.code === "ENOENT") return; throw error; }
  throw new Error(message);
}
