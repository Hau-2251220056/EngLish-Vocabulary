// @ts-nocheck

const DEFAULT_TRANSACTION_OPTIONS = Object.freeze({ maxWait: 10_000, timeout: 30_000 });
export const DAILY_GOAL_CLEANUP_BATCH_LIMIT = 100;
const DAY_MILLISECONDS = 24 * 60 * 60 * 1_000;
const RECEIPT_RETENTION_MILLISECONDS = 30 * DAY_MILLISECONDS;
const PARENT_RETENTION_MILLISECONDS = 31 * DAY_MILLISECONDS;

export function createDailyGoalRepository(prisma) {
  return createRepository(prisma, () => new Date());
}

// Deliberately named test seam: production construction always uses the internal clock above.
export function createDailyGoalRepositoryForTest(prisma, { now }) {
  if (typeof now !== "function") throw new TypeError("Test clock is required.");
  return createRepository(prisma, now);
}

function createRepository(prisma, now) {
  requireClient(prisma);

  return Object.freeze({
    withUserTransaction(userId, callback) {
      requireNonemptyString(userId, "userId");
      requireCallback(callback);
      return prisma.$transaction(async (transaction) => {
        await lockUserBoundary(transaction, userId);
        const lifecycle = { active: true };
        const repository = createTransactionRepository(transaction, userId, lifecycle);
        try {
          const result = await callback(repository);
          refuseEscapedCapability(result, repository, transaction);
          return result;
        } finally {
          lifecycle.active = false;
        }
      }, DEFAULT_TRANSACTION_OPTIONS);
    },

    withCleanupTransaction(callback) {
      requireCallback(callback);
      return prisma.$transaction(async (transaction) => {
        const evaluatedAt = requireDate(now(), "evaluatedAt");
        await lockCleanupBoundary(transaction);
        const lifecycle = { active: true };
        const repository = createCleanupRepository(transaction, lifecycle, evaluatedAt);
        try {
          const result = await callback(repository);
          refuseEscapedCapability(result, repository, transaction);
          return result;
        } finally {
          lifecycle.active = false;
        }
      }, DEFAULT_TRANSACTION_OPTIONS);
    },
  });
}

function createTransactionRepository(transaction, userId, lifecycle) {
  return guardRepository({
    findAuthorizedActivityContext({ activityType, learningSessionId, setId, vocabularyId, observedAt }) {
      if (activityType === "SPEAKING") {
        return transaction.vOCABULARY_SET.findFirst({
          where: {
            id: setId,
            OR: [{ is_public: true }, { is_public: false, owner_id: userId }],
            items: { some: { vocabulary_id: vocabularyId } },
          },
          select: { id: true },
        });
      }
      return transaction.lEARNING_SESSION.findFirst({
        where: {
          id: learningSessionId,
          user_id: userId,
          status: "ACTIVE",
          mode: activityType,
          expires_at: { gt: observedAt },
        },
        select: { id: true, mode: true, status: true, expires_at: true },
      });
    },
    findTrackingSession(sessionId) {
      return transaction.dAILY_GOAL_TRACKING_SESSION.findFirst({
        where: { id: sessionId, user_id: userId },
      });
    },
    createTrackingSession(data) {
      return transaction.dAILY_GOAL_TRACKING_SESSION.create({ data: ownerData(data, userId) });
    },
    updateTrackingSession(sessionId, data) {
      return transaction.dAILY_GOAL_TRACKING_SESSION.updateMany({
        where: { id: sessionId, user_id: userId }, data,
      });
    },

    findOwner() {
      return transaction.dAILY_GOAL_OWNER.findUnique({ where: { user_id: userId } });
    },
    upsertOwner({ create, update }) {
      return transaction.dAILY_GOAL_OWNER.upsert({
        where: { user_id: userId },
        create: ownerData(create, userId),
        update,
      });
    },
    updateOwnerAtGeneration(expectedGeneration, data) {
      return transaction.dAILY_GOAL_OWNER.updateMany({
        where: { user_id: userId, generation: expectedGeneration }, data,
      });
    },
    clearExpiredOwnerAtGeneration({ expectedGeneration, expiredBefore, nextGeneration }) {
      return transaction.dAILY_GOAL_OWNER.updateMany({
        where: {
          user_id: userId,
          generation: expectedGeneration,
          lease_expires_at: { lte: expiredBefore },
        },
        data: {
          tracking_session_id: null,
          lease_expires_at: null,
          last_accounted_at: null,
          generation: nextGeneration,
        },
      });
    },

    findOperationReceipt(operationId) {
      return transaction.dAILY_GOAL_OPERATION_RECEIPT.findFirst({
        where: { operation_id: operationId, user_id: userId },
      });
    },
    async findOperationReplay({ operationId, operationType, requestFingerprint }) {
      const receipt = await transaction.dAILY_GOAL_OPERATION_RECEIPT.findFirst({
        where: { operation_id: operationId, user_id: userId },
      });
      if (!receipt) return Object.freeze({ classification: "MISSING", receipt: null });
      const matching = receipt.operation_type === operationType
        && receipt.request_fingerprint === requestFingerprint;
      return Object.freeze({
        classification: matching ? "REPLAY" : "OPERATION_CONFLICT",
        receipt,
      });
    },
    createOperationReceipt(data) {
      return transaction.dAILY_GOAL_OPERATION_RECEIPT.create({ data: ownerData(data, userId) });
    },

    findDay(activityDate) {
      return transaction.dAILY_GOAL_DAY.findUnique({
        where: { user_id_activity_date: { user_id: userId, activity_date: activityDate } },
      });
    },
    upsertDay(activityDate, { create, update }) {
      return transaction.dAILY_GOAL_DAY.upsert({
        where: { user_id_activity_date: { user_id: userId, activity_date: activityDate } },
        create: { ...create, user_id: userId, activity_date: activityDate },
        update,
      });
    },

    findReward(activityDate) {
      return transaction.dAILY_GOAL_REWARD.findUnique({
        where: { user_id_activity_date: { user_id: userId, activity_date: activityDate } },
      });
    },
    createReward(data) {
      return transaction.dAILY_GOAL_REWARD.create({ data: ownerData(data, userId) });
    },

    findPreference() {
      return transaction.uSER.findUnique({
        where: { id: userId },
        select: {
          id: true,
          total_xp: true,
          daily_goal_minutes: true,
          daily_goal_reminders_enabled: true,
          daily_goal_reminders_enabled_at: true,
        },
      });
    },
    updatePreference(data) {
      return transaction.uSER.updateMany({ where: { id: userId }, data });
    },
    incrementTotalXp(amount) {
      return transaction.uSER.update({
        where: { id: userId },
        data: { total_xp: { increment: amount } },
        select: { total_xp: true },
      });
    },

    findMonitorSession(monitorSessionId) {
      return transaction.dAILY_GOAL_MONITOR_SESSION.findFirst({
        where: { id: monitorSessionId, user_id: userId },
      });
    },
    createMonitorSession(data) {
      return transaction.dAILY_GOAL_MONITOR_SESSION.create({ data: ownerData(data, userId) });
    },
    updateMonitorSession(monitorSessionId, data) {
      return transaction.dAILY_GOAL_MONITOR_SESSION.updateMany({
        where: { id: monitorSessionId, user_id: userId }, data,
      });
    },

    findNotification(notificationId) {
      return transaction.uSER_NOTIFICATION.findFirst({
        where: { id: notificationId, user_id: userId },
      });
    },
    findNotificationByTypeAndDate(type, applicationDate) {
      return transaction.uSER_NOTIFICATION.findUnique({
        where: {
          user_id_type_application_date: {
            user_id: userId,
            type,
            application_date: applicationDate,
          },
        },
      });
    },
    createNotification(data) {
      return transaction.uSER_NOTIFICATION.create({ data: ownerData(data, userId) });
    },
    listNotifications({ before, take }) {
      return transaction.uSER_NOTIFICATION.findMany({
        where: {
          user_id: userId,
          ...(before ? {
            OR: [
              { created_at: { lt: before.createdAt } },
              { created_at: before.createdAt, id: { lt: before.id } },
            ],
          } : {}),
        },
        orderBy: [{ created_at: "desc" }, { id: "desc" }],
        take,
        select: {
          id: true,
          type: true,
          title: true,
          body: true,
          application_date: true,
          created_at: true,
          read_at: true,
        },
      });
    },
    countUnreadNotifications() {
      return transaction.uSER_NOTIFICATION.count({
        where: { user_id: userId, read_at: null },
      });
    },
    markNotificationRead(notificationId, readAt) {
      return transaction.uSER_NOTIFICATION.updateMany({
        where: { id: notificationId, user_id: userId },
        data: { read_at: readAt },
      });
    },
  }, lifecycle);
}

function createCleanupRepository(transaction, lifecycle, evaluatedAt) {
  const receiptBefore = new Date(evaluatedAt.getTime() - RECEIPT_RETENTION_MILLISECONDS);
  const parentBefore = new Date(evaluatedAt.getTime() - PARENT_RETENTION_MILLISECONDS);
  return guardRepository({
    async cleanupExpiredOperationalState({ limit = DAILY_GOAL_CLEANUP_BATCH_LIMIT } = {}) {
      if (!Number.isInteger(limit) || limit < 0 || limit > DAILY_GOAL_CLEANUP_BATCH_LIMIT) {
        throw new RangeError(`limit must be an integer from 0 through ${DAILY_GOAL_CLEANUP_BATCH_LIMIT}.`);
      }

      const receiptIds = await listIds(
        transaction.dAILY_GOAL_OPERATION_RECEIPT,
        { created_at: { lt: receiptBefore } },
        [{ created_at: "asc" }, { operation_id: "asc" }],
        "operation_id",
        limit,
      );
      let receiptsDeleted = 0;
      if (receiptIds.length > 0) {
        const deletion = await transaction.dAILY_GOAL_OPERATION_RECEIPT.deleteMany({
          where: { operation_id: { in: receiptIds } },
        });
        receiptsDeleted = deletion.count;
      }

      const trackingIds = await listIds(
        transaction.dAILY_GOAL_TRACKING_SESSION,
        {
          status: "CLOSED",
          closed_at: { lt: parentBefore },
          operation_receipts: { none: {} },
          owner_records: { none: {} },
        },
        [{ closed_at: "asc" }, { id: "asc" }],
        "id",
        limit,
      );
      let trackingSessionsDeleted = 0;
      if (trackingIds.length > 0) {
        const deletion = await transaction.dAILY_GOAL_TRACKING_SESSION.deleteMany({
          where: {
            id: { in: trackingIds },
            status: "CLOSED",
            closed_at: { lt: parentBefore },
            operation_receipts: { none: {} },
            owner_records: { none: {} },
          },
        });
        trackingSessionsDeleted = deletion.count;
      }

      const monitorIds = await listIds(
        transaction.dAILY_GOAL_MONITOR_SESSION,
        {
          closed_at: { lt: parentBefore },
          operation_receipts: { none: {} },
        },
        [{ closed_at: "asc" }, { id: "asc" }],
        "id",
        limit,
      );
      let monitorSessionsDeleted = 0;
      if (monitorIds.length > 0) {
        const deletion = await transaction.dAILY_GOAL_MONITOR_SESSION.deleteMany({
          where: {
            id: { in: monitorIds },
            closed_at: { lt: parentBefore },
            operation_receipts: { none: {} },
          },
        });
        monitorSessionsDeleted = deletion.count;
      }

      return Object.freeze({
        receiptsDeleted,
        trackingSessionsDeleted,
        monitorSessionsDeleted,
      });
    },
  }, lifecycle);
}

async function listIds(delegate, where, orderBy, field, take) {
  if (take === 0) return [];
  const rows = await delegate.findMany({ where, orderBy, take, select: { [field]: true } });
  return rows.map((row) => row[field]);
}

async function lockUserBoundary(transaction, userId) {
  await transaction.$queryRaw`
    SELECT pg_advisory_xact_lock(
      hashtextextended('daily-goal:user:' || ${userId}::text, 0)
    )::text AS "lock_result"
  `;
}

async function lockCleanupBoundary(transaction) {
  await transaction.$queryRaw`
    SELECT pg_advisory_xact_lock(
      hashtextextended('daily-goal:cleanup', 0)
    )::text AS "lock_result"
  `;
}

function ownerData(data, userId) {
  return { ...data, user_id: userId };
}

function guardRepository(methods, lifecycle) {
  const guarded = {};
  for (const [name, method] of Object.entries(methods)) {
    guarded[name] = (...args) => {
      if (!lifecycle.active) throw new Error("Transaction-scoped repository is no longer active.");
      return method(...args);
    };
  }
  return Object.freeze(guarded);
}

function refuseEscapedCapability(result, repository, transaction) {
  if (result === repository || result === transaction) {
    throw new Error("Transaction capability cannot be returned from its callback.");
  }
}

function requireClient(prisma) {
  if (!prisma || typeof prisma.$transaction !== "function") {
    throw new TypeError("A Prisma-compatible transaction client is required.");
  }
}

function requireCallback(callback) {
  if (typeof callback !== "function") throw new TypeError("Transaction callback is required.");
}

function requireNonemptyString(value, name) {
  if (typeof value !== "string" || value.length === 0) throw new TypeError(`${name} must be a nonempty string.`);
}

function requireDate(value, name) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) throw new TypeError(`${name} must be a valid Date.`);
  return new Date(value.getTime());
}
