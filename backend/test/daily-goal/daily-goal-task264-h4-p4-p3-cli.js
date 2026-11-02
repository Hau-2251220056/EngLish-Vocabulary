import { spawn } from "node:child_process";
import { COPYFILE_EXCL } from "node:constants";
import { copyFile, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  LIMITS, MIGRATIONS, PHASES, classifyFailure, createPhaseSequence, sanitizeEnvironment,
  sha256, validateDatabaseObservation, validateExecutionIdentity, validateLocalDatabaseTarget,
  validateTemporaryWorkspace, verifyReviewedArtifacts,
} from "./daily-goal-task264-h4-p4-p3-core.js";
import { BASELINE_MIGRATIONS } from "./daily-goal-ephemeral-migration-core.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(here, "../..");
const repositoryRoot = path.resolve(backendRoot, "..");
const manifestPath = path.join(backendRoot, "prisma/migration-drafts/daily-goal-v1/lifecycle-manifest.json");
const activeMigrations = path.join(backendRoot, "prisma/migrations");
const productionSchema = path.join(backendRoot, "prisma/schema.prisma");
const prismaCli = path.join(backendRoot, "node_modules/prisma/build/index.js");
const dependencyRoot = path.join(backendRoot, "node_modules");
const prismaClientPackage = path.join(dependencyRoot, "@prisma/client");
const PRISMA_CLIENT_VERSION = "6.19.3";
export const CLIENT_SUBPHASES = Object.freeze(["GENERATE", "IMPORT", "CONSTRUCT"]);

export class HarnessPhaseFailure extends Error {
  constructor(cause, phase, subphase) {
    if (!PHASES.includes(phase)) throw new Error("Harness diagnostic phase is invalid.");
    if (subphase !== undefined && (phase !== "CLIENT" || !CLIENT_SUBPHASES.includes(subphase))) {
      throw new Error("Harness diagnostic subphase is invalid.");
    }
    super("Harness phase failed.", { cause });
    this.name = "HarnessPhaseFailure";
    this.phase = phase;
    if (subphase !== undefined) this.subphase = subphase;
  }
}

export function classifyHarnessFailure(error) {
  if (error instanceof HarnessPhaseFailure) {
    const result = classifyHarnessFailure(error.cause);
    return result.outcome === "FAILED" && result.code === "INTERNAL_FAILURE"
      ? Object.freeze({ ...result, phase: error.phase, ...(error.subphase === undefined ? {} : { subphase: error.subphase }) })
      : result;
  }
  if (error instanceof AggregateError) {
    const phaseFailure = error.errors.find((entry) => entry instanceof HarnessPhaseFailure);
    if (phaseFailure) return classifyHarnessFailure(phaseFailure);
  }
  return classifyFailure(error);
}

export function identityFromEnvironment(environment) {
  return {
    operation: environment.TASK264_P3_OPERATION,
    authorized: environment.TASK264_P3_AUTHORIZED,
    repository: environment.TASK264_P3_REPOSITORY,
    sourceSha: environment.TASK264_P3_SOURCE_SHA,
    sourceRef: environment.TASK264_P3_SOURCE_REF,
    workflow: environment.TASK264_P3_WORKFLOW,
    workflowRef: environment.TASK264_P3_WORKFLOW_REF,
    workflowSha: environment.TASK264_P3_WORKFLOW_SHA,
    expectedWorkflowSha: environment.TASK264_P3_EXPECTED_WORKFLOW_SHA,
    runAttempt: environment.TASK264_P3_RUN_ATTEMPT,
  };
}

export async function runHarness({ environment = process.env, spawnProcess = spawn, hooks = {} } = {}) {
  const phases = createPhaseSequence();
  let currentPhase;
  let currentSubphase;
  let workspace;
  let prisma;
  let primaryFailure;
  try {
    phases.enter("IDENTITY");
    currentPhase = "IDENTITY";
    validateExecutionIdentity(identityFromEnvironment(environment));

    phases.enter("ENVIRONMENT");
    currentPhase = "ENVIRONMENT";
    const childBase = sanitizeEnvironment(environment);

    phases.enter("ARTIFACTS");
    currentPhase = "ARTIFACTS";
    const artifacts = await verifyReviewedArtifacts({ repositoryRoot, manifestPath });

    phases.enter("TARGET");
    currentPhase = "TARGET";
    validateLocalDatabaseTarget(environment.TASK264_P3_JOB_DATABASE_URL);

    phases.enter("WORKSPACE");
    currentPhase = "WORKSPACE";
    workspace = await mkdtemp(path.join(os.tmpdir(), "task264-p3-"));
    await validateTemporaryWorkspace(workspace, repositoryRoot);

    phases.enter("MATERIALIZE");
    currentPhase = "MATERIALIZE";
    const materialized = await materializeWorkspace({ workspace, artifacts });

    phases.enter("INVENTORY");
    currentPhase = "INVENTORY";
    await verifyMaterializedInventory(materialized.migrationsPath);

    phases.enter("CLIENT");
    currentPhase = "CLIENT";
    const childEnvironment = Object.freeze({
      ...childBase,
      TASK264_P3_JOB_DATABASE_URL: environment.TASK264_P3_JOB_DATABASE_URL,
      TASK264_P3_GENERATED_CLIENT: materialized.generatedClient,
      TASK264_P3_TEST_ONLY_LEASE_MS: requireTestInteger(environment.TASK264_P3_TEST_ONLY_LEASE_MS, 100, 60_000),
      TASK264_P3_TEST_ONLY_TIMEOUT_MS: requireTestInteger(environment.TASK264_P3_TEST_ONLY_TIMEOUT_MS, 1_000, 120_000),
      TASK264_P3_INTEGRATION_AUTHORIZED: "true",
    });
    currentSubphase = "GENERATE";
    await runBounded(process.execPath, [prismaCli, "generate", "--config", materialized.configPath, "--schema", materialized.schemaPath], { cwd: backendRoot, env: childEnvironment }, spawnProcess);
    currentSubphase = "IMPORT";
    await materializePrismaRuntime({ workspace });
    const module = await import(`${pathToFileURL(path.join(materialized.generatedClient, "client.ts")).href}?v=${Date.now()}`);
    currentSubphase = "CONSTRUCT";
    prisma = new module.PrismaClient({ datasourceUrl: environment.TASK264_P3_JOB_DATABASE_URL });

    currentSubphase = undefined;
    phases.enter("DATABASE_IDENTITY");
    currentPhase = "DATABASE_IDENTITY";
    await prisma.$connect();
    validateDatabaseObservation(await observeDatabase(prisma), { requireEmpty: true });
    await hooks.afterDatabaseIdentity?.({ prisma });

    phases.enter("MIGRATE");
    currentPhase = "MIGRATE";
    await runBounded(process.execPath, [prismaCli, "migrate", "deploy", "--config", materialized.configPath, "--schema", materialized.schemaPath], { cwd: backendRoot, env: childEnvironment }, spawnProcess);

    phases.enter("HISTORY");
    currentPhase = "HISTORY";
    await verifyMigrationHistory(prisma);

    phases.enter("EMPTY_STATE");
    currentPhase = "EMPTY_STATE";
    const empty = await prisma.$queryRaw`SELECT
      (SELECT count(*)::int FROM "DAILY_GOAL_LIFECYCLE_POLICY") AS policy_count,
      (SELECT count(*)::int FROM "DAILY_GOAL_LIFECYCLE_JOURNAL") AS journal_count`;
    if (empty.length !== 1 || empty[0].policy_count !== 0 || empty[0].journal_count !== 0) throw new Error("Lifecycle state is not empty.");

    phases.enter("TEST_ACTIVATION");
    currentPhase = "TEST_ACTIVATION";
    await prisma.dAILY_GOAL_LIFECYCLE_POLICY.create({ data: { policy_version: 1, activated_at: new Date() } });

    phases.enter("INTEGRATION");
    currentPhase = "INTEGRATION";
    await prisma.$disconnect(); prisma = null;
    await runBounded(process.execPath, ["--test", "--test-concurrency=1", path.join(here, "daily-goal-task264-h4-p4-p3-postgresql.integration.test.js")], { cwd: backendRoot, env: childEnvironment }, spawnProcess);

    phases.enter("CLEANUP");
    currentPhase = "CLEANUP";
    await rm(workspace, { recursive: true, force: true }); workspace = null;
    phases.complete();
    return Object.freeze({ outcome: "PASS", phases: PHASES.length, migrations: MIGRATIONS.length });
  } catch (error) {
    primaryFailure = error instanceof HarnessPhaseFailure ? error : new HarnessPhaseFailure(error, currentPhase, currentSubphase);
    throw primaryFailure;
  } finally {
    const cleanupFailures = [];
    try { await prisma?.$disconnect(); } catch { cleanupFailures.push(new Error("Disposable database client cleanup failed.")); }
    if (workspace) {
      try { await rm(workspace, { recursive: true, force: true }); }
      catch { cleanupFailures.push(new Error("Workspace cleanup failed.")); }
    }
    if (cleanupFailures.length) {
      if (primaryFailure) throw new AggregateError([primaryFailure, ...cleanupFailures], "Harness execution and cleanup failed.");
      const cleanupFailure = cleanupFailures.length === 1
        ? cleanupFailures[0]
        : new AggregateError(cleanupFailures, "Harness cleanup failed.");
      throw new HarnessPhaseFailure(cleanupFailure, "CLEANUP");
    }
  }
}

export async function materializePrismaRuntime({
  workspace,
  sourceRoot = dependencyRoot,
  source = prismaClientPackage,
} = {}) {
  const workspaceStats = await lstat(workspace);
  if (!workspaceStats.isDirectory() || workspaceStats.isSymbolicLink()) throw new Error("Prisma runtime workspace is invalid.");
  const sourceRootStats = await lstat(sourceRoot);
  if (!sourceRootStats.isDirectory() || sourceRootStats.isSymbolicLink()) throw new Error("Prisma runtime source root is invalid.");
  const workspaceReal = await realpath(workspace);
  const sourceRootReal = await realpath(sourceRoot);
  const sourceReal = await realpath(source);
  if (!isStrictDescendant(sourceRootReal, sourceReal)
    || path.relative(sourceRootReal, sourceReal) !== path.join("@prisma", "client")) {
    throw new Error("Prisma runtime source is invalid.");
  }

  const sourceStats = await lstat(source);
  if (!sourceStats.isDirectory() || sourceStats.isSymbolicLink()) throw new Error("Prisma runtime source is invalid.");
  const sourcePackage = JSON.parse(await readRegularFile(path.join(sourceReal, "package.json"), "Prisma runtime metadata is invalid."));
  if (sourcePackage.version !== PRISMA_CLIENT_VERSION) throw new Error("Prisma runtime version is invalid.");

  const nodeModules = path.join(workspaceReal, "node_modules");
  const scope = path.join(nodeModules, "@prisma");
  const destination = path.join(scope, "client");
  if (!isStrictDescendant(workspaceReal, destination)) throw new Error("Prisma runtime destination is invalid.");
  await mkdir(nodeModules, { recursive: false });
  await mkdir(scope, { recursive: false });
  await copyRegularTree(sourceReal, destination);

  const destinationReal = await realpath(destination);
  if (!isStrictDescendant(workspaceReal, destinationReal)) throw new Error("Prisma runtime destination is invalid.");
  const copiedPackage = JSON.parse(await readRegularFile(path.join(destinationReal, "package.json"), "Copied Prisma runtime metadata is invalid."));
  if (copiedPackage.version !== PRISMA_CLIENT_VERSION) throw new Error("Copied Prisma runtime version is invalid.");
  await readRegularFile(path.join(destinationReal, "runtime", "library.js"), "Copied Prisma runtime is incomplete.");
  await readRegularFile(path.join(destinationReal, "runtime", "library.mjs"), "Copied Prisma runtime is incomplete.");
  return destinationReal;
}

function isStrictDescendant(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative !== "" && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

async function readRegularFile(file, message) {
  const stats = await lstat(file);
  if (!stats.isFile() || stats.isSymbolicLink()) throw new Error(message);
  return readFile(file, "utf8");
}

async function copyRegularTree(source, destination) {
  const sourceStats = await lstat(source);
  if (!sourceStats.isDirectory() || sourceStats.isSymbolicLink()) throw new Error("Prisma runtime package tree is invalid.");
  await mkdir(destination, { recursive: false });
  for (const entry of await readdir(source, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) throw new Error("Prisma runtime package links are prohibited.");
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    if (entry.isDirectory()) await copyRegularTree(from, to);
    else if (entry.isFile()) {
      const stats = await lstat(from);
      if (!stats.isFile() || stats.isSymbolicLink()) throw new Error("Prisma runtime package file is invalid.");
      await copyFile(from, to, COPYFILE_EXCL);
    } else throw new Error("Prisma runtime package entry is invalid.");
  }
}

async function materializeWorkspace({ workspace, artifacts }) {
  const prismaPath = path.join(workspace, "prisma");
  const migrationsPath = path.join(prismaPath, "migrations");
  await mkdir(prismaPath, { recursive: false });
  await copyActiveMigrationTree(migrationsPath);
  for (const artifact of artifacts) {
    const directory = path.join(migrationsPath, artifact.name);
    await mkdir(directory, { recursive: false });
    await writeFile(path.join(directory, "migration.sql"), await readFile(artifact.source), { flag: "wx" });
  }
  const generatedClient = path.join(workspace, "generated", "prisma");
  const schemaText = await readFile(productionSchema, "utf8");
  const output = generatedClient.replaceAll("\\", "/");
  const schema = schemaText.replace(/output\s*=\s*"[^"]+"/, `output = "${output}"`)
    .replace('url      = env("DATABASE_URL")', 'url      = env("TASK264_P3_JOB_DATABASE_URL")');
  if (schema === schemaText || !schema.includes(output) || schema.includes('env("DATABASE_URL")')) throw new Error("Disposable Prisma bindings could not be established.");
  const schemaPath = path.join(prismaPath, "schema.prisma");
  await writeFile(schemaPath, schema, { flag: "wx" });
  const configPath = path.join(workspace, "prisma.config.ts");
  const config = `const datasourceUrl = process.env.TASK264_P3_JOB_DATABASE_URL;\nif (!datasourceUrl) throw new Error("Disposable datasource binding is missing.");\nexport default {\n  schema: ${JSON.stringify(schemaPath.replaceAll("\\", "/"))},\n  migrations: { path: ${JSON.stringify(migrationsPath.replaceAll("\\", "/"))} },\n  engine: "classic",\n  datasource: { url: datasourceUrl },\n};\n`;
  await writeFile(configPath, config, { flag: "wx" });
  return Object.freeze({ migrationsPath, schemaPath, configPath, generatedClient });
}

async function copyActiveMigrationTree(destination) {
  const root = await lstat(activeMigrations);
  if (!root.isDirectory() || root.isSymbolicLink()) throw new Error("Active migration source is invalid.");
  await mkdir(destination, { recursive: true });
  for (const entry of await readdir(activeMigrations, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) throw new Error("Active migration symlinks are prohibited.");
    const from = path.join(activeMigrations, entry.name); const to = path.join(destination, entry.name);
    if (entry.isDirectory()) {
      await validateCanonicalMigrationDirectory(from);
      await mkdir(to, { recursive: false });
      await copyFile(path.join(from, "migration.sql"), path.join(to, "migration.sql"), COPYFILE_EXCL);
    } else if (entry.isFile() && entry.name === "migration_lock.toml") await copyFile(from, to, COPYFILE_EXCL);
    else throw new Error("Active migration inventory is invalid.");
  }
}

async function verifyMaterializedInventory(migrationsPath) {
  const entries = await readdir(migrationsPath, { withFileTypes: true });
  const expectedInventory = [...BASELINE_MIGRATIONS, ...MIGRATIONS];
  const observedNames = entries.filter(({ name }) => name !== "migration_lock.toml").map(({ name }) => name).sort();
  const expectedNames = expectedInventory.map(({ name }) => name).sort();
  if (JSON.stringify(observedNames) !== JSON.stringify(expectedNames)) throw new Error("Materialized migration inventory is not exact.");
  const lock = entries.find(({ name }) => name === "migration_lock.toml");
  if (!lock?.isFile() || lock.isSymbolicLink()) throw new Error("Materialized migration lock is invalid.");
  for (const expected of expectedInventory) {
    const entry = entries.find(({ name }) => name === expected.name);
    if (!entry?.isDirectory() || entry.isSymbolicLink()) throw new Error("Materialized migration is invalid.");
    await validateCanonicalMigrationDirectory(path.join(migrationsPath, expected.name));
    const file = path.join(migrationsPath, expected.name, "migration.sql");
    const stats = await lstat(file); const bytes = await readFile(file);
    const expectedHash = expected.sha256 ?? expected.checksum;
    if (!stats.isFile() || stats.isSymbolicLink() || sha256(bytes) !== expectedHash) throw new Error("Materialized migration mismatch.");
    if (expected.bytes !== undefined && bytes.length !== expected.bytes) throw new Error("Materialized migration size mismatch.");
  }
}

export async function validateCanonicalMigrationDirectory(directory) {
  const root = await lstat(directory);
  if (!root.isDirectory() || root.isSymbolicLink()) throw new Error("Migration directory is not canonical.");
  const children = await readdir(directory, { withFileTypes: true });
  if (children.length !== 1 || children[0].name !== "migration.sql"
    || !children[0].isFile() || children[0].isSymbolicLink()) {
    throw new Error("Migration directory must contain exactly one regular migration.sql.");
  }
  const file = path.join(directory, "migration.sql");
  const stats = await lstat(file);
  if (!stats.isFile() || stats.isSymbolicLink()) throw new Error("Migration SQL is not canonical.");
  return file;
}

async function observeDatabase(prisma) {
  // The server socket may use a container bridge address; TARGET already binds the client to loopback.
  const rows = await prisma.$queryRaw`SELECT current_database() AS database,
    current_user AS username, inet_server_addr()::text AS host, inet_server_port()::int AS port,
    (current_setting('server_version_num')::int / 10000)::int AS major,
    (SELECT count(*)::int FROM pg_catalog.pg_tables WHERE schemaname = 'public') AS "publicTables"`;
  if (rows.length !== 1) throw new Error("Database observation failed.");
  return rows[0];
}

async function verifyMigrationHistory(prisma) {
  const history = await prisma.$queryRaw`SELECT migration_name, checksum, finished_at, rolled_back_at FROM public._prisma_migrations ORDER BY started_at`;
  for (const expected of MIGRATIONS) {
    const row = history.find(({ migration_name: name }) => name === expected.name);
    if (!row || row.checksum !== expected.sha256 || row.finished_at === null || row.rolled_back_at !== null) throw new Error("Migration history mismatch.");
  }
}

function requireTestInteger(value, minimum, maximum) {
  if (!/^[1-9][0-9]*$/.test(String(value))) throw new Error("Test-only timing configuration is invalid.");
  const number = Number(value); if (!Number.isSafeInteger(number) || number < minimum || number > maximum) throw new Error("Test-only timing configuration is invalid.");
  return String(number);
}

function runBounded(executable, args, options, spawnProcess) {
  return new Promise((resolve, reject) => {
    const child = spawnProcess(executable, args, { ...options, shell: false, stdio: ["ignore", "pipe", "pipe"] });
    let bytes = 0; let settled = false; let timer;
    const finish = (error) => { if (settled) return; settled = true; clearTimeout(timer); error ? reject(error) : resolve(); };
    const consume = (chunk) => { bytes += Buffer.byteLength(chunk); if (bytes > LIMITS.outputBytes) { child.kill(); finish(new Error("Subprocess output limit exceeded.")); } };
    child.stdout?.on("data", consume); child.stderr?.on("data", consume);
    child.once("error", () => finish(new Error("Guarded subprocess failed.")));
    child.once("close", (code) => finish(code === 0 ? null : new Error("Guarded subprocess exited unsuccessfully.")));
    timer = setTimeout(() => { child.kill(); finish(new Error("Guarded subprocess timeout.")); }, 120_000);
  });
}

async function main() {
  try {
    if (process.argv.length !== 3 || process.argv[2] !== "--run") throw new Error("Explicit --run is required.");
    process.stdout.write(`${JSON.stringify(await runHarness())}\n`);
  } catch (error) {
    process.stdout.write(`${JSON.stringify(classifyHarnessFailure(error))}\n`); process.exitCode = 1;
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
