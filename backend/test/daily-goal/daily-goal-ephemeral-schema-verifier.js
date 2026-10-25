import { createHash } from "node:crypto";
import { DAILY_GOAL_SCHEMA_EVIDENCE } from "./daily-goal-phase-d-offline.js";

const EXPECTED_BEHAVIOR = Object.freeze([
  "CASCADE:USER->DAILY_GOAL_DAY",
  "SET_NULL:DAILY_GOAL_TRACKING_SESSION->DAILY_GOAL_OWNER",
  "RESTRICT:DAILY_GOAL_TRACKING_SESSION->DAILY_GOAL_OPERATION_RECEIPT",
]);
const DAILY_GOAL_MINUTES_CHECK_NAME = "USER_daily_goal_minutes_check";
const DAILY_GOAL_MINUTES_CATALOG_EXPRESSION =
  "daily_goal_minutes IS NULL OR (daily_goal_minutes >= 10 AND daily_goal_minutes <= 240)";

export async function collectDailyGoalSchemaEvidence(client) {
  const observedCatalog = normalizeCatalogEvidence(await readCatalog(client));
  const expectedCatalog = expectedCatalogEvidence();
  if (stable(observedCatalog) !== stable(expectedCatalog)) throw new Error("Daily Goal catalog evidence mismatch.");
  const observedBehavior = await runRequiredBehaviorProbes(client);
  if (stable(observedBehavior) !== stable(EXPECTED_BEHAVIOR)) throw new Error("Daily Goal behavior evidence mismatch.");
  return deepFreeze({
    status: "VERIFIED", complete: true, rollbackVerified: true,
    observedCatalog, expectedCatalog,
    observedBehavior, expectedBehavior: [...EXPECTED_BEHAVIOR],
    observedCatalogDigest: digest(observedCatalog), expectedCatalogDigest: digest(expectedCatalog),
  });
}

export async function runRequiredBehaviorProbes(client) {
  const observed = [];
  for (const probe of [probeCascade, probeSetNull, probeRestrict]) observed.push(await probe(client));
  return observed;
}

async function readCatalog(client) {
  const [tables, columns, enums, primaryKeys, uniqueConstraints, checks, indexes, foreignKeys] = await Promise.all([
    client.$queryRaw`SELECT tablename AS name FROM pg_catalog.pg_tables WHERE schemaname='public' AND (tablename LIKE 'DAILY_GOAL_%' OR tablename='USER_NOTIFICATION') ORDER BY tablename`,
    client.$queryRaw`SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default, character_maximum_length, datetime_precision FROM information_schema.columns WHERE table_schema='public' AND (table_name LIKE 'DAILY_GOAL_%' OR table_name='USER_NOTIFICATION' OR (table_name='USER' AND column_name LIKE 'daily_goal_%')) ORDER BY table_name, ordinal_position`,
    client.$queryRaw`SELECT t.typname AS name, array_agg(e.enumlabel ORDER BY e.enumsortorder) AS labels FROM pg_catalog.pg_type t JOIN pg_catalog.pg_enum e ON e.enumtypid=t.oid JOIN pg_catalog.pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' AND t.typname IN ('DAILY_GOAL_ACTIVITY_TYPE','DAILY_GOAL_TRACKING_STATUS','DAILY_GOAL_OPERATION_TYPE','USER_NOTIFICATION_TYPE') GROUP BY t.typname ORDER BY t.typname`,
    constraintColumns(client, "p"),
    constraintColumns(client, "u"),
    client.$queryRaw`SELECT con.conname AS name, pg_catalog.pg_get_constraintdef(con.oid, false) AS definition FROM pg_catalog.pg_constraint con JOIN pg_catalog.pg_namespace n ON n.oid=con.connamespace WHERE n.nspname='public' AND con.contype='c' AND (con.conname LIKE 'DAILY_GOAL_%' OR con.conname LIKE 'USER_NOTIFICATION_%' OR con.conname='USER_daily_goal_minutes_check') ORDER BY con.conname`,
    client.$queryRaw`SELECT indexname AS name, tablename AS table_name, indexdef AS definition FROM pg_catalog.pg_indexes WHERE schemaname='public' AND (indexname LIKE 'DAILY_GOAL_%' OR indexname LIKE 'USER_NOTIFICATION_%') ORDER BY indexname`,
    client.$queryRaw`SELECT con.conname AS name, src.relname AS source_table, dst.relname AS target_table, array_agg(sa.attname ORDER BY sk.ord) AS source_columns, array_agg(da.attname ORDER BY sk.ord) AS target_columns, con.confdeltype AS delete_action, con.confupdtype AS update_action FROM pg_catalog.pg_constraint con JOIN pg_catalog.pg_class src ON src.oid=con.conrelid JOIN pg_catalog.pg_class dst ON dst.oid=con.confrelid JOIN pg_catalog.pg_namespace n ON n.oid=con.connamespace JOIN LATERAL unnest(con.conkey, con.confkey) WITH ORDINALITY sk(source_attnum,target_attnum,ord) ON true JOIN pg_catalog.pg_attribute sa ON sa.attrelid=src.oid AND sa.attnum=sk.source_attnum JOIN pg_catalog.pg_attribute da ON da.attrelid=dst.oid AND da.attnum=sk.target_attnum WHERE n.nspname='public' AND con.contype='f' AND (con.conname LIKE 'DAILY_GOAL_%' OR con.conname LIKE 'USER_NOTIFICATION_%') GROUP BY con.conname,src.relname,dst.relname,con.confdeltype,con.confupdtype ORDER BY con.conname`,
  ]);
  return { tables, columns, enums, primaryKeys, uniqueConstraints, checks, indexes, foreignKeys };
}

async function constraintColumns(client, type) {
  if (!new Set(["p", "u"]).has(type)) throw new Error("Constraint type is not allowlisted.");
  return client.$queryRawUnsafe(`SELECT con.conname AS name, rel.relname AS table_name, array_agg(att.attname ORDER BY keys.ord) AS columns FROM pg_catalog.pg_constraint con JOIN pg_catalog.pg_class rel ON rel.oid=con.conrelid JOIN pg_catalog.pg_namespace n ON n.oid=con.connamespace JOIN LATERAL unnest(con.conkey) WITH ORDINALITY keys(attnum,ord) ON true JOIN pg_catalog.pg_attribute att ON att.attrelid=rel.oid AND att.attnum=keys.attnum WHERE n.nspname='public' AND con.contype='${type}' AND (con.conname LIKE 'DAILY_GOAL_%' OR con.conname LIKE 'USER_NOTIFICATION_%') GROUP BY con.conname,rel.relname ORDER BY con.conname`);
}

export function normalizeCatalogEvidence(rows) {
  return deepFreeze({
    tables: rows.tables.map((row) => row.name).sort(),
    columns: rows.columns.map(canonicalColumn).sort(),
    enums: rows.enums.map((row) => `${row.name}:${row.labels.join(",")}`).sort(),
    primaryKeys: rows.primaryKeys.map((row) => `${row.name}:${row.table_name}:${row.columns.join(",")}`).sort(),
    uniqueConstraints: rows.uniqueConstraints.map((row) => `${row.name}:${row.table_name}:${row.columns.join(",")}`).sort(),
    checks: rows.checks.map((row) => `${row.name}:${canonicalCheckExpression(row.definition)}`).sort(),
    indexes: rows.indexes.filter((row) => !row.name.endsWith("_pkey")).map(canonicalIndex).sort(),
    foreignKeys: rows.foreignKeys.map(canonicalForeignKey).sort(),
  });
}

export function expectedCatalogEvidence() {
  return deepFreeze({
    tables: [...DAILY_GOAL_SCHEMA_EVIDENCE.tables].sort(),
    columns: [...DAILY_GOAL_SCHEMA_EVIDENCE.columns].sort(),
    enums: [...DAILY_GOAL_SCHEMA_EVIDENCE.enums].sort(),
    primaryKeys: [...DAILY_GOAL_SCHEMA_EVIDENCE.primaryKeys].sort(),
    uniqueConstraints: [],
    checks: DAILY_GOAL_SCHEMA_EVIDENCE.constraints.map((value) => {
      const separator = value.indexOf(":");
      const name = value.slice(0, separator);
      const expression = name === DAILY_GOAL_MINUTES_CHECK_NAME
        ? DAILY_GOAL_MINUTES_CATALOG_EXPRESSION
        : value.slice(separator + 1);
      return `${name}:${canonicalCheckExpression(expression)}`;
    }).sort(),
    indexes: [...DAILY_GOAL_SCHEMA_EVIDENCE.indexes].sort(),
    foreignKeys: [...DAILY_GOAL_SCHEMA_EVIDENCE.foreignKeys].sort(),
  });
}

function canonicalColumn(row) {
  return `${row.table_name}.${row.column_name}:${columnType(row)}:${row.is_nullable === "YES" ? "NULLABLE" : "NOT_NULL"}:${columnDefault(row.column_default)}`;
}

function columnType(row) {
  if (row.data_type === "USER-DEFINED") return row.udt_name;
  if (row.data_type === "timestamp with time zone") return `TIMESTAMPTZ(${row.datetime_precision})`;
  if (row.data_type === "character varying") return `VARCHAR(${row.character_maximum_length})`;
  return ({ uuid: "UUID", integer: "INTEGER", bigint: "BIGINT", date: "DATE", boolean: "BOOLEAN", text: "TEXT", jsonb: "JSONB" })[row.data_type] ?? row.data_type;
}

function columnDefault(value) {
  if (value === null) return "NO_DEFAULT";
  if (value === "0" || value === "0::bigint") return "DEFAULT_0";
  if (/^CURRENT_TIMESTAMP$/i.test(value)) return "DEFAULT_CURRENT_TIMESTAMP";
  const enumDefault = /^'([^']+)'::/.exec(value);
  if (enumDefault) return `DEFAULT_${enumDefault[1]}`;
  throw new Error("Unexpected database default.");
}

export function canonicalCheckExpression(value) {
  return String(value).replace(/^CHECK\s*/i, "").replace(/"/g, "").replace(/'([a-zA-Z0-9_]+)'/g, "$1").replace(/::[a-zA-Z0-9_.\[\]]+/g, "")
    .replace(/\bAND\b/gi, "&&").replace(/\bOR\b/gi, "||").replace(/;/g, "&&")
    .replace(/[()\s]/g, "").toLowerCase();
}

function canonicalIndex(row) {
  const match = /^CREATE\s+(UNIQUE\s+)?INDEX\s+\S+\s+ON\s+(?:"?public"?\.)?"?([^"\s]+)"?\s+USING\s+btree\s*\((.+)\)$/i.exec(row.definition);
  if (!match) throw new Error("Index definition is not canonical btree evidence.");
  const columns = match[3].split(",").map((part) => part.trim().replace(/"/g, "").replace(/\s+NULLS\s+(?:FIRST|LAST)/ig, "").replace(/\s+/g, " "));
  return `${row.name}:${match[2]}:${match[1] ? "UNIQUE" : "NON_UNIQUE"}:${columns.map((part) => /\sDESC$/i.test(part) ? part.replace(/\sDESC$/i, " DESC") : `${part.replace(/\sASC$/i, "")} ASC`).join(",")}`;
}

function canonicalForeignKey(row) {
  const actions = { a: "NO_ACTION", r: "RESTRICT", c: "CASCADE", n: "SET_NULL", d: "SET_DEFAULT" };
  if (!actions[row.delete_action] || !actions[row.update_action]) throw new Error("Unknown foreign-key action.");
  return `${row.name}:${row.source_table}(${row.source_columns.join(",")})->${row.target_table}(${row.target_columns.join(",")}):ON_DELETE_${actions[row.delete_action]}:ON_UPDATE_${actions[row.update_action]}`;
}

async function probeCascade(client) {
  return rollbackProbe(client, async (tx) => {
    await insertUser(tx, "11", "cascade");
    await tx.$executeRaw`INSERT INTO "DAILY_GOAL_DAY" ("id","user_id","activity_date","updated_at") VALUES ('00000000-0000-4000-8000-000000000012','00000000-0000-4000-8000-000000000011',DATE '2000-01-01',CURRENT_TIMESTAMP)`;
    await tx.$executeRaw`DELETE FROM "USER" WHERE "id"='00000000-0000-4000-8000-000000000011'`;
    const rows = await tx.$queryRaw`SELECT count(*)::int AS count FROM "DAILY_GOAL_DAY" WHERE "id"='00000000-0000-4000-8000-000000000012'`;
    if (rows[0]?.count !== 0) throw new Error("CASCADE behavior mismatch.");
    return EXPECTED_BEHAVIOR[0];
  });
}

async function probeSetNull(client) {
  return rollbackProbe(client, async (tx) => {
    await insertUser(tx, "21", "set-null");
    await tx.$executeRaw`INSERT INTO "DAILY_GOAL_TRACKING_SESSION" ("id","user_id","activity_type","updated_at") VALUES ('00000000-0000-4000-8000-000000000022','00000000-0000-4000-8000-000000000021','NORMAL',CURRENT_TIMESTAMP)`;
    await tx.$executeRaw`INSERT INTO "DAILY_GOAL_OWNER" ("user_id","tracking_session_id","updated_at") VALUES ('00000000-0000-4000-8000-000000000021','00000000-0000-4000-8000-000000000022',CURRENT_TIMESTAMP)`;
    await tx.$executeRaw`DELETE FROM "DAILY_GOAL_TRACKING_SESSION" WHERE "id"='00000000-0000-4000-8000-000000000022'`;
    const rows = await tx.$queryRaw`SELECT tracking_session_id FROM "DAILY_GOAL_OWNER" WHERE user_id='00000000-0000-4000-8000-000000000021'`;
    if (rows.length !== 1 || rows[0].tracking_session_id !== null) throw new Error("SET NULL behavior mismatch.");
    return EXPECTED_BEHAVIOR[1];
  });
}

async function probeRestrict(client) {
  return rollbackProbe(client, async (tx) => {
    await insertUser(tx, "31", "restrict");
    await tx.$executeRaw`INSERT INTO "DAILY_GOAL_TRACKING_SESSION" ("id","user_id","activity_type","updated_at") VALUES ('00000000-0000-4000-8000-000000000032','00000000-0000-4000-8000-000000000031','NORMAL',CURRENT_TIMESTAMP)`;
    await tx.$executeRaw`INSERT INTO "DAILY_GOAL_OPERATION_RECEIPT" ("operation_id","user_id","tracking_session_id","operation_type","request_fingerprint","response_projection") VALUES ('00000000-0000-4000-8000-000000000033','00000000-0000-4000-8000-000000000031','00000000-0000-4000-8000-000000000032','CREATE','probe','{}'::jsonb)`;
    try {
      await tx.$executeRaw`DELETE FROM "DAILY_GOAL_TRACKING_SESSION" WHERE "id"='00000000-0000-4000-8000-000000000032'`;
    } catch (error) {
      if (error?.meta?.code === "23503" || /foreign key constraint/i.test(error?.message ?? "")) return EXPECTED_BEHAVIOR[2];
      throw error;
    }
    throw new Error("RESTRICT behavior mismatch.");
  });
}

async function insertUser(tx, suffix, label) {
  return tx.$executeRawUnsafe(`INSERT INTO "USER" ("id","email","password_hash","display_name","updated_at") VALUES ('00000000-0000-4000-8000-0000000000${suffix}','dg1-${label}@example.invalid','offline','DG1',CURRENT_TIMESTAMP)`);
}

async function rollbackProbe(client, operation) {
  const sentinel = Object.freeze({});
  let observed;
  try {
    await client.$transaction(async (tx) => {
      observed = await operation(tx);
      throw sentinel;
    });
  } catch (error) {
    if (error !== sentinel) throw error;
  }
  if (!observed) throw new Error("Behavior probe did not confirm rollback.");
  return observed;
}

function stable(value) { return JSON.stringify(value); }
function digest(value) { return createHash("sha256").update(stable(value)).digest("hex"); }
function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
