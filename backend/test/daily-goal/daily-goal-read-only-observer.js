import { verifyConnectedTarget } from "./daily-goal-migration-domain.js";

export const CI_EXCLUSIVE_OWNERSHIP_PREFIX = "elvocab-ci-exclusive:v1:";
export const READ_ONLY_EVIDENCE_SOURCE = "POSTGRESQL_TRANSACTION_READ_ONLY";

export const DAILY_GOAL_READ_ONLY_QUERIES = Object.freeze({
  TARGET_OBSERVATION: `SELECT
  current_database()::text AS database_name,
  inet_server_addr()::text AS server_endpoint,
  inet_server_port()::text AS server_port,
  current_schema()::text AS schema_name,
  shobj_description(
    (SELECT oid FROM pg_database WHERE datname = current_database()),
    'pg_database'
  )::text AS ownership_marker`,
  MIGRATION_HISTORY: `SELECT
  migration_name,
  checksum,
  finished_at,
  rolled_back_at,
  logs
FROM "public"."_prisma_migrations"
ORDER BY started_at ASC, migration_name ASC`,
});

const MUTATING_SQL = /\b(?:ALTER|ANALYZE|CALL|COMMENT|COPY|CREATE|DELETE|DO|DROP|GRANT|INSERT|LOCK|MERGE|REASSIGN|REFRESH|REINDEX|RESET|REVOKE|SECURITY|SET|TRUNCATE|UPDATE|VACUUM)\b/i;
const SAFE_IDENTITY = /^[A-Za-z0-9][A-Za-z0-9_.:/-]{2,255}$/;

export function assertReadOnlyObservationQueries(queries = DAILY_GOAL_READ_ONLY_QUERIES) {
  for (const [name, sql] of Object.entries(queries)) {
    if (typeof sql !== "string" || !/^\s*(?:SELECT|WITH)\b/i.test(sql)) {
      throw observerError(`${name} must be a SELECT/CTE query.`);
    }
    if (MUTATING_SQL.test(sql) || sql.includes(";")) {
      throw observerError(`${name} contains a prohibited SQL operation.`);
    }
  }
  return queries;
}

export function createDailyGoalReadOnlyObserver({ openConnection }) {
  if (typeof openConnection !== "function") {
    throw new TypeError("An injected read-only connection factory is required.");
  }
  assertReadOnlyObservationQueries();

  return Object.freeze({
    async withObservation({ authorization, expectedTarget, operation }) {
      if (authorization?.operation !== "observation") {
        throw observerError("Observation authorization is required before connecting.");
      }
      if (typeof operation !== "function") {
        throw new TypeError("A read-only observation callback is required.");
      }

      let connection;
      try {
        connection = await openConnection(Object.freeze({
          databaseUrl: authorization.databaseUrl,
          requiredMode: "READ_ONLY",
        }));
        assertConnection(connection);
        const readOnlyEvidence = assertReadOnlyEvidence(
          await connection.establishAndVerifyReadOnly(),
        );
        const observation = await readTargetObservation(connection);
        const internalTargetToken = Object.freeze({ connectedObservation: true });
        const verified = verifyConnectedTarget({
          authorization,
          expected: expectedTarget,
          observation,
          targetBindingToken: internalTargetToken,
        });
        const history = await readPrismaMigrationHistory(connection);
        const snapshot = Object.freeze({
          targetBinding: verified.binding,
          observation: verified.observation,
          history: freezeHistory(history),
          readOnlyEvidence,
        });
        return await operation(snapshot);
      } catch (error) {
        if (error?.code === "DAILY_GOAL_READ_ONLY_OBSERVATION_FAILED") throw error;
        throw observerError("Daily Goal read-only observation failed.");
      } finally {
        if (connection && typeof connection.close === "function") {
          try {
            await connection.close();
          } catch {
            throw observerError("Daily Goal read-only observation cleanup failed.");
          }
        }
      }
    },
  });
}

export function mapPrismaMigrationHistory(rows) {
  if (!Array.isArray(rows)) {
    throw observerError("Prisma migration history rows are required.");
  }
  return Object.freeze(rows.map((row) => {
    const name = readText(row, "migration_name");
    const checksum = readText(row, "checksum");
    const finishedAt = row?.finished_at ?? null;
    const rolledBackAt = row?.rolled_back_at ?? null;
    const logs = typeof row?.logs === "string" ? row.logs.trim() : "";
    let status = "INCOMPLETE";
    if (rolledBackAt !== null || logs.length > 0) status = "FAILED";
    else if (finishedAt !== null) status = "APPLIED";
    return Object.freeze({ name, checksum, status });
  }));
}

async function readTargetObservation(connection) {
  const rows = await queryRows(connection, DAILY_GOAL_READ_ONLY_QUERIES.TARGET_OBSERVATION);
  if (rows.length !== 1) {
    throw observerError("Connected target observation must return exactly one row.");
  }
  const row = rows[0];
  const ownershipMarker = readText(row, "ownership_marker");
  if (!ownershipMarker.startsWith(CI_EXCLUSIVE_OWNERSHIP_PREFIX)) {
    throw observerError("Independent CI-exclusive ownership evidence is missing.");
  }
  const targetIdentity = ownershipMarker.slice(CI_EXCLUSIVE_OWNERSHIP_PREFIX.length);
  if (!SAFE_IDENTITY.test(targetIdentity)) {
    throw observerError("Independent CI-exclusive ownership evidence is malformed.");
  }
  return Object.freeze({
    targetIdentity,
    databaseName: readText(row, "database_name"),
    serverEndpoint: readText(row, "server_endpoint"),
    serverPort: readText(row, "server_port"),
    schemaName: readText(row, "schema_name"),
    ownershipMarker,
    evidenceSource: "CONNECTED_POSTGRESQL",
    derivedFromConfiguration: false,
  });
}

async function readPrismaMigrationHistory(connection) {
  return mapPrismaMigrationHistory(
    await queryRows(connection, DAILY_GOAL_READ_ONLY_QUERIES.MIGRATION_HISTORY),
  );
}

async function queryRows(connection, sql) {
  assertReadOnlyObservationQueries({ query: sql });
  const result = await connection.query(sql);
  if (!result || !Array.isArray(result.rows)) {
    throw observerError("Read-only query returned an invalid result.");
  }
  return result.rows;
}

function assertConnection(connection) {
  if (!connection
    || typeof connection.establishAndVerifyReadOnly !== "function"
    || typeof connection.query !== "function"
    || typeof connection.close !== "function") {
    throw observerError("Injected connection does not satisfy the read-only contract.");
  }
}

function assertReadOnlyEvidence(evidence) {
  if (!evidence
    || evidence.enforced !== true
    || evidence.transactionReadOnly !== true
    || evidence.evidenceSource !== READ_ONLY_EVIDENCE_SOURCE) {
    throw observerError("PostgreSQL read-only enforcement was not verified.");
  }
  return Object.freeze({
    enforced: true,
    transactionReadOnly: true,
    evidenceSource: READ_ONLY_EVIDENCE_SOURCE,
  });
}

function freezeHistory(history) {
  return Object.freeze(history.map((entry) => Object.freeze({ ...entry })));
}

function readText(row, field) {
  const value = row?.[field];
  if (typeof value !== "string" || value.length === 0) {
    throw observerError(`Connected ${field} evidence is missing.`);
  }
  return value;
}

function observerError(message) {
  const error = new Error(message);
  error.code = "DAILY_GOAL_READ_ONLY_OBSERVATION_FAILED";
  return error;
}
