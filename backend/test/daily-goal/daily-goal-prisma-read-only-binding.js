import { createDailyGoalReadOnlyObserver, DAILY_GOAL_READ_ONLY_QUERIES } from "./daily-goal-read-only-observer.js";
import {
  createDailyGoalPhaseBFailure,
  DAILY_GOAL_PHASE_B_FAILURE_CODES,
  getDailyGoalPhaseBFailureCode,
  normalizeDailyGoalPhaseBFailure,
} from "./daily-goal-phase-b-diagnostics.js";

export const DAILY_GOAL_PRISMA_TRANSACTION_LIMITS = Object.freeze({
  maxWait: 5_000,
  timeout: 15_000,
});

const SET_TRANSACTION_READ_ONLY = "SET TRANSACTION READ ONLY";
const SHOW_TRANSACTION_READ_ONLY = "SHOW transaction_read_only";

export async function runDailyGoalPrismaReadOnlyObservation({
  authorization,
  expectedTarget,
  operation,
  loadPrismaClient = loadGeneratedPrismaClient,
}) {
  if (authorization?.operation !== "observation"
    || typeof authorization.databaseUrl !== "string"
    || authorization.databaseUrl.length === 0
    || typeof operation !== "function"
    || typeof loadPrismaClient !== "function") {
    throw bindingError();
  }

  let prisma;
  const rollbackSignal = Object.freeze({ dailyGoalReadOnlyRollback: true });
  let completed = false;
  let result;
  let callbackEntered = false;
  let callbackFailure;

  try {
    let PrismaClient;
    try {
      PrismaClient = await loadPrismaClient();
      if (typeof PrismaClient !== "function") throw new TypeError("Invalid Prisma Client.");
      prisma = new PrismaClient({ datasourceUrl: authorization.databaseUrl });
      assertPrismaClient(prisma);
    } catch {
      throw bindingError(DAILY_GOAL_PHASE_B_FAILURE_CODES.PRISMA_LOAD_FAILED);
    }

    let transactionResolved = false;
    try {
      await prisma.$transaction(async (transaction) => {
        callbackEntered = true;
        try {
          assertTransactionClient(transaction);
        } catch {
          callbackFailure = bindingError(
            DAILY_GOAL_PHASE_B_FAILURE_CODES.TRANSACTION_ACQUIRE_FAILED,
          );
          throw callbackFailure;
        }
        try {
          await transaction.$executeRawUnsafe(SET_TRANSACTION_READ_ONLY);
        } catch {
          callbackFailure = bindingError(
            DAILY_GOAL_PHASE_B_FAILURE_CODES.READ_ONLY_ENFORCEMENT_FAILED,
          );
          throw callbackFailure;
        }

        const observer = createDailyGoalReadOnlyObserver({
          openConnection: async ({ databaseUrl, requiredMode }) => {
            if (databaseUrl !== authorization.databaseUrl || requiredMode !== "READ_ONLY") {
              throw bindingError();
            }
            return createTransactionConnection(transaction);
          },
        });

        try {
          result = await observer.withObservation({ authorization, expectedTarget, operation });
        } catch (error) {
          callbackFailure = normalizeDailyGoalPhaseBFailure(
            error,
            DAILY_GOAL_PHASE_B_FAILURE_CODES.UNKNOWN_PHASE_B_FAILURE,
          );
          throw callbackFailure;
        }
        completed = true;
        throw rollbackSignal;
      }, DAILY_GOAL_PRISMA_TRANSACTION_LIMITS);
      transactionResolved = true;
    } catch (error) {
      if (error === rollbackSignal && completed) {
        // Exact private sentinel proves Prisma rejected the success callback and rolled it back.
      } else if (!callbackEntered) {
        throw bindingError(DAILY_GOAL_PHASE_B_FAILURE_CODES.TRANSACTION_ACQUIRE_FAILED);
      } else if (callbackFailure) {
        // Prisma may replace the callback exception while rejecting the transaction.
        // The callback stage was established at a controlled boundary and remains authoritative.
        throw callbackFailure;
      } else if (completed) {
        throw bindingError(DAILY_GOAL_PHASE_B_FAILURE_CODES.ROLLBACK_FAILED);
      } else {
        throw normalizeDailyGoalPhaseBFailure(
          error,
          DAILY_GOAL_PHASE_B_FAILURE_CODES.UNKNOWN_PHASE_B_FAILURE,
        );
      }
    }
    if (transactionResolved) {
      throw bindingError(DAILY_GOAL_PHASE_B_FAILURE_CODES.ROLLBACK_FAILED);
    }

    return result;
  } catch (error) {
    throw bindingError(getDailyGoalPhaseBFailureCode(error));
  } finally {
    if (prisma && typeof prisma.$disconnect === "function") {
      try {
        await prisma.$disconnect();
      } catch {
        throw bindingError(DAILY_GOAL_PHASE_B_FAILURE_CODES.DISCONNECT_FAILED);
      }
    }
  }
}

function createTransactionConnection(transaction) {
  let verified = false;
  let nextQuery = DAILY_GOAL_READ_ONLY_QUERIES.TARGET_OBSERVATION;
  return Object.freeze({
    async establishAndVerifyReadOnly() {
      if (verified) {
        throw bindingError(DAILY_GOAL_PHASE_B_FAILURE_CODES.READ_ONLY_ENFORCEMENT_FAILED);
      }
      let rows;
      try {
        rows = await transaction.$queryRawUnsafe(SHOW_TRANSACTION_READ_ONLY);
      } catch {
        throw bindingError(DAILY_GOAL_PHASE_B_FAILURE_CODES.READ_ONLY_ENFORCEMENT_FAILED);
      }
      if (!Array.isArray(rows)
        || rows.length !== 1
        || rows[0]?.transaction_read_only !== "on") {
        throw bindingError(DAILY_GOAL_PHASE_B_FAILURE_CODES.READ_ONLY_ENFORCEMENT_FAILED);
      }
      verified = true;
      return Object.freeze({
        enforced: true,
        transactionReadOnly: true,
        evidenceSource: "POSTGRESQL_TRANSACTION_READ_ONLY",
      });
    },
    async query(sql) {
      if (!verified || sql !== nextQuery) throw bindingError();
      let rows;
      if (sql === DAILY_GOAL_READ_ONLY_QUERIES.TARGET_OBSERVATION) {
        rows = await transaction.$queryRawUnsafe(DAILY_GOAL_READ_ONLY_QUERIES.TARGET_OBSERVATION);
        nextQuery = DAILY_GOAL_READ_ONLY_QUERIES.MIGRATION_HISTORY;
      } else if (sql === DAILY_GOAL_READ_ONLY_QUERIES.MIGRATION_HISTORY) {
        rows = await transaction.$queryRawUnsafe(DAILY_GOAL_READ_ONLY_QUERIES.MIGRATION_HISTORY);
        nextQuery = null;
      } else {
        throw bindingError();
      }
      if (!Array.isArray(rows)) throw bindingError();
      return { rows };
    },
    async close() {
      // Transaction ownership remains with Prisma; the private sentinel rolls it back.
    },
  });
}

function assertPrismaClient(prisma) {
  if (!prisma || typeof prisma.$transaction !== "function" || typeof prisma.$disconnect !== "function") {
    throw bindingError();
  }
}

function assertTransactionClient(transaction) {
  if (!transaction
    || typeof transaction.$executeRawUnsafe !== "function"
    || typeof transaction.$queryRawUnsafe !== "function") {
    throw bindingError();
  }
}

async function loadGeneratedPrismaClient() {
  const module = await import("../../src/generated/prisma/client.ts");
  return module.PrismaClient;
}

function bindingError(failureCode = DAILY_GOAL_PHASE_B_FAILURE_CODES.UNKNOWN_PHASE_B_FAILURE) {
  return createDailyGoalPhaseBFailure(failureCode, {
    errorCode: "DAILY_GOAL_PRISMA_READ_ONLY_BINDING_FAILED",
    message: "Daily Goal Prisma read-only observation failed.",
  });
}
