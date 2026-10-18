import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { configureTestEnvironment } from "../helpers/test-environment.js";
import {
  assertFoundationSchemaOwnership,
  buildFoundationSchemaContext,
} from "./streak-foundation-safety.js";

const backendDirectory = fileURLToPath(new URL("../../", import.meta.url));
const prismaCli = path.join(backendDirectory, "node_modules", "prisma", "build", "index.js");
let baseDatabaseUrl;
let schemaContext;
let schemaCreated = false;
let primaryError;

try {
  schemaContext = buildFoundationSchemaContext(
    process.env,
    randomBytes(4).toString("hex"),
  );
  ({ databaseUrl: baseDatabaseUrl } = configureTestEnvironment({ requireReset: true }));
  await createOwnedSchema();
  const scopedUrl = schemaDatabaseUrl(schemaContext.schemaName);
  await runChecked(process.execPath, [prismaCli, "migrate", "deploy"], {
    ...process.env,
    TEST_DATABASE_URL: scopedUrl,
    DATABASE_URL: scopedUrl,
  });
  await assertOwnedSchema();
  await runChecked(process.execPath, [
    "--test",
    "--test-concurrency=1",
    "test/streak/streak-foundation.integration.test.js",
  ], {
    ...process.env,
    TEST_DATABASE_URL: scopedUrl,
    DATABASE_URL: scopedUrl,
    STREAK_FOUNDATION_SCHEMA_NAME: schemaContext.schemaName,
    STREAK_FOUNDATION_SCHEMA_MARKER: schemaContext.marker,
  });
} catch (error) {
  primaryError = error;
} finally {
  let cleanupError;
  if (schemaCreated) {
    try {
      await dropOwnedSchema();
    } catch (error) {
      cleanupError = error;
    }
  }
  if (primaryError) {
    process.exitCode = 1;
    console.error(`Streak foundation harness: FAIL - ${safeMessage(primaryError)}`);
    if (cleanupError) {
      console.error(`Streak foundation cleanup: BLOCKING FAILURE - ${safeMessage(cleanupError)}`);
    }
  } else if (cleanupError) {
    process.exitCode = 1;
    console.error(`Streak foundation cleanup: BLOCKING FAILURE - ${safeMessage(cleanupError)}`);
  } else {
    console.log("Streak foundation PostgreSQL verification: PASS");
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
    schemaCreated = true;
  });
  await assertOwnedSchema();
}

async function assertOwnedSchema() {
  await withCatalogClient(async (prisma) => {
    const [row] = await prisma.$queryRawUnsafe(
      `SELECT nspname AS current_schema,
              obj_description(oid, 'pg_namespace') AS marker
         FROM pg_namespace
        WHERE nspname = $1`,
      schemaContext.schemaName,
    );
    assertFoundationSchemaOwnership({
      schemaName: schemaContext.schemaName,
      currentSchema: row?.current_schema,
      marker: row?.marker,
      ownership: schemaContext.ownership,
    });
  });
}

async function dropOwnedSchema() {
  await assertOwnedSchema();
  await withCatalogClient((prisma) =>
    prisma.$executeRawUnsafe(`DROP SCHEMA "${schemaContext.schemaName}" CASCADE`));
  schemaCreated = false;
}

async function withCatalogClient(action) {
  const { PrismaClient } = await import("../../src/generated/prisma/client.ts");
  const prisma = new PrismaClient({ datasourceUrl: catalogDatabaseUrl() });
  try {
    await prisma.$connect();
    return await action(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

function schemaDatabaseUrl(schemaName) {
  const url = new URL(baseDatabaseUrl);
  url.searchParams.set("schema", schemaName);
  return url.toString();
}

function catalogDatabaseUrl() {
  const url = new URL(baseDatabaseUrl);
  url.searchParams.set("schema", "pg_catalog");
  return url.toString();
}

function runChecked(command, args, environment) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: backendDirectory,
      env: environment,
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Guarded child process exited with code ${code ?? 1}.`));
    });
  });
}

function safeMessage(error) {
  const message = error instanceof Error ? error.message : String(error);
  const withoutUrls = message.replace(/postgres(?:ql)?:\/\/\S+/gi, "<redacted-database-url>");
  return baseDatabaseUrl
    ? withoutUrls.replaceAll(baseDatabaseUrl, "<redacted-database-url>")
    : withoutUrls;
}
