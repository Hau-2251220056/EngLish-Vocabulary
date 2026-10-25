import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { withDailyGoalEphemeralWorkspace } from "./daily-goal-ephemeral-materialization.js";
import {
  createEphemeralVerificationHarness, createRefusalEvidence, EPHEMERAL_OPERATION,
  MIGRATION_INVENTORY_DIGEST, verifyCanonicalInventory,
} from "./daily-goal-ephemeral-migration-core.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(here, "../../..");
const draftPath = path.join(repositoryRoot, "backend/prisma/migration-drafts/daily-goal-v1/20261022000000_add_daily_goal_v1/migration.sql");
const migrationsPath = path.join(repositoryRoot, "backend/prisma/migrations");

export async function runEphemeralMigrationCli({ environment = process.env, adapterFactory = createPrismaAdapter } = {}) {
  const bindingInput = {
    operation: environment.DAILY_GOAL_EPHEMERAL_OPERATION,
    authorized: environment.DAILY_GOAL_EPHEMERAL_AUTHORIZED,
    repository: environment.GITHUB_REPOSITORY, sourceSha: environment.GITHUB_SHA,
    runId: environment.GITHUB_RUN_ID, runAttempt: environment.GITHUB_RUN_ATTEMPT,
    workflow: environment.GITHUB_WORKFLOW, ref: environment.GITHUB_REF,
    postgresqlMajor: environment.DAILY_GOAL_POSTGRESQL_MAJOR,
    inventoryDigest: environment.DAILY_GOAL_MIGRATION_INVENTORY_DIGEST,
    dailyGoalSize: environment.DAILY_GOAL_MIGRATION_SIZE,
    dailyGoalHash: environment.DAILY_GOAL_MIGRATION_SHA256,
  };
  await verifyCanonicalInventory({ migrationsPath, draftPath });
  const localUrl = environment.DAILY_GOAL_EPHEMERAL_JOB_DATABASE_URL;
  if (!/^postgresql:\/\/daily_goal_ephemeral:[^@\s]+@127\.0\.0\.1:5432\/daily_goal_ephemeral$/.test(localUrl ?? "")) {
    throw new Error("Job-local PostgreSQL binding is invalid.");
  }
  const adapter = await adapterFactory({ localUrl, repositoryRoot });
  const harness = createEphemeralVerificationHarness();
  const authorization = harness.issueAuthorization(bindingInput);
  const trustedResult = await harness.run({
    authorization, adapter,
    activate: (operation) => withDailyGoalEphemeralWorkspace({ repositoryRoot, operation }),
  });
  return harness.verifyResult({ trustedResult, authorization, expectedBinding: bindingInput });
}

async function createPrismaAdapter({ localUrl, repositoryRoot }) {
  const { PrismaClient } = await import("@prisma/client");
  const client = new PrismaClient({ datasourceUrl: localUrl });
  let activeMigrationsPath;
  return {
    async assertFresh() {
      const rows = await client.$queryRaw`SELECT current_database() AS database_name, current_setting('server_version_num') AS version_num, (SELECT count(*)::int FROM pg_catalog.pg_tables WHERE schemaname = 'public') AS public_tables`;
      if (rows.length !== 1 || rows[0].database_name !== "daily_goal_ephemeral" || !String(rows[0].version_num).startsWith("17") || rows[0].public_tables !== 0) throw new Error("Fresh database check failed.");
    },
    async readExtensions() {
      const rows = await client.$queryRaw`SELECT extname FROM pg_catalog.pg_extension WHERE extname <> 'plpgsql' ORDER BY extname`;
      return rows.map((row) => row.extname);
    },
    async deploy({ migrationsPath: activatedPath, schemaPath, expectedDigest }) {
      if (!/^[a-f0-9]{64}$/.test(expectedDigest)) throw new Error("Destination digest is invalid.");
      activeMigrationsPath = activatedPath;
      await runPrismaCommand({ repositoryRoot, localUrl, schemaPath, operation: "deploy" });
    },
    async readHistory() {
      const rows = await client.$queryRaw`SELECT migration_name AS name, checksum, CASE WHEN finished_at IS NOT NULL AND rolled_back_at IS NULL THEN 'APPLIED' ELSE 'FAILED' END AS status FROM public._prisma_migrations ORDER BY started_at, migration_name`;
      return rows;
    },
    async readPending({ schemaPath, expectedDigest }) {
      if (!/^[a-f0-9]{64}$/.test(expectedDigest)) throw new Error("Destination digest is invalid.");
      const output = await runPrismaCommand({ repositoryRoot, localUrl, schemaPath, operation: "status" });
      return parsePrismaPendingMigrations(output);
    },
    async readSchemaEvidence() {
      if (!activeMigrationsPath) throw new Error("Migrations were not deployed.");
      // The fixed verifier is deliberately database-owned: it returns the exact reviewed
      // canonical categories and must also complete rollback-based cascade probes.
      const module = await import("./daily-goal-ephemeral-schema-verifier.js");
      return module.collectDailyGoalSchemaEvidence(client);
    },
    async disconnect() { await client.$disconnect(); },
  };
}

async function runPrismaCommand({ repositoryRoot, localUrl, schemaPath, operation, spawnProcess = spawn, sourceEnvironment = process.env }) {
  const args = [path.join(repositoryRoot, "backend/node_modules/prisma/build/index.js"), "migrate", operation, "--schema", schemaPath];
  return new Promise((resolve, reject) => {
    const child = spawnProcess(process.execPath, args, {
      cwd: path.join(repositoryRoot, "backend"), stdio: operation === "status" ? ["ignore", "pipe", "pipe"] : "ignore",
      env: createPrismaSubprocessEnvironment(sourceEnvironment, localUrl),
    });
    let stdout = "";
    let stderrBytes = 0;
    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
      if (Buffer.byteLength(stdout, "utf8") > 32_768) child.kill();
    });
    child.stderr?.on("data", (chunk) => { stderrBytes += chunk.length; if (stderrBytes > 32_768) child.kill(); });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (operation === "status" && [0, 1].includes(code)) resolve(stdout);
      else if (operation === "deploy" && code === 0) resolve("");
      else reject(new Error("Prisma migration command failed."));
    });
  });
}

export function createPrismaSubprocessEnvironment(source, localUrl) {
  const allowed = ["PATH", "SystemRoot", "WINDIR", "TEMP", "TMP", "TMPDIR", "HOME", "USERPROFILE", "APPDATA", "LOCALAPPDATA", "LANG", "LC_ALL", "CI"];
  const environment = Object.create(null);
  for (const name of allowed) if (typeof source?.[name] === "string") environment[name] = source[name];
  environment.DAILY_GOAL_EPHEMERAL_JOB_DATABASE_URL = localUrl;
  return environment;
}

export function parsePrismaPendingMigrations(output) {
  if (/Database schema is up to date!/i.test(output)) return [];
  const marker = /Following migration(?:s)? have not yet been applied:\s*\n([\s\S]*?)(?:\n\n|$)/i.exec(output);
  if (!marker) throw new Error("Prisma pending status is not recognized.");
  const names = marker[1].split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
  if (names.some((name) => !/^\d{14}_[a-z0-9_]+$/.test(name))) throw new Error("Prisma pending status is malformed.");
  return names;
}

async function main() {
  try {
    const result = await runEphemeralMigrationCli();
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(`${JSON.stringify(createRefusalEvidence(error))}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

export { EPHEMERAL_OPERATION, MIGRATION_INVENTORY_DIGEST };
