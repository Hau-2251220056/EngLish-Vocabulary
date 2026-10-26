import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { lstatSync, readFileSync } from "node:fs";
import { chmod, lstat, mkdtemp, readFile, realpath, rm, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import { withDailyGoalEphemeralWorkspace } from "./daily-goal-ephemeral-materialization.js";
import {
  attachCleanupStage, createEphemeralVerificationHarness, createRefusalEvidence, EPHEMERAL_OPERATION,
  EphemeralMigrationFailure, MIGRATION_INVENTORY_DIGEST, runDiagnosticStage, verifyCanonicalInventory,
} from "./daily-goal-ephemeral-migration-core.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(here, "../../..");
const draftPath = path.join(repositoryRoot, "backend/prisma/migration-drafts/daily-goal-v1/20261022000000_add_daily_goal_v1/migration.sql");
const migrationsPath = path.join(repositoryRoot, "backend/prisma/migrations");
export const EPHEMERAL_PRISMA_CONFIG_PATH = path.join(repositoryRoot, "backend/test/daily-goal/ephemeral-prisma.config.ts");
export const EPHEMERAL_PRISMA_SCHEMA_PATH = path.join(repositoryRoot, "backend/test/daily-goal/ephemeral-prisma-schema.prisma");
const EPHEMERAL_PRISMA_CONFIG = Object.freeze({ byteCount: 162, checksum: "2d2f4b78f9a65424a7fe7f57bb54b6c9e947422acd4450e08e24f23844d0b675" });
const EPHEMERAL_PRISMA_SCHEMA = Object.freeze({ byteCount: 156, checksum: "3b22d4b8ed9c512407f5ac629e57d81b3820355fb26960b3c6d4929cc0b9119d" });
const PRISMA_OUTPUT_HARD_LIMIT_BYTES = 32_768;
const PRISMA_STDERR_CLASSIFICATION_LIMIT_BYTES = 16_384;
const PRISMA_ERROR_CODE_ALLOWLIST = new Set([
  "P1000", "P1001", "P1002", "P1003", "P1010", "P1011", "P1017",
  "P3004", "P3005", "P3008", "P3009", "P3015", "P3017", "P3018", "P3019",
]);

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
  await runDiagnosticStage("SOURCE_INVENTORY", () => verifyCanonicalInventory({ migrationsPath, draftPath }));
  const { localUrl, adapter } = await runDiagnosticStage("PRIVATE_PRISMA_INPUTS", async () => {
    const candidateUrl = environment.DAILY_GOAL_EPHEMERAL_JOB_DATABASE_URL;
    if (!/^postgresql:\/\/daily_goal_ephemeral:[^@\s]+@127\.0\.0\.1:5432\/daily_goal_ephemeral$/.test(candidateUrl ?? "")) {
      throw new Error("Job-local PostgreSQL binding is invalid.");
    }
    return { localUrl: candidateUrl, adapter: await adapterFactory({ localUrl: candidateUrl, repositoryRoot }) };
  });
  const harness = createEphemeralVerificationHarness();
  const authorization = await runDiagnosticStage("INPUT_BINDING", () => harness.issueAuthorization(bindingInput));
  const trustedResult = await harness.run({
    authorization, adapter,
    activate: (operation) => withDailyGoalEphemeralWorkspace({ repositoryRoot, operation }),
  });
  return harness.verifyResult({ trustedResult, authorization, expectedBinding: bindingInput });
}

async function createPrismaAdapter({ localUrl, repositoryRoot }) {
  const privateConfig = await createPrivatePrismaConfigWorkspace();
  let client;
  try {
    const { PrismaClient } = await import("@prisma/client");
    client = new PrismaClient({ datasourceUrl: localUrl });
  } catch {
    await privateConfig.cleanup();
    throw new Error("Prisma adapter initialization failed.");
  }
  let activeMigrationsPath;
  let disconnected = false;
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
      await runPrismaCommand({ repositoryRoot, localUrl, schemaPath, operation: "deploy", privateConfig });
    },
    async readHistory() {
      const rows = await client.$queryRaw`SELECT migration_name AS name, checksum, CASE WHEN finished_at IS NOT NULL AND rolled_back_at IS NULL THEN 'APPLIED' ELSE 'FAILED' END AS status FROM public._prisma_migrations ORDER BY started_at, migration_name`;
      return rows;
    },
    async readPending({ schemaPath, expectedDigest }) {
      if (!/^[a-f0-9]{64}$/.test(expectedDigest)) throw new Error("Destination digest is invalid.");
      const output = await runPrismaCommand({ repositoryRoot, localUrl, schemaPath, operation: "status", privateConfig });
      return parsePrismaPendingMigrations(output);
    },
    async readSchemaEvidence() {
      if (!activeMigrationsPath) throw new Error("Migrations were not deployed.");
      // The fixed verifier is deliberately database-owned: it returns the exact reviewed
      // canonical categories and must also complete rollback-based cascade probes.
      const module = await import("./daily-goal-ephemeral-schema-verifier.js");
      return module.collectDailyGoalSchemaEvidence(client);
    },
    async disconnect() {
      if (disconnected) throw new Error("Prisma adapter cleanup was already attempted.");
      disconnected = true;
      let disconnectError;
      try { await client.$disconnect(); } catch (error) { disconnectError = error; }
      try { await privateConfig.cleanup(); } catch { throw new Error("Private Prisma cleanup failed."); }
      if (disconnectError) throw new Error("Prisma disconnect failed.");
    },
  };
}

async function runPrismaCommand({ repositoryRoot, localUrl, schemaPath, operation, privateConfig, spawnProcess = spawn, sourceEnvironment = process.env, testHooks }) {
  let privateSchema;
  let result;
  let primaryFailure;
  try {
    privateSchema = await materializePrivateSchema(schemaPath, { testHooks });
    const args = buildPrismaCommandArguments({ repositoryRoot, configPath: privateConfig.path, schemaPath: privateSchema.path, operation });
    await testHooks?.beforeInvocationValidation?.({ operation, configPath: privateConfig.path, schemaPath: privateSchema.path });
    result = await spawnPrismaAfterFinalValidation({ privateConfig, privateSchema, args, operation, localUrl, repositoryRoot, spawnProcess, sourceEnvironment });
  } catch (error) {
    primaryFailure = operation === "deploy" && !(error instanceof EphemeralMigrationFailure)
      ? new EphemeralMigrationFailure("PRISMA_PRIVATE_INPUT_FAILED")
      : error;
  } finally {
    if (privateSchema) {
      try { await privateSchema.cleanup(); }
      catch (cleanupError) {
        if (operation !== "deploy") throw cleanupError;
        if (primaryFailure) primaryFailure = attachCleanupStage(primaryFailure, "PRIVATE_PRISMA_INPUTS");
        else primaryFailure = new EphemeralMigrationFailure("PRISMA_PRIVATE_INPUT_CLEANUP_FAILED", undefined, "PRIVATE_PRISMA_INPUTS");
      }
    }
  }
  if (primaryFailure) throw primaryFailure;
  return result;
}

function spawnPrisma({ args, operation, localUrl, repositoryRoot, spawnProcess, sourceEnvironment }) {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawnProcess(process.execPath, args, {
        cwd: path.join(repositoryRoot, "backend"),
        stdio: ["ignore", operation === "status" ? "pipe" : "ignore", operation === "deploy" || operation === "status" ? "pipe" : "ignore"],
        env: createPrismaSubprocessEnvironment(sourceEnvironment, localUrl),
      });
    } catch (error) {
      reject(operation === "deploy" ? new EphemeralMigrationFailure("PRISMA_SPAWN_FAILED") : error);
      return;
    }
    let stdout = "";
    let stderrBytes = 0;
    let stderrClassificationBytes = 0;
    const stderrChunks = [];
    let stderrClassificationOverflow = false;
    let spawnError = false;
    let hardOutputExceeded = false;
    let settled = false;
    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
      if (!hardOutputExceeded && Buffer.byteLength(stdout, "utf8") > PRISMA_OUTPUT_HARD_LIMIT_BYTES) {
        hardOutputExceeded = true;
        child.kill();
      }
    });
    child.stderr?.on("data", (chunk) => {
      const bytes = Buffer.from(chunk);
      stderrBytes += bytes.length;
      if (stderrClassificationBytes + bytes.length <= PRISMA_STDERR_CLASSIFICATION_LIMIT_BYTES) {
        stderrChunks.push(bytes);
        stderrClassificationBytes += bytes.length;
      } else stderrClassificationOverflow = true;
      if (!hardOutputExceeded && stderrBytes > PRISMA_OUTPUT_HARD_LIMIT_BYTES) {
        hardOutputExceeded = true;
        child.kill();
      }
    });
    child.once("error", () => { spawnError = true; });
    child.once("close", (code) => {
      if (settled) return;
      settled = true;
      if (spawnError) {
        reject(operation === "deploy" ? new EphemeralMigrationFailure("PRISMA_SPAWN_FAILED") : new Error("Prisma command could not start."));
      } else if (hardOutputExceeded) {
        reject(operation === "deploy" ? new EphemeralMigrationFailure("PRISMA_EXIT_UNCLASSIFIED") : new Error("Prisma migration command failed."));
      } else if (operation === "status" && [0, 1].includes(code)) resolve(stdout);
      else if (["deploy", "generate"].includes(operation) && code === 0) resolve("");
      else if (operation === "deploy") {
        reject(new EphemeralMigrationFailure(classifyPrismaDeployExit(stderrChunks, stderrClassificationOverflow)));
      } else reject(new Error("Prisma migration command failed."));
    });
  });
}

function classifyPrismaDeployExit(chunks, overflow) {
  if (overflow) return "PRISMA_EXIT_UNCLASSIFIED";
  let output;
  try { output = new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)); }
  catch { return "PRISMA_EXIT_UNCLASSIFIED"; }
  const headers = [];
  let malformedHeader = false;
  for (const line of output.split(/\r?\n/)) {
    const match = /^(?:Error|Error code): (P\d{4})$/.exec(line);
    if (match) headers.push(match[1]);
    else if (line.startsWith("Error:") || line.startsWith("Error code:")) malformedHeader = true;
  }
  if (malformedHeader || headers.length !== 1 || !PRISMA_ERROR_CODE_ALLOWLIST.has(headers[0])) return "PRISMA_EXIT_UNCLASSIFIED";
  return `PRISMA_EXIT_${headers[0]}`;
}

export function buildPrismaCommandArguments({ repositoryRoot: fixedRoot, configPath, schemaPath, operation }) {
  if (fixedRoot !== repositoryRoot) throw new Error("Repository root is not the reviewed root.");
  if (!new Set(["generate", "deploy", "status"]).has(operation)) throw new Error("Prisma operation is not allowed.");
  return [
    path.join(repositoryRoot, "backend/node_modules/prisma/build/index.js"),
    ...(operation === "generate" ? ["generate"] : ["migrate", operation]),
    "--config", configPath,
    "--schema", schemaPath,
  ];
}

export async function runGuardedPrismaGenerate({ spawnProcess = spawn, sourceEnvironment = process.env, testHooks } = {}) {
  const privateConfig = await createPrivatePrismaConfigWorkspace({ testHooks });
  let privateSchema;
  let operationError;
  try {
    privateSchema = await materializePrivateSchema(EPHEMERAL_PRISMA_SCHEMA_PATH, { repositoryStatic: true, testHooks });
    const args = buildPrismaCommandArguments({ repositoryRoot, configPath: privateConfig.path, schemaPath: privateSchema.path, operation: "generate" });
    await testHooks?.beforeInvocationValidation?.({ operation: "generate", configPath: privateConfig.path, schemaPath: privateSchema.path });
    await spawnPrismaAfterFinalValidation({ privateConfig, privateSchema, args, operation: "generate", localUrl: sourceEnvironment.DAILY_GOAL_EPHEMERAL_JOB_DATABASE_URL, repositoryRoot, spawnProcess, sourceEnvironment });
  } catch (error) {
    operationError = error;
  } finally {
    const cleanupError = await cleanupHandles([privateSchema, privateConfig]);
    if (cleanupError) throw cleanupError;
  }
  if (operationError) throw operationError;
}

export async function runGuardedPrismaMigrationCommandForTest({ schemaPath, operation, spawnProcess, sourceEnvironment = process.env, testHooks } = {}) {
  return runGuardedPrismaCommandSequenceForTest({ commands: [{ schemaPath, operation }], spawnProcess, sourceEnvironment, testHooks });
}

export async function runGuardedPrismaCommandSequenceForTest({ commands, spawnProcess, sourceEnvironment = process.env, testHooks } = {}) {
  const privateConfig = await createPrivatePrismaConfigWorkspace({ testHooks });
  let operationError;
  const results = [];
  try {
    for (const command of commands) {
      results.push(await runPrismaCommand({ repositoryRoot, localUrl: sourceEnvironment.DAILY_GOAL_EPHEMERAL_JOB_DATABASE_URL, schemaPath: command.schemaPath, operation: command.operation, privateConfig, spawnProcess, sourceEnvironment, testHooks }));
    }
  } catch (error) {
    operationError = error;
  } finally {
    const cleanupError = await cleanupHandles([privateConfig]);
    if (cleanupError) throw cleanupError;
  }
  if (operationError) throw operationError;
  return results.length === 1 ? results[0] : results;
}

async function readReviewedPrismaFileOnce(filePath, contract, label) {
  const info = await lstat(filePath);
  if (!info.isFile() || info.isSymbolicLink()) throw new Error(`${label} is not a reviewed regular file.`);
  const bytes = await readFile(filePath);
  if (bytes.includes(Buffer.from("\r\n"))) throw new Error(`${label} is not LF-only.`);
  const checksum = createHash("sha256").update(bytes).digest("hex");
  if (bytes.length !== contract.byteCount || checksum !== contract.checksum) throw new Error(`${label} bytes do not match the reviewed contract.`);
  return bytes;
}

async function createPrivatePrismaConfigWorkspace({ testHooks } = {}) {
  const bytes = await readReviewedPrismaFileOnce(EPHEMERAL_PRISMA_CONFIG_PATH, EPHEMERAL_PRISMA_CONFIG, "Prisma config");
  await testHooks?.afterConfigSourceRead?.({ sourcePath: EPHEMERAL_PRISMA_CONFIG_PATH, bytes: Buffer.from(bytes) });
  let directory;
  try {
    directory = await mkdtemp(path.join(repositoryRoot, "backend/.daily-goal-prisma-"));
    await chmod(directory, 0o700);
    const destination = path.join(directory, "ephemeral-prisma.config.ts");
    await testHooks?.beforePrivateWrite?.({ label: "config", destination });
    await writeFile(destination, bytes, { flag: "wx", mode: 0o600 });
    await testHooks?.afterPrivateWrite?.({ label: "config", destination });
    const expected = privateArtifactContract(bytes, EPHEMERAL_PRISMA_CONFIG);
    await verifyDestinationBytes(destination, expected, "Private Prisma config");
    return createPrivateArtifactHandle(directory, destination, "config", expected, testHooks);
  } catch (error) {
    if (directory) await rm(directory, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}

async function materializePrivateSchema(schemaPath, { repositoryStatic = false, testHooks } = {}) {
  if (repositoryStatic && schemaPath !== EPHEMERAL_PRISMA_SCHEMA_PATH) throw new Error("Static Prisma schema path is not reviewed.");
  if (!repositoryStatic) await verifyEphemeralSchemaSourcePath(schemaPath);
  const bytes = await readReviewedPrismaFileOnce(schemaPath, EPHEMERAL_PRISMA_SCHEMA, "Prisma schema");
  await testHooks?.afterSchemaSourceRead?.({ sourcePath: schemaPath, bytes: Buffer.from(bytes) });
  let parent;
  let ownsParent = false;
  let destination;
  try {
    if (repositoryStatic) {
      parent = await mkdtemp(path.join(repositoryRoot, "backend/.daily-goal-schema-"));
      ownsParent = true;
      await chmod(parent, 0o700);
    } else parent = path.dirname(schemaPath);
    destination = path.join(parent, `.daily-goal-private-${process.pid}-${randomBytes(12).toString("hex")}.prisma`);
    await testHooks?.beforePrivateWrite?.({ label: "schema", destination });
    await writeFile(destination, bytes, { flag: "wx", mode: 0o600 });
    await testHooks?.afterPrivateWrite?.({ label: "schema", destination });
    const expected = privateArtifactContract(bytes, EPHEMERAL_PRISMA_SCHEMA);
    await verifyDestinationBytes(destination, expected, "Private Prisma schema");
    return createPrivateArtifactHandle(ownsParent ? parent : null, destination, "schema", expected, testHooks);
  } catch (error) {
    if (ownsParent && parent) await rm(parent, { recursive: true, force: true }).catch(() => {});
    else if (destination) await unlink(destination).catch(() => {});
    throw error;
  }
}

async function verifyEphemeralSchemaSourcePath(schemaPath) {
  if (typeof schemaPath !== "string" || path.basename(schemaPath) !== "schema.prisma") throw new Error("Ephemeral schema path is invalid.");
  const resolved = await realpath(schemaPath);
  const temporaryRoot = `${await realpath(os.tmpdir())}${path.sep}`;
  if (!resolved.startsWith(temporaryRoot)) throw new Error("Ephemeral schema is outside the temporary workspace.");
  const info = await lstat(schemaPath);
  if (!info.isFile() || info.isSymbolicLink()) throw new Error("Ephemeral schema is not a regular file.");
}

async function verifyDestinationBytes(filePath, contract, label) {
  const info = await lstat(filePath);
  if (!info.isFile() || info.isSymbolicLink()) throw new Error(`${label} destination is not a regular file.`);
  const bytes = await readFile(filePath);
  if (contract.lfOnly && bytes.includes(Buffer.from("\r\n"))) throw new Error(`${label} destination is not LF-only.`);
  const checksum = createHash("sha256").update(bytes).digest("hex");
  if (bytes.length !== contract.byteCount || checksum !== contract.checksum || !bytes.equals(contract.bytes)) throw new Error(`${label} destination bytes mismatch.`);
}

function verifyDestinationBytesSync(filePath, contract, label) {
  const info = lstatSync(filePath);
  if (!info.isFile() || info.isSymbolicLink()) throw new Error(`${label} destination is not a regular file.`);
  const bytes = readFileSync(filePath);
  if (contract.lfOnly && bytes.includes(Buffer.from("\r\n"))) throw new Error(`${label} destination is not LF-only.`);
  const checksum = createHash("sha256").update(bytes).digest("hex");
  if (bytes.length !== contract.byteCount || checksum !== contract.checksum || !bytes.equals(contract.bytes)) throw new Error(`${label} destination bytes mismatch.`);
}

function spawnPrismaAfterFinalValidation({ privateConfig, privateSchema, ...spawnInput }) {
  privateConfig.revalidateSync();
  privateSchema.revalidateSync();
  return spawnPrisma(spawnInput);
}

function privateArtifactContract(bytes, reviewedContract) {
  const contract = Object.freeze({
    bytes: Buffer.from(bytes),
    byteCount: bytes.length,
    checksum: createHash("sha256").update(bytes).digest("hex"),
    lfOnly: true,
  });
  if (contract.byteCount !== reviewedContract.byteCount || contract.checksum !== reviewedContract.checksum) throw new Error("Private artifact metadata does not match the reviewed contract.");
  return contract;
}

function createPrivateArtifactHandle(directory, filePath, label, expected, testHooks) {
  let attempted = false;
  return {
    path: filePath,
    revalidateSync() {
      verifyDestinationBytesSync(filePath, expected, `Private Prisma ${label}`);
    },
    async cleanup() {
      if (attempted) throw new Error("Private Prisma cleanup was already attempted.");
      attempted = true;
      await testHooks?.onCleanupAttempt?.({ label, directory, filePath });
      if (directory) await rm(directory, { recursive: true });
      else await rm(filePath, { recursive: true });
      if (testHooks?.failCleanupLabel === label) throw new Error("Injected private cleanup failure.");
    },
  };
}

async function cleanupHandles(handles) {
  let firstError;
  for (const handle of handles) {
    if (!handle) continue;
    try { await handle.cleanup(); } catch (error) { firstError ??= error; }
  }
  return firstError ? new Error("Private Prisma cleanup failed.") : null;
}

export async function verifyStaticPrismaInputs() {
  const privateConfig = await createPrivatePrismaConfigWorkspace();
  let privateSchema;
  try { privateSchema = await materializePrivateSchema(EPHEMERAL_PRISMA_SCHEMA_PATH, { repositoryStatic: true }); }
  finally {
    const cleanupError = await cleanupHandles([privateSchema, privateConfig]);
    if (cleanupError) throw cleanupError;
  }
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
    if (process.argv[2] === "--verify-static-prisma-inputs") {
      await verifyStaticPrismaInputs();
      return;
    }
    if (process.argv[2] === "--generate") {
      await runGuardedPrismaGenerate();
      return;
    }
    const result = await runEphemeralMigrationCli();
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(`${JSON.stringify(createRefusalEvidence(error))}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

export { EPHEMERAL_OPERATION, MIGRATION_INVENTORY_DIGEST };
