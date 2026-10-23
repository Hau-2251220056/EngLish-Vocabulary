import {
  DAILY_GOAL_READ_ONLY_QUERIES,
  READ_ONLY_EVIDENCE_SOURCE,
} from "./daily-goal-read-only-observer.js";

const TRANSACTION_READ_ONLY_QUERY = "SHOW transaction_read_only";
const ALLOWED_OBSERVATION_QUERIES = new Set(Object.values(DAILY_GOAL_READ_ONLY_QUERIES));

export function createDailyGoalReadOnlyConnectionFactory({ connectDedicatedObserver }) {
  if (typeof connectDedicatedObserver !== "function") {
    throw new TypeError("A dedicated observer session connector is required.");
  }

  return async function openConnection({ databaseUrl, requiredMode }) {
    if (requiredMode !== "READ_ONLY" || typeof databaseUrl !== "string" || databaseUrl.length === 0) {
      throw connectionError();
    }

    let session;
    try {
      session = await connectDedicatedObserver(Object.freeze({ databaseUrl }));
      assertSession(session);
    } catch {
      if (session && typeof session.close === "function") {
        try { await session.close(); } catch { /* Redacted setup cleanup failure. */ }
      }
      throw connectionError();
    }

    let state = "OPEN";
    let nextObservation = DAILY_GOAL_READ_ONLY_QUERIES.TARGET_OBSERVATION;

    return Object.freeze({
      async establishAndVerifyReadOnly() {
        if (state !== "OPEN") throw connectionError();
        try {
          state = "TRANSACTION_STARTING";
          await session.beginReadOnlyTransaction();
          state = "TRANSACTION_STARTED";
          const result = await session.query(TRANSACTION_READ_ONLY_QUERY);
          if (result?.rows?.length !== 1 || result.rows[0]?.transaction_read_only !== "on") {
            throw connectionError();
          }
          state = "VERIFIED";
          return Object.freeze({
            enforced: true,
            transactionReadOnly: true,
            evidenceSource: READ_ONLY_EVIDENCE_SOURCE,
          });
        } catch {
          throw connectionError();
        }
      },

      async query(sql) {
        if (state !== "VERIFIED" || sql !== nextObservation || !ALLOWED_OBSERVATION_QUERIES.has(sql)) {
          throw connectionError();
        }
        try {
          const result = await session.query(sql);
          nextObservation = sql === DAILY_GOAL_READ_ONLY_QUERIES.TARGET_OBSERVATION
            ? DAILY_GOAL_READ_ONLY_QUERIES.MIGRATION_HISTORY
            : null;
          return result;
        } catch {
          throw connectionError();
        }
      },

      async close() {
        if (state === "CLOSED") return;
        const transactionStarted = ["TRANSACTION_STARTING", "TRANSACTION_STARTED", "VERIFIED"].includes(state);
        state = "CLOSED";
        if (transactionStarted) {
          try { await session.rollback(); } catch { /* Redacted cleanup failure. */ }
        }
        try { await session.close(); } catch { /* Redacted cleanup failure. */ }
      },
    });
  };
}

function assertSession(session) {
  if (!session
    || typeof session.beginReadOnlyTransaction !== "function"
    || typeof session.query !== "function"
    || typeof session.rollback !== "function"
    || typeof session.close !== "function") {
    throw connectionError();
  }
}

function connectionError() {
  const error = new Error("Daily Goal dedicated read-only connection failed.");
  error.code = "DAILY_GOAL_READ_ONLY_CONNECTION_FAILED";
  return error;
}
