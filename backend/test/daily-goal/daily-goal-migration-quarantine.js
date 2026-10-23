import { createHash } from "node:crypto";
import { lstat, readFile, realpath, readdir } from "node:fs/promises";
import path from "node:path";

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
  const artifactPath = path.join(repositoryRoot, ...manifest.quarantined_path.split("/"));
  const bytes = await readFile(artifactPath);
  return verifyQuarantinedArtifact(bytes, manifest);
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
      if (target === quarantinedRealPath || target.startsWith(`${path.dirname(quarantinedRealPath)}${path.sep}`)) {
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
