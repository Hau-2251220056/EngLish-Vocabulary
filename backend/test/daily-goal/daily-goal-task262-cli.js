import { lstat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

import {
  createTask262Harness,
  TASK262_MIGRATION_INVENTORY_DIGEST,
  task262RefusalEvidence,
} from "./daily-goal-task262-core.js";
import { REVIEWED_INVENTORY } from "./daily-goal-ephemeral-migration-core.js";
import { generateFullModelClient, validateFixedPrismaInputs } from "./daily-goal-dg2-cli.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(here, "../..");
const generatedClientPath = path.join(backendRoot, "src/generated/prisma/client.ts");
const FORBIDDEN_DATABASE_KEYS = Object.freeze([
  "DATABASE_URL", "TEST_DATABASE_URL", "CI_TEST_DATABASE_URL", "DAILY_GOAL_OBSERVER_DATABASE_URL",
]);

export function bindingFromTask262Environment(environment) {
  return {
    operation: environment.DAILY_GOAL_TASK262_OPERATION,
    authorized: environment.DAILY_GOAL_TASK262_AUTHORIZED,
    repository: environment.DAILY_GOAL_TASK262_REPOSITORY,
    sourceSha: environment.DAILY_GOAL_TASK262_SOURCE_SHA,
    sourceRef: environment.DAILY_GOAL_TASK262_SOURCE_REF,
    workflowSha: environment.DAILY_GOAL_TASK262_WORKFLOW_SHA,
    runId: environment.DAILY_GOAL_TASK262_RUN_ID,
    runAttempt: environment.DAILY_GOAL_TASK262_RUN_ATTEMPT,
    postgresqlMajor: environment.DAILY_GOAL_TASK262_POSTGRESQL_MAJOR,
  };
}

export function requireTask262JobLocalUrl(environment) {
  for (const key of FORBIDDEN_DATABASE_KEYS) {
    if (typeof environment?.[key] === "string" && environment[key].length > 0) throw new Error("External database URL fallback is prohibited.");
  }
  const value = environment?.DAILY_GOAL_TASK262_JOB_DATABASE_URL;
  let parsed;
  try { parsed = new URL(value); } catch { throw new Error("TASK-262 job-local database URL is invalid."); }
  if (!/^postgres(?:ql)?:$/.test(parsed.protocol)
    || parsed.hostname !== "127.0.0.1" || parsed.port !== "5432"
    || parsed.pathname !== "/daily_goal_ephemeral"
    || parsed.username !== "daily_goal_ephemeral" || parsed.password.length === 0
    || parsed.search.length > 0 || parsed.hash.length > 0) {
    throw new Error("TASK-262 job-local database identity mismatch.");
  }
  return value;
}

export function createTask262SubprocessEnvironment(source, localUrl) {
  requireTask262JobLocalUrl({ DAILY_GOAL_TASK262_JOB_DATABASE_URL: localUrl });
  const result = {};
  for (const key of ["PATH", "SystemRoot", "WINDIR", "TEMP", "TMP", "TMPDIR", "HOME", "USERPROFILE", "APPDATA", "LOCALAPPDATA", "LANG", "LC_ALL", "CI"]) {
    if (typeof source?.[key] === "string") result[key] = source[key];
  }
  result.DAILY_GOAL_EPHEMERAL_JOB_DATABASE_URL = localUrl;
  return Object.freeze(result);
}

export async function validateTask262PreparedDatabase(prisma) {
  const version = await prisma.$queryRaw`SELECT current_setting('server_version_num')::int AS version`;
  const history = await prisma.$queryRaw`SELECT migration_name, checksum, finished_at, rolled_back_at FROM public._prisma_migrations ORDER BY started_at`;
  const observed = history.map((row) => ({ name: row.migration_name, checksum: row.checksum }));
  if (Math.trunc(Number(version?.[0]?.version) / 10_000) !== 17
    || history.length !== REVIEWED_INVENTORY.length
    || JSON.stringify(observed) !== JSON.stringify(REVIEWED_INVENTORY)
    || history.some((row) => row.finished_at === null || row.rolled_back_at !== null)) {
    throw new Error("Prepared database contract mismatch.");
  }
  return Object.freeze({ postgresqlMajor: 17, migrationInventoryDigest: TASK262_MIGRATION_INVENTORY_DIGEST });
}

export async function runTask262({ environment = process.env, adapterFactory = createRealAdapter } = {}) {
  const binding = bindingFromTask262Environment(environment);
  const harness = createTask262Harness();
  const authorization = harness.issueAuthorization(binding);
  const adapter = await adapterFactory({ environment, binding });
  const trustedResult = await harness.run({ authorization, adapter });
  return harness.verifyResult({ trustedResult, authorization, expectedBinding: binding });
}

async function createRealAdapter({ environment }) {
  const localUrl = requireTask262JobLocalUrl(environment);
  const { PrismaClient } = await import(pathToFileURL(generatedClientPath).href);
  const prisma = new PrismaClient({ datasourceUrl: localUrl });
  const rewardSuite = await import("./daily-goal-task262-reward.integration.test.js");
  const httpSuite = await import("./daily-goal-task262-http.integration.test.js");
  const compatibilitySuite = await import("./daily-goal-task262-compatibility.integration.test.js");
  let cleanupAttempted = false;
  return Object.freeze({
    async assertPrepared() {
      await prisma.$connect();
      await validateTask262PreparedDatabase(prisma);
    },
    async generateClient() {
      const stats = await lstat(generatedClientPath);
      if (!stats.isFile() || stats.isSymbolicLink()) throw new Error("Generated client contract mismatch.");
    },
    runReward() { return rewardSuite.runTask262RewardIntegration({ prisma }); },
    runHttp() { return httpSuite.runTask262HttpIntegration({ prisma }); },
    runCompatibility() { return compatibilitySuite.runTask262CompatibilityIntegration({ prisma }); },
    async cleanup() {
      if (cleanupAttempted) throw new Error("TASK-262 cleanup was already attempted.");
      cleanupAttempted = true;
      await prisma.$disconnect();
    },
  });
}

export async function generateTask262Client({ environment = process.env } = {}) {
  const localUrl = requireTask262JobLocalUrl(environment);
  await validateFixedPrismaInputs();
  return generateFullModelClient({ environment: createTask262SubprocessEnvironment(environment, localUrl) });
}

async function main() {
  try {
    if (process.argv[2] === "--generate-client") {
      await generateTask262Client();
      process.stdout.write('{"outcome":"TASK262_MODEL_CLIENT_READY","task262Passed":false}\n');
      return;
    }
    if (process.argv[2] !== "--run") throw new Error("A supported TASK-262 CLI operation is required.");
    process.stdout.write(`${JSON.stringify(await runTask262())}\n`);
  } catch (error) {
    process.stdout.write(`${JSON.stringify(task262RefusalEvidence(error))}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();

export const TASK262_CLIENT_CONTRACT = Object.freeze({ backendRoot, generatedClientPath, inventoryDigest: TASK262_MIGRATION_INVENTORY_DIGEST });
