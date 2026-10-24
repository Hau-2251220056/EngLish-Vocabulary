import { verifyConnectedTarget } from "./daily-goal-migration-domain.js";
import {
  createDailyGoalPhaseBFailure,
  DAILY_GOAL_PHASE_B_FAILURE_CODES,
  getDailyGoalPhaseBFailureCode,
  getDailyGoalTargetPredicateFailureCode,
} from "./daily-goal-phase-b-diagnostics.js";

export const CI_EXCLUSIVE_OWNERSHIP_PREFIX = "elvocab-ci-exclusive:v1:";
export const READ_ONLY_EVIDENCE_SOURCE = "POSTGRESQL_TRANSACTION_READ_ONLY";

export const DAILY_GOAL_READ_ONLY_QUERIES = Object.freeze({
  TARGET_OBSERVATION: `SELECT
  current_database()::text AS database_name,
  host(inet_server_addr()) AS server_endpoint,
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
      throw diagnosticError(`${name} must be a SELECT/CTE query.`);
    }
    if (MUTATING_SQL.test(sql) || sql.includes(";")) {
      throw diagnosticError(`${name} contains a prohibited SQL operation.`);
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
        throw createDailyGoalPhaseBFailure(
          DAILY_GOAL_PHASE_B_FAILURE_CODES.CONFIG_REJECTED,
          {
            errorCode: "DAILY_GOAL_READ_ONLY_OBSERVATION_FAILED",
            message: "Observation authorization is required before connecting.",
          },
        );
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
        let readOnlyEvidence;
        try {
          readOnlyEvidence = assertReadOnlyEvidence(
            await connection.establishAndVerifyReadOnly(),
          );
        } catch {
          throw observerError(DAILY_GOAL_PHASE_B_FAILURE_CODES.READ_ONLY_ENFORCEMENT_FAILED);
        }
        const observation = await readTargetObservation(connection);
        const internalTargetToken = Object.freeze({ connectedObservation: true });
        let verified;
        try {
          verified = verifyConnectedTarget({
            authorization,
            expected: expectedTarget,
            observation,
            targetBindingToken: internalTargetToken,
          });
        } catch (error) {
          throw observerError(getDailyGoalTargetPredicateFailureCode(error));
        }
        const history = await readPrismaMigrationHistory(connection);
        const snapshot = Object.freeze({
          targetBinding: verified.binding,
          observation: verified.observation,
          history: freezeHistory(history),
          readOnlyEvidence,
        });
        return await operation(snapshot);
      } catch (error) {
        throw observerError(getDailyGoalPhaseBFailureCode(error));
      } finally {
        if (connection && typeof connection.close === "function") {
          try {
            await connection.close();
          } catch {
            throw observerError(DAILY_GOAL_PHASE_B_FAILURE_CODES.OBSERVER_CLEANUP_FAILED);
          }
        }
      }
    },
  });
}

export function mapPrismaMigrationHistory(rows) {
  if (!Array.isArray(rows)) {
    throw diagnosticError("Prisma migration history rows are required.");
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
  let rows;
  try {
    rows = await queryRows(connection, DAILY_GOAL_READ_ONLY_QUERIES.TARGET_OBSERVATION);
  } catch {
    throw observerError(DAILY_GOAL_PHASE_B_FAILURE_CODES.TARGET_OBSERVATION_FAILED);
  }
  if (rows.length !== 1) {
    throw observerError(DAILY_GOAL_PHASE_B_FAILURE_CODES.TARGET_OBSERVATION_FAILED);
  }
  const row = rows[0];
  const ownershipMarker = readText(
    row,
    "ownership_marker",
    DAILY_GOAL_PHASE_B_FAILURE_CODES.TARGET_OBSERVATION_FAILED,
  );
  if (!ownershipMarker.startsWith(CI_EXCLUSIVE_OWNERSHIP_PREFIX)) {
    throw observerError(DAILY_GOAL_PHASE_B_FAILURE_CODES.TARGET_OBSERVATION_FAILED);
  }
  const targetIdentity = ownershipMarker.slice(CI_EXCLUSIVE_OWNERSHIP_PREFIX.length);
  if (!SAFE_IDENTITY.test(targetIdentity)) {
    throw observerError(DAILY_GOAL_PHASE_B_FAILURE_CODES.TARGET_OBSERVATION_FAILED);
  }
  return Object.freeze({
    targetIdentity,
    databaseName: readText(row, "database_name", DAILY_GOAL_PHASE_B_FAILURE_CODES.TARGET_OBSERVATION_FAILED),
    serverEndpoint: readText(row, "server_endpoint", DAILY_GOAL_PHASE_B_FAILURE_CODES.TARGET_OBSERVATION_FAILED),
    serverPort: readText(row, "server_port", DAILY_GOAL_PHASE_B_FAILURE_CODES.TARGET_OBSERVATION_FAILED),
    schemaName: readText(row, "schema_name", DAILY_GOAL_PHASE_B_FAILURE_CODES.TARGET_OBSERVATION_FAILED),
    ownershipMarker,
    evidenceSource: "CONNECTED_POSTGRESQL",
    derivedFromConfiguration: false,
  });
}

async function readPrismaMigrationHistory(connection) {
  try {
    return mapPrismaMigrationHistory(
      await queryRows(connection, DAILY_GOAL_READ_ONLY_QUERIES.MIGRATION_HISTORY),
    );
  } catch {
    throw observerError(DAILY_GOAL_PHASE_B_FAILURE_CODES.HISTORY_READ_FAILED);
  }
}

async function queryRows(connection, sql) {
  assertReadOnlyObservationQueries({ query: sql });
  const result = await connection.query(sql);
  if (!result || !Array.isArray(result.rows)) {
    throw diagnosticError("Read-only query returned an invalid result.");
  }
  return result.rows;
}

function assertConnection(connection) {
  if (!connection
    || typeof connection.establishAndVerifyReadOnly !== "function"
    || typeof connection.query !== "function"
    || typeof connection.close !== "function") {
    throw diagnosticError("Injected connection does not satisfy the read-only contract.");
  }
}

function assertReadOnlyEvidence(evidence) {
  if (!evidence
    || evidence.enforced !== true
    || evidence.transactionReadOnly !== true
    || evidence.evidenceSource !== READ_ONLY_EVIDENCE_SOURCE) {
    throw diagnosticError("PostgreSQL read-only enforcement was not verified.");
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

function readText(row, field, failureCode) {
  const value = row?.[field];
  if (typeof value !== "string" || value.length === 0) {
    if (failureCode) throw observerError(failureCode);
    throw diagnosticError(`Connected ${field} evidence is missing.`);
  }
  return value;
}

function observerError(failureCode = DAILY_GOAL_PHASE_B_FAILURE_CODES.UNKNOWN_PHASE_B_FAILURE) {
  return createDailyGoalPhaseBFailure(failureCode, {
    errorCode: "DAILY_GOAL_READ_ONLY_OBSERVATION_FAILED",
    message: "Daily Goal read-only observation failed.",
  });
}

function diagnosticError(message) {
  return createDailyGoalPhaseBFailure(
    DAILY_GOAL_PHASE_B_FAILURE_CODES.UNKNOWN_PHASE_B_FAILURE,
    {
      errorCode: "DAILY_GOAL_READ_ONLY_OBSERVATION_FAILED",
      message,
    },
  );
}
