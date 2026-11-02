import { createHash } from "node:crypto";
import { lstat, readFile, realpath } from "node:fs/promises";
import { isIP } from "node:net";
import os from "node:os";
import path from "node:path";

export const OPERATION = "TASK264_H4_P4_P3_POSTGRESQL_17";
export const REPOSITORY = "Hau-2251220056/EngLish-Vocabulary";
export const SOURCE_REF = "refs/heads/feature/daily-goal-v1";
export const WORKFLOW = "TASK-264 H4 P4 P3 PostgreSQL 17";
export const WORKFLOW_PATH = ".github/workflows/daily-goal-task264-h4-p4-p3-postgresql.yml";
export const DATABASE_IDENTITY = Object.freeze({
  protocol: "postgresql:", hostname: "127.0.0.1", port: "5432",
  database: "task264_lifecycle_ephemeral", username: "task264_lifecycle_ephemeral",
  major: 17,
});
export const LIMITS = Object.freeze({ artifactBytes: 32_768, manifestBytes: 16_384, outputBytes: 1_048_576 });
export const PHASES = Object.freeze([
  "IDENTITY", "ENVIRONMENT", "ARTIFACTS", "TARGET", "WORKSPACE", "MATERIALIZE",
  "INVENTORY", "CLIENT", "DATABASE_IDENTITY", "MIGRATE", "HISTORY", "EMPTY_STATE",
  "TEST_ACTIVATION", "INTEGRATION", "CLEANUP",
]);
export const MIGRATIONS = Object.freeze([
  Object.freeze({ name: "20261022000000_add_daily_goal_v1", bytes: 11487, sha256: "8e468739c3f60693e9ff53d1c3d4107124ac1feaa9d95ac3a665ea8b8c89edb6" }),
  Object.freeze({ name: "20261031000000_add_daily_goal_tracking_expired_status", bytes: 159, sha256: "83946b364ab9acefb9dabb1e42e415171b99d05bf6a4d12b0485d76ee8ff0c52" }),
  Object.freeze({ name: "20261031000001_add_daily_goal_lifecycle_expiry", bytes: 3062, sha256: "dabb0febe7ad18eaff8321e07b6cd9b28506c290f6b6e0a71e51d32f48c8ef02" }),
  Object.freeze({ name: "20261031000002_add_daily_goal_lifecycle_maintenance", bytes: 2801, sha256: "7998de79c935dedece401ac851d543b4189e73b11ccff7dab6a110f131fc8b05" }),
]);
export const FORBIDDEN_DATABASE_KEYS = Object.freeze([
  "DATABASE_URL", "TEST_DATABASE_URL", "CI_TEST_DATABASE_URL", "DIRECT_URL",
  "SHADOW_DATABASE_URL", "DAILY_GOAL_OBSERVER_DATABASE_URL", "SUPABASE_DB_URL",
  "PREVIEW_DATABASE_URL", "PRODUCTION_DATABASE_URL",
]);

export class HarnessRefusal extends Error {
  constructor(code) { super(`TASK-264 PostgreSQL harness refused: ${safeCode(code)}`); this.code = safeCode(code); }
}

export function validateExecutionIdentity(input) {
  const required = ["operation", "authorized", "repository", "sourceSha", "sourceRef", "workflow", "workflowRef", "workflowSha", "expectedWorkflowSha", "runAttempt"];
  requireExactKeys(input, required, "IDENTITY_SHAPE");
  if (input.operation !== OPERATION || input.authorized !== "true") refuse("AUTHORIZATION_DENIED");
  if (input.repository !== REPOSITORY || input.sourceRef !== SOURCE_REF || input.workflow !== WORKFLOW) refuse("IDENTITY_MISMATCH");
  for (const value of [input.sourceSha, input.workflowSha, input.expectedWorkflowSha]) requireSha(value);
  if (input.sourceSha !== input.workflowSha || input.workflowSha !== input.expectedWorkflowSha) refuse("SHA_BINDING_MISMATCH");
  if (input.workflowRef !== `${REPOSITORY}/${WORKFLOW_PATH}@${SOURCE_REF}`) refuse("WORKFLOW_REF_MISMATCH");
  if (input.runAttempt !== "1") refuse("RUN_ATTEMPT_DENIED");
  return Object.freeze({ sourceSha: input.sourceSha, sourceRef: input.sourceRef });
}

export function sanitizeEnvironment(environment) {
  for (const key of FORBIDDEN_DATABASE_KEYS) {
    if (typeof environment?.[key] === "string" && environment[key].trim() !== "") refuse("EXTERNAL_DATABASE_ENVIRONMENT");
  }
  const allowed = {};
  for (const key of ["PATH", "HOME", "TMPDIR", "TEMP", "TMP", "SystemRoot", "WINDIR", "CI", "NODE_ENV"]) {
    if (typeof environment?.[key] === "string") allowed[key] = environment[key];
  }
  return allowed;
}

export function validateLocalDatabaseTarget(value) {
  let parsed;
  try { parsed = new URL(value); } catch { refuse("LOCAL_DATABASE_TARGET_INVALID"); }
  const expected = DATABASE_IDENTITY;
  if (parsed.protocol !== expected.protocol || parsed.hostname !== expected.hostname || parsed.port !== expected.port
    || parsed.pathname !== `/${expected.database}` || parsed.username !== expected.username || parsed.password.length < 16
    || parsed.search || parsed.hash) refuse("LOCAL_DATABASE_TARGET_INVALID");
  return Object.freeze({ hostname: parsed.hostname, port: parsed.port, database: expected.database, username: expected.username });
}

export function validateDatabaseObservation(observation, { requireEmpty = false } = {}) {
  requireExactKeys(observation, ["database", "username", "host", "port", "major", "publicTables"], "DATABASE_OBSERVATION_SHAPE");
  const expected = DATABASE_IDENTITY;
  if (observation.database !== expected.database || observation.username !== expected.username
    || typeof observation.host !== "string" || isIP(observation.host) === 0
    || String(observation.port) !== expected.port
    || Number(observation.major) !== expected.major) refuse("DATABASE_IDENTITY_MISMATCH");
  if (requireEmpty && observation.publicTables !== 0) refuse("DATABASE_NOT_EMPTY");
  return true;
}

export function validateManifest(manifest) {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) refuse("MANIFEST_INVALID");
  if (manifest.activation_status !== "NOT AUTHORIZED" || manifest.database_execution !== "NOT RUN") refuse("MANIFEST_AUTHORIZATION_MISMATCH");
  if (JSON.stringify(manifest.execution_order) !== JSON.stringify(MIGRATIONS.map(({ name }) => name))) refuse("MIGRATION_ORDER_MISMATCH");
  const records = [manifest.base_dependency, ...(Array.isArray(manifest.artifacts) ? manifest.artifacts : [])];
  if (records.length !== MIGRATIONS.length) refuse("MIGRATION_INVENTORY_MISMATCH");
  records.forEach((record, index) => {
    const expected = MIGRATIONS[index];
    if (record?.migration_name !== expected.name || record?.byte_count !== expected.bytes || record?.sha256 !== expected.sha256) refuse("MANIFEST_ARTIFACT_MISMATCH");
    const normalized = String(record.quarantined_path ?? "").replaceAll("\\", "/");
    if (normalized !== `backend/prisma/migration-drafts/daily-goal-v1/${expected.name}/migration.sql`) refuse("MANIFEST_PATH_MISMATCH");
  });
  return Object.freeze(records.map((record) => record.quarantined_path));
}

export async function readBoundedRegularFile(file, { root, maximumBytes = LIMITS.artifactBytes, label = "artifact" } = {}) {
  const resolvedRoot = await realpath(root);
  const resolved = await realpath(file);
  if (!isWithin(resolvedRoot, resolved) || path.basename(resolved) !== path.basename(file)) refuse("PATH_ESCAPE");
  const stats = await lstat(file);
  if (!stats.isFile() || stats.isSymbolicLink() || stats.size <= 0 || stats.size > maximumBytes) refuse("ARTIFACT_FILE_INVALID");
  const bytes = await readFile(file);
  if (bytes.length !== stats.size || bytes.includes(Buffer.from("\r"))) refuse("ARTIFACT_BYTES_INVALID");
  return Object.freeze({ label, file: resolved, bytes });
}

export async function verifyReviewedArtifacts({ repositoryRoot, manifestPath }) {
  const draftRoot = path.join(repositoryRoot, "backend/prisma/migration-drafts/daily-goal-v1");
  const manifestFile = await readBoundedRegularFile(manifestPath, { root: draftRoot, maximumBytes: LIMITS.manifestBytes, label: "manifest" });
  let manifest;
  try { manifest = JSON.parse(manifestFile.bytes.toString("utf8")); } catch { refuse("MANIFEST_JSON_INVALID"); }
  validateManifest(manifest);
  const verified = [];
  for (const expected of MIGRATIONS) {
    const file = path.join(draftRoot, expected.name, "migration.sql");
    const artifact = await readBoundedRegularFile(file, { root: draftRoot, maximumBytes: LIMITS.artifactBytes, label: expected.name });
    if (artifact.bytes.length !== expected.bytes || sha256(artifact.bytes) !== expected.sha256) refuse("SQL_CHECKSUM_MISMATCH");
    verified.push(Object.freeze({ ...expected, source: artifact.file }));
  }
  return Object.freeze(verified);
}

export async function validateTemporaryWorkspace(workspace, repositoryRoot) {
  const sourceStats = await lstat(workspace);
  if (!sourceStats.isDirectory() || sourceStats.isSymbolicLink()) refuse("WORKSPACE_UNSAFE");
  const workspaceReal = await realpath(workspace);
  const repositoryReal = await realpath(repositoryRoot);
  const temporaryReal = await realpath(os.tmpdir());
  if (!isWithin(temporaryReal, workspaceReal) || isWithin(repositoryReal, workspaceReal) || workspaceReal === temporaryReal) refuse("WORKSPACE_UNSAFE");
  return workspaceReal;
}

export function createPhaseSequence() {
  let index = 0;
  return Object.freeze({
    enter(phase) {
      if (PHASES[index] !== phase) refuse("PHASE_ORDER_VIOLATION");
      index += 1;
      return phase;
    },
    complete() { if (index !== PHASES.length) refuse("PHASE_INCOMPLETE"); return true; },
    get next() { return PHASES[index] ?? null; },
  });
}

export function classifyFailure(error) {
  if (error instanceof HarnessRefusal) return Object.freeze({ outcome: "REFUSED", code: error.code });
  return Object.freeze({ outcome: "FAILED", code: "INTERNAL_FAILURE" });
}

export function sha256(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
function refuse(code) { throw new HarnessRefusal(code); }
function requireSha(value) { if (typeof value !== "string" || !/^[0-9a-f]{40}$/.test(value)) refuse("SHA_INVALID"); }
function safeCode(value) { return /^[A-Z0-9_]{1,64}$/.test(String(value)) ? String(value) : "INTERNAL_FAILURE"; }
function requireExactKeys(value, expected, code) {
  if (!value || typeof value !== "object" || Array.isArray(value)) refuse(code);
  const actual = Object.keys(value).sort(); const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((item, index) => item !== wanted[index])) refuse(code);
}
function isWithin(parent, candidate) { const relative = path.relative(parent, candidate); return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative); }
