import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  DG2_MIGRATION_INVENTORY_DIGEST,
  createDg2Harness,
  refusalEvidence,
} from "./daily-goal-dg2-core.js";
import { REVIEWED_INVENTORY } from "./daily-goal-ephemeral-migration-core.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(here, "../..");
const repositoryRoot = path.resolve(backendRoot, "..");
const configPath = path.join(here, "ephemeral-prisma.config.ts");
const schemaPath = path.join(backendRoot, "prisma/schema.prisma");
const generatedClientPath = path.join(backendRoot, "src/generated/prisma/client.ts");
const CONFIG_CONTRACT = Object.freeze({ size: 162, checksum: "2d2f4b78f9a65424a7fe7f57bb54b6c9e947422acd4450e08e24f23844d0b675" });
const SCHEMA_CONTRACT = Object.freeze({ normalizedSize: 20_694, normalizedChecksum: "6db27a93d6d0f0babb53679d17afc4eec87f9935a26553f6c29b0408bce6d953" });
const HARD_OUTPUT_LIMIT = 32_768;

export async function validateFixedPrismaInputs() {
  const config = await readRegular(configPath, "Prisma config");
  if (config.length !== CONFIG_CONTRACT.size || sha256(config) !== CONFIG_CONTRACT.checksum) throw new Error("Dedicated Prisma config mismatch.");
  const schema = await readRegular(schemaPath, "Prisma schema");
  const normalized = Buffer.from(schema.toString("utf8").replaceAll("\r\n", "\n"), "utf8");
  if (normalized.includes(Buffer.from("\r")) || normalized.length !== SCHEMA_CONTRACT.normalizedSize
    || sha256(normalized) !== SCHEMA_CONTRACT.normalizedChecksum) throw new Error("Production Prisma schema mismatch.");
  return Object.freeze({ configPath, schemaPath });
}

export function createDg2SubprocessEnvironment(source, localUrl) {
  assertJobLocalUrl(localUrl);
  const result = {};
  for (const key of ["PATH", "SystemRoot", "WINDIR", "TEMP", "TMP", "TMPDIR", "HOME", "USERPROFILE", "APPDATA", "LOCALAPPDATA", "LANG", "LC_ALL", "CI"]) {
    if (typeof source?.[key] === "string") result[key] = source[key];
  }
  result.DAILY_GOAL_EPHEMERAL_JOB_DATABASE_URL = localUrl;
  return Object.freeze(result);
}

export function buildFullClientGenerateInvocation({ environment = process.env } = {}) {
  const localUrl = requireOnlyJobLocalUrl(environment);
  const executable = process.platform === "win32"
    ? path.join(backendRoot, "node_modules/.bin/prisma.cmd")
    : path.join(backendRoot, "node_modules/.bin/prisma");
  return Object.freeze({
    executable,
    args: Object.freeze(["generate", "--config", configPath, "--schema", schemaPath]),
    cwd: backendRoot,
    env: createDg2SubprocessEnvironment(environment, localUrl),
  });
}

export async function generateFullModelClient({ environment = process.env, spawnProcess = spawn } = {}) {
  await validateFixedPrismaInputs();
  const invocation = buildFullClientGenerateInvocation({ environment });
  await runBounded(invocation, spawnProcess);
  const stats = await lstat(generatedClientPath);
  if (!stats.isFile() || stats.isSymbolicLink()) throw new Error("Generated Prisma client is unavailable.");
}

export function bindingFromEnvironment(environment) {
  return {
    operation: environment.DAILY_GOAL_DG2_OPERATION,
    authorized: environment.DAILY_GOAL_DG2_AUTHORIZED,
    repository: environment.DAILY_GOAL_DG2_REPOSITORY,
    sourceSha: environment.DAILY_GOAL_DG2_SOURCE_SHA,
    sourceRef: environment.DAILY_GOAL_DG2_SOURCE_REF,
    workflowSha: environment.DAILY_GOAL_DG2_WORKFLOW_SHA,
    runId: environment.DAILY_GOAL_DG2_RUN_ID,
    runAttempt: environment.DAILY_GOAL_DG2_RUN_ATTEMPT,
    postgresqlMajor: environment.DAILY_GOAL_DG2_POSTGRESQL_MAJOR,
  };
}

export async function runDg2({ environment = process.env, adapterFactory = createRealAdapter } = {}) {
  const binding = bindingFromEnvironment(environment);
  const harness = createDg2Harness();
  const authorization = harness.issueAuthorization(binding);
  const adapter = await adapterFactory({ environment, binding });
  const trustedResult = await harness.run({ authorization, adapter });
  return harness.verifyResult({ trustedResult, authorization, expectedBinding: binding });
}

async function createRealAdapter({ environment }) {
  const localUrl = requireOnlyJobLocalUrl(environment);
  const { PrismaClient } = await import(pathToFileURL(generatedClientPath).href);
  const prisma = new PrismaClient({ datasourceUrl: localUrl });
  const repositorySuite = await import("./daily-goal-dg2-repository.integration.test.js");
  const httpSuite = await import("./daily-goal-dg2-http.integration.test.js");
  let cleanupAttempted = false;
  return Object.freeze({
    async assertPrepared() {
      await prisma.$connect();
      const version = await prisma.$queryRaw`SELECT current_setting('server_version_num')::int AS version`;
      const history = await prisma.$queryRaw`SELECT migration_name, checksum, finished_at, rolled_back_at FROM public._prisma_migrations ORDER BY started_at`;
      const observed = history.map((row) => ({ name: row.migration_name, checksum: row.checksum }));
      if (Math.trunc(Number(version?.[0]?.version) / 10_000) !== 17 || history.length !== 12
        || JSON.stringify(observed) !== JSON.stringify(REVIEWED_INVENTORY)
        || history.some((row) => row.finished_at === null || row.rolled_back_at !== null)) throw new Error("Prepared database contract mismatch.");
    },
    async generateClient() {
      const stats = await lstat(generatedClientPath);
      if (!stats.isFile() || stats.isSymbolicLink()) throw new Error("Generated client contract mismatch.");
    },
    runRepository() { return repositorySuite.runRepositoryIntegration({ prisma, databaseUrl: localUrl }); },
    runHttp() { return httpSuite.runHttpIntegration({ prisma, databaseUrl: localUrl }); },
    async cleanup() {
      if (cleanupAttempted) throw new Error("DG-2 cleanup was already attempted.");
      cleanupAttempted = true;
      await prisma.$disconnect();
    },
  });
}

function requireOnlyJobLocalUrl(environment) {
  for (const forbidden of ["DATABASE_URL", "TEST_DATABASE_URL", "CI_TEST_DATABASE_URL", "DAILY_GOAL_OBSERVER_DATABASE_URL"]) {
    if (typeof environment?.[forbidden] === "string" && environment[forbidden].length > 0) throw new Error("External database URL fallback is prohibited.");
  }
  const value = environment?.DAILY_GOAL_EPHEMERAL_JOB_DATABASE_URL;
  assertJobLocalUrl(value);
  return value;
}
function assertJobLocalUrl(value) {
  let parsed;
  try { parsed = new URL(value); } catch { throw new Error("Job-local database URL is invalid."); }
  if (!/^postgres(?:ql)?:$/.test(parsed.protocol) || parsed.hostname !== "127.0.0.1" || parsed.port !== "5432"
    || parsed.pathname !== "/daily_goal_ephemeral" || parsed.username !== "daily_goal_ephemeral" || parsed.password.length === 0) {
    throw new Error("Job-local database identity mismatch.");
  }
}
async function readRegular(file, label) { const stats = await lstat(file); if (!stats.isFile() || stats.isSymbolicLink()) throw new Error(`${label} is not a regular file.`); return readFile(file); }
function sha256(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
function runBounded(invocation, spawnProcess) {
  return new Promise((resolve, reject) => {
    const child = spawnProcess(invocation.executable, invocation.args, { cwd: invocation.cwd, env: invocation.env, stdio: ["ignore", "pipe", "pipe"] });
    let bytes = 0; let settled = false; let killed = false;
    const finish = (error) => { if (settled) return; settled = true; error ? reject(new Error("Prisma client generation failed.")) : resolve(); };
    const consume = (chunk) => { bytes += Buffer.byteLength(chunk); if (bytes > HARD_OUTPUT_LIMIT && !killed) { killed = true; child.kill(); } };
    child.stdout?.on("data", consume); child.stderr?.on("data", consume);
    child.once("error", () => finish(new Error("Prisma client process failed.")));
    child.once("close", (code) => finish(killed || code !== 0 ? new Error("Prisma client generation failed.") : null));
  });
}

async function main() {
  try {
    if (process.argv[2] === "--generate-client") { await generateFullModelClient(); process.stdout.write('{"outcome":"DG2_MODEL_CLIENT_READY","dg2Passed":false}\n'); return; }
    if (process.argv[2] !== "--run") throw new Error("A supported DG-2 CLI operation is required.");
    const evidence = await runDg2();
    process.stdout.write(`${JSON.stringify(evidence)}\n`);
  } catch (error) {
    process.stdout.write(`${JSON.stringify(refusalEvidence(error))}\n`);
    process.exitCode = 1;
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();

export const DG2_CLIENT_CONTRACT = Object.freeze({ configPath, schemaPath, generatedClientPath, inventoryDigest: DG2_MIGRATION_INVENTORY_DIGEST });
