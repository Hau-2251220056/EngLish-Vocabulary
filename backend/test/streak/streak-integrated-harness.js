import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { configureTestEnvironment } from "../helpers/test-environment.js";
import {
  assertIntegratedSchemaOwnership,
  buildIntegratedSchemaContext,
  catalogDatabaseUrl,
  scopedIntegratedDatabaseUrl,
} from "./streak-integrated-safety.js";

const backendDirectory = fileURLToPath(new URL("../../", import.meta.url));
const frontendDirectory = fileURLToPath(new URL("../../../frontend/", import.meta.url));
const prismaCli = path.join(backendDirectory, "node_modules", "prisma", "build", "index.js");
let baseDatabaseUrl;
let schemaContext;
let primaryError;

try {
  schemaContext = buildIntegratedSchemaContext(process.env, randomBytes(4).toString("hex"));
  ({ databaseUrl: baseDatabaseUrl } = configureTestEnvironment({ requireReset: true }));
  await createOwnedSchema();
  const scopedUrl = scopedIntegratedDatabaseUrl(baseDatabaseUrl, schemaContext.schemaName);
  const scopedEnvironment = {
    ...process.env,
    TEST_DATABASE_URL: scopedUrl,
    DATABASE_URL: scopedUrl,
    STREAK_INTEGRATED_SCHEMA_NAME: schemaContext.schemaName,
    STREAK_INTEGRATED_SCHEMA_MARKER: schemaContext.marker,
  };
  await runChecked(process.execPath, [prismaCli, "migrate", "deploy"], backendDirectory, scopedEnvironment);
  await assertOwnedSchema();
  await runChecked(
    process.execPath,
    [
      path.join(frontendDirectory, "node_modules", "@playwright", "test", "cli.js"),
      "test",
      "--config=playwright.streak-integration.config.js",
    ],
    frontendDirectory,
    scopedEnvironment,
  );
} catch (error) {
  primaryError = error;
} finally {
  let cleanupError;
  if (schemaContext && baseDatabaseUrl) {
    try {
      await dropOwnedSchema();
    } catch (error) {
      cleanupError = error;
    }
  }
  if (primaryError || cleanupError) {
    process.exitCode = 1;
    if (primaryError) console.error(`TASK-249 integrated harness: FAIL - ${safeMessage(primaryError)}`);
    if (cleanupError) console.error(`TASK-249 cleanup: BLOCKING FAILURE - ${safeMessage(cleanupError)}`);
  } else {
    console.log("TASK-249 owned-schema real-stack verification: PASS");
  }
}

async function createOwnedSchema() {
  await withCatalogClient(async (prisma) => {
    await prisma.$transaction(async (transaction) => {
      await transaction.$executeRawUnsafe(`CREATE SCHEMA "${schemaContext.schemaName}"`);
      await transaction.$executeRawUnsafe(
        `COMMENT ON SCHEMA "${schemaContext.schemaName}" IS '${schemaContext.marker}'`,
      );
    });
  });
  await assertOwnedSchema();
}

async function assertOwnedSchema() {
  await withCatalogClient(async (prisma) => {
    const [row] = await prisma.$queryRaw`
      SELECT nspname AS current_schema,
             obj_description(oid, 'pg_namespace') AS marker
        FROM pg_namespace
       WHERE nspname = ${schemaContext.schemaName}
    `;
    assertIntegratedSchemaOwnership({
      schemaName: schemaContext.schemaName,
      currentSchema: row?.current_schema,
      marker: row?.marker,
      ownership: schemaContext.ownership,
    });
  });
}

async function dropOwnedSchema() {
  await withCatalogClient(async (prisma) => {
    const [row] = await prisma.$queryRaw`
      SELECT nspname AS current_schema,
             obj_description(oid, 'pg_namespace') AS marker
        FROM pg_namespace
       WHERE nspname = ${schemaContext.schemaName}
    `;
    if (!row) return;
    assertIntegratedSchemaOwnership({
      schemaName: schemaContext.schemaName,
      currentSchema: row.current_schema,
      marker: row.marker,
      ownership: schemaContext.ownership,
    });
    await prisma.$executeRawUnsafe(`DROP SCHEMA "${schemaContext.schemaName}" CASCADE`);
  });
}

async function withCatalogClient(action) {
  const { PrismaClient } = await import("../../src/generated/prisma/client.ts");
  const prisma = new PrismaClient({ datasourceUrl: catalogDatabaseUrl(baseDatabaseUrl) });
  try {
    await prisma.$connect();
    return await action(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

function runChecked(command, args, cwd, environment) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env: environment, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code) => code === 0
      ? resolve()
      : reject(new Error(`Guarded child process exited with code ${code ?? 1}.`)));
  });
}

function safeMessage(error) {
  const message = error instanceof Error ? error.message : String(error);
  const withoutUrls = message.replace(/postgres(?:ql)?:\/\/\S+/gi, "<redacted-database-url>");
  return baseDatabaseUrl
    ? withoutUrls.replaceAll(baseDatabaseUrl, "<redacted-database-url>")
    : withoutUrls;
}
