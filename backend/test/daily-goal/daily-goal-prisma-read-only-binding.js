import { createDailyGoalReadOnlyObserver, DAILY_GOAL_READ_ONLY_QUERIES } from "./daily-goal-read-only-observer.js";

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

  try {
    const PrismaClient = await loadPrismaClient();
    if (typeof PrismaClient !== "function") throw bindingError();
    prisma = new PrismaClient({ datasourceUrl: authorization.databaseUrl });
    assertPrismaClient(prisma);

    try {
      await prisma.$transaction(async (transaction) => {
        assertTransactionClient(transaction);
        await transaction.$executeRawUnsafe(SET_TRANSACTION_READ_ONLY);

        const observer = createDailyGoalReadOnlyObserver({
          openConnection: async ({ databaseUrl, requiredMode }) => {
            if (databaseUrl !== authorization.databaseUrl || requiredMode !== "READ_ONLY") {
              throw bindingError();
            }
            return createTransactionConnection(transaction);
          },
        });

        result = await observer.withObservation({ authorization, expectedTarget, operation });
        completed = true;
        throw rollbackSignal;
      }, DAILY_GOAL_PRISMA_TRANSACTION_LIMITS);
      throw bindingError();
    } catch (error) {
      if (error !== rollbackSignal || !completed) throw error;
    }

    return result;
  } catch (error) {
    if (error?.code === "DAILY_GOAL_PRISMA_READ_ONLY_BINDING_FAILED") throw error;
    throw bindingError();
  } finally {
    if (prisma && typeof prisma.$disconnect === "function") {
      try {
        await prisma.$disconnect();
      } catch {
        throw bindingError();
      }
    }
  }
}

function createTransactionConnection(transaction) {
  let verified = false;
  let nextQuery = DAILY_GOAL_READ_ONLY_QUERIES.TARGET_OBSERVATION;
  return Object.freeze({
    async establishAndVerifyReadOnly() {
      if (verified) throw bindingError();
      const rows = await transaction.$queryRawUnsafe(SHOW_TRANSACTION_READ_ONLY);
      if (!Array.isArray(rows)
        || rows.length !== 1
        || rows[0]?.transaction_read_only !== "on") {
        throw bindingError();
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

function bindingError() {
  const error = new Error("Daily Goal Prisma read-only observation failed.");
  error.code = "DAILY_GOAL_PRISMA_READ_ONLY_BINDING_FAILED";
  return error;
}
