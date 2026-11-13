import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const ALLOW = "true";
const SAFE_TOKEN = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;
const SAFE_HOST = /^[A-Za-z0-9][A-Za-z0-9.-]{0,252}$/;
const SAFE_PORT = /^[0-9]{1,5}$/;
const SAFE_DATABASE = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,62}$/;
const SAFE_SCHEMA = /^elvocab_cefr_([a-z0-9_]{2,20})_([A-Za-z0-9_.-]{1,32})_([A-Za-z0-9_.-]{1,16})_([a-f0-9]{8})$/;
const MARKER_PREFIX = "elvocab-cefr-harness:v1:";
const FORBIDDEN_IDENTITY = /(main|preview|prod(?:uction)?|development|daily[-_. ]?goal|shared|manual)/i;
const V2_EVIDENCE_SOURCES = Object.freeze([
  "NORMAL_REVEALED",
  "SRS_AGAIN",
  "SRS_HARD",
  "SRS_GOOD",
  "SRS_EASY",
]);
const backendRoot = fileURLToPath(new URL("../../", import.meta.url));
const prismaCli = fileURLToPath(new URL("../../node_modules/prisma/build/index.js", import.meta.url));

export function inspectCefrV2Migration(sql) {
  assert.equal(typeof sql, "string");
  assert.ok(sql.length > 0, "CEFR V2 migration SQL is required.");

  for (const source of V2_EVIDENCE_SOURCES) {
    assert.match(sql, new RegExp(`'${source}'`), `Missing CEFR evidence source ${source}.`);
  }
  for (const column of [
    "first_credit_source",
    "first_credit_event_id",
    "first_credit_session_id",
    "first_credit_accepted_at",
  ]) {
    assert.match(sql, new RegExp(`ADD COLUMN "${column}"`), `Missing ${column}.`);
  }

  assert.match(sql, /CEFR_LEARNING_PASS_ITEM_first_credit_tuple_check/);
  assert.match(sql, /CEFR_LEARNING_PASS_ITEM_first_credit_event_id_key/);
  assert.match(sql, /CEFR_LEARNING_PASS_ITEM_first_credit_session_id_fkey/);
  assert.match(sql, /DROP CONSTRAINT "LEARNING_SESSION_pass_scope_check"/);
  assert.match(sql, /"scope" = 'SET' AND "mode" IN \('NORMAL', 'SRS'\)/);
  assert.match(sql, /ROW_NUMBER\(\) OVER/);
  assert.match(
    sql,
    /ORDER BY session_item\."evidence_at" ASC, session_item\."evidence_event_id" ASC/,
  );
  assert.match(sql, /session\."user_id" = pass\."user_id"/);
  assert.match(sql, /session\."set_id_snapshot" = pass\."set_id_snapshot"/);
  assert.match(sql, /session_item\."vocabulary_id" = pass_item\."vocabulary_id"/);
  assert.match(sql, /session_item\."evidence_at" >= session\."created_at"/);
  assert.match(sql, /session_item\."evidence_at" < session\."expires_at"/);
  assert.match(sql, /RAISE EXCEPTION 'CEFR V2 backfill rejected inconsistent pass-linked NORMAL evidence \(pass %, session %, session item %\)'/);

  const updateTargets = [...sql.matchAll(/\bUPDATE\s+"([A-Z_]+)"/gi)]
    .map((match) => match[1]);
  assert.deepEqual([...new Set(updateTargets)], ["CEFR_LEARNING_PASS_ITEM"]);
  assert.doesNotMatch(sql, /\b(?:INSERT\s+INTO|DELETE\s+FROM)\b/i);
  assert.doesNotMatch(sql, /\bUPDATE\s+"(?:CEFR_LEARNING_PASS|CEFR_LEARNING_PATH_STATE)"/i);
  assert.doesNotMatch(sql, /"(?:completion_event_id|completed_at|highest_unlocked_level|path_completed_at)"/);
  assert.doesNotMatch(sql, /ALTER\s+TABLE\s+"(?:LEARNING_PROGRESS|XP_REWARD|STREAK_DAY)"/i);

  return Object.freeze({
    evidenceSources: V2_EVIDENCE_SOURCES,
    updateTargets: Object.freeze(updateTargets),
  });
}

export function authorizeCefrHarness(environment = process.env) {
  assert.equal(environment.NODE_ENV, "test", "NODE_ENV must equal test.");
  assert.equal(environment.CEFR_TEST_DATABASE_ALLOW_OPERATION, ALLOW,
    "CEFR_TEST_DATABASE_ALLOW_OPERATION must explicitly equal true.");
  assert.equal(environment.CEFR_TEST_DATABASE_EXCLUSIVE, ALLOW,
    "CEFR_TEST_DATABASE_EXCLUSIVE must explicitly confirm a disposable exclusive target.");

  const runId = requiredToken(environment.CEFR_TEST_RUN_ID, "CEFR_TEST_RUN_ID");
  const attempt = requiredToken(environment.CEFR_TEST_RUN_ATTEMPT, "CEFR_TEST_RUN_ATTEMPT");
  const expectedHost = requiredHost(environment.CEFR_TEST_DATABASE_EXPECTED_HOST);
  const expectedPort = requiredPort(environment.CEFR_TEST_DATABASE_EXPECTED_PORT);
  const expectedDatabase = requiredDatabase(environment.CEFR_TEST_DATABASE_EXPECTED_NAME);
  const approvedIdentity = `${expectedHost}:${expectedPort}/${expectedDatabase}`;
  assert.doesNotMatch(approvedIdentity, FORBIDDEN_IDENTITY,
    "The approved CEFR target identity is not an exclusive disposable TEST identity.");

  const rawUrl = environment.TEST_DATABASE_URL;
  assert.equal(typeof rawUrl, "string", "TEST_DATABASE_URL is required; DATABASE_URL is never a fallback.");
  let url;
  try { url = new URL(rawUrl); } catch { assert.fail("TEST_DATABASE_URL must be a valid URL."); }
  assert.equal(url.protocol === "postgres:" || url.protocol === "postgresql:", true,
    "TEST_DATABASE_URL must use PostgreSQL.");
  assert.equal(url.hostname, expectedHost, "TEST database host differs from the HUMAN-approved target.");
  assert.equal(url.port || "5432", expectedPort, "TEST database port differs from the HUMAN-approved target.");
  assert.equal(decodeURIComponent(url.pathname.slice(1)), expectedDatabase,
    "TEST database name differs from the HUMAN-approved target.");
  assert.equal(url.searchParams.has("schema"), false,
    "Base TEST_DATABASE_URL must not select a pre-existing schema.");

  return Object.freeze({ url, runId, attempt, approvedIdentity });
}

export function buildOwnedSchemaName(scenario, identity, suffix = randomBytes(4).toString("hex")) {
  assert.match(scenario, /^[a-z0-9_]{2,20}$/);
  assert.match(suffix, /^[a-f0-9]{8}$/);
  const schema = `elvocab_cefr_${scenario}_${identity.runId}_${identity.attempt}_${suffix}`;
  assertSafeSchemaName(schema);
  return schema;
}

export function assertSafeSchemaName(schema) {
  assert.match(schema, SAFE_SCHEMA);
  assert.notEqual(schema, "public");
  return schema;
}

export function buildOwnership(identity, schema) {
  assertSafeSchemaName(schema);
  const match = schema.match(SAFE_SCHEMA);
  assert.equal(match[2], identity.runId);
  assert.equal(match[3], identity.attempt);
  return Object.freeze({ version: 1, run_id: identity.runId, run_attempt: identity.attempt, schema });
}

export function encodeOwnershipMarker(ownership) {
  return `${MARKER_PREFIX}${Buffer.from(JSON.stringify(ownership)).toString("base64url")}`;
}

export function assertOwnershipMarker(marker, expected) {
  assert.equal(typeof marker, "string");
  assert.equal(marker.startsWith(MARKER_PREFIX), true);
  const actual = JSON.parse(Buffer.from(marker.slice(MARKER_PREFIX.length), "base64url").toString("utf8"));
  assert.deepEqual(actual, expected);
  return actual;
}

export function schemaDatabaseUrl(baseUrl, schema) {
  assertSafeSchemaName(schema);
  const url = new URL(baseUrl);
  url.searchParams.set("schema", schema);
  return url.toString();
}

export async function createCefrHarness(environment = process.env) {
  const identity = authorizeCefrHarness(environment);
  const { PrismaClient } = await import("../../src/generated/prisma/client.ts");
  const owned = new Map();

  async function createSchema(scenario) {
    const schema = buildOwnedSchemaName(scenario, identity);
    const ownership = buildOwnership(identity, schema);
    const catalog = new PrismaClient({ datasourceUrl: catalogUrl(identity.url) });
    try {
      await catalog.$connect();
      await catalog.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
      await catalog.$executeRawUnsafe(`COMMENT ON SCHEMA "${schema}" IS '${encodeOwnershipMarker(ownership)}'`);
      owned.set(schema, ownership);
    } finally { await catalog.$disconnect(); }
    await assertOwnedSchema(identity.url, schema, ownership, PrismaClient);
    return Object.freeze({ schema, databaseUrl: schemaDatabaseUrl(identity.url, schema), ownership });
  }

  async function deployMigrations(target, schemaPath) {
    assert.equal(owned.has(target.schema), true, "Migration target must be owned by this run.");
    const env = { ...process.env, DATABASE_URL: target.databaseUrl };
    const args = [prismaCli, "migrate", "deploy"];
    if (schemaPath) args.push("--schema", schemaPath);
    const exitCode = await spawnExit(process.execPath, args, { cwd: backendRoot, env });
    assert.equal(exitCode, 0, "Prisma migrate deploy failed in the run-owned schema.");
  }

  async function deployMigrationsExpectFailure(target, schemaPath) {
    assert.equal(owned.has(target.schema), true, "Migration target must be owned by this run.");
    const env = { ...process.env, DATABASE_URL: target.databaseUrl };
    const args = [prismaCli, "migrate", "deploy"];
    if (schemaPath) args.push("--schema", schemaPath);
    const exitCode = await spawnExit(process.execPath, args, { cwd: backendRoot, env });
    assert.notEqual(exitCode, 0, "Inconsistent V1 evidence must abort the V2 migration.");
  }

  async function withClient(target, action) {
    assert.equal(owned.has(target.schema), true);
    const prisma = new PrismaClient({ datasourceUrl: target.databaseUrl });
    try {
      await prisma.$connect();
      await assertCurrentAndOwned(prisma, target.schema, target.ownership);
      return await action(prisma);
    } finally { await prisma.$disconnect(); }
  }

  async function cleanup() {
    const errors = [];
    for (const [schema, ownership] of [...owned.entries()].reverse()) {
      const prisma = new PrismaClient({ datasourceUrl: schemaDatabaseUrl(identity.url, schema) });
      try {
        await prisma.$connect();
        await assertCurrentAndOwned(prisma, schema, ownership);
        await prisma.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
        owned.delete(schema);
      } catch (error) { errors.push(error); }
      finally { await prisma.$disconnect().catch(() => {}); }
    }
    assert.equal(errors.length, 0, `CEFR schema cleanup failed for ${errors.length} run-owned schema(s).`);
  }

  return Object.freeze({
    identity,
    createSchema,
    deployMigrations,
    deployMigrationsExpectFailure,
    withClient,
    cleanup,
  });
}

async function assertOwnedSchema(baseUrl, schema, ownership, PrismaClient) {
  const prisma = new PrismaClient({ datasourceUrl: schemaDatabaseUrl(baseUrl, schema) });
  try { await prisma.$connect(); await assertCurrentAndOwned(prisma, schema, ownership); }
  finally { await prisma.$disconnect(); }
}

async function assertCurrentAndOwned(prisma, schema, ownership) {
  const [row] = await prisma.$queryRawUnsafe(
    "SELECT current_schema() AS schema, obj_description(n.oid, 'pg_namespace') AS marker FROM pg_namespace n WHERE n.nspname = current_schema()",
  );
  assert.equal(row?.schema, schema);
  assertOwnershipMarker(row?.marker, ownership);
}

function catalogUrl(baseUrl) { const url = new URL(baseUrl); url.searchParams.set("schema", "pg_catalog"); return url.toString(); }
function requiredToken(value, name) { assert.equal(typeof value, "string"); assert.match(value, SAFE_TOKEN, `${name} is invalid.`); return value; }
function requiredHost(value) { assert.equal(typeof value, "string"); assert.match(value, SAFE_HOST); return value; }
function requiredPort(value) { assert.equal(typeof value, "string"); assert.match(value, SAFE_PORT); assert.ok(Number(value) <= 65535); return value; }
function requiredDatabase(value) { assert.equal(typeof value, "string"); assert.match(value, SAFE_DATABASE); return value; }
function spawnExit(command, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { ...options, stdio: "inherit" });
    child.once("error", reject); child.once("exit", (code) => resolve(code ?? 1));
  });
}
