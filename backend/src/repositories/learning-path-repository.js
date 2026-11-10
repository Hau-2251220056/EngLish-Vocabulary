// @ts-nocheck

const LEVELS = Object.freeze(["A1", "A2", "B1", "B2", "C1"]);

const PASS_SELECT = Object.freeze({
  id: true,
  user_id: true,
  vocabulary_set_id: true,
  set_id_snapshot: true,
  status: true,
  create_operation_id: true,
  snapshot_size: true,
  created_at: true,
  completed_at: true,
  completion_event_id: true,
  invalidated_at: true,
  vocabulary_set: {
    select: { id: true, name: true, cefr_level: true, is_public: true, created_at: true },
  },
  items: {
    orderBy: { position: "asc" },
    select: { id: true, pass_id: true, vocabulary_id: true, position: true },
  },
  learning_sessions: {
    orderBy: { created_at: "asc" },
    select: {
      id: true, user_id: true, set_id_snapshot: true, scope: true, mode: true, status: true,
      snapshot_size: true, created_at: true, expires_at: true, completed_at: true,
      items: {
        orderBy: { position: "asc" },
        select: { vocabulary_id: true, position: true, evidence: true, evidence_event_id: true, evidence_at: true },
      },
    },
  },
});

export function createLearningPathRepository(prisma) {
  requireClient(prisma);
  const findOwnedPass = (passId, userId) => prisma.cEFR_LEARNING_PASS.findFirst({
    where: { id: passId, user_id: userId }, select: PASS_SELECT,
  });

  return Object.freeze({
    listCurrentCurriculum(userId) {
      return prisma.vOCABULARY_SET.findMany({
        where: { is_public: true, cefr_level: { in: LEVELS } },
        orderBy: [{ cefr_level: "asc" }, { created_at: "asc" }, { id: "asc" }],
        select: {
          id: true, name: true, cefr_level: true, created_at: true,
          items: { orderBy: { position: "asc" }, select: { vocabulary_id: true, position: true } },
          cefr_learning_passes: {
            where: { user_id: userId, status: "COMPLETED" },
            take: 1,
            select: { id: true, completed_at: true },
          },
        },
      });
    },

    findRequiredSet(setId) {
      return prisma.vOCABULARY_SET.findFirst({
        where: { id: setId, is_public: true, cefr_level: { in: LEVELS } },
        select: {
          id: true, name: true, cefr_level: true, created_at: true,
          items: { orderBy: { position: "asc" }, select: { vocabulary_id: true, position: true } },
        },
      });
    },

    async lockActivitySetClassification(setId) {
      const rows = await prisma.$queryRaw`
        SELECT "id", "owner_id", "is_public", "cefr_level"
        FROM "VOCABULARY_SET"
        WHERE "id" = ${setId}::uuid
        FOR SHARE
      `;
      return rows[0] ?? null;
    },

    findPathState(userId) {
      return prisma.cEFR_LEARNING_PATH_STATE.findUnique({ where: { user_id: userId } });
    },

    async lockPathState(userId) {
      await prisma.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${userId}::text || ':cefr-path', 0))::text`;
      return prisma.cEFR_LEARNING_PATH_STATE.findUnique({ where: { user_id: userId } });
    },

    upsertPathState(userId, data) {
      return prisma.cEFR_LEARNING_PATH_STATE.upsert({
        where: { user_id: userId },
        create: { user_id: userId, ...data },
        update: data,
      });
    },

    findOwnedPass,

    findActivePass(userId, setId) {
      return prisma.cEFR_LEARNING_PASS.findFirst({
        where: { user_id: userId, set_id_snapshot: setId, status: "ACTIVE" },
        select: PASS_SELECT,
      });
    },

    findCompletedPass(userId, setId) {
      return prisma.cEFR_LEARNING_PASS.findFirst({
        where: { user_id: userId, set_id_snapshot: setId, status: "COMPLETED" },
        select: PASS_SELECT,
      });
    },

    async lockPassIdentity(userId, setId) {
      await prisma.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${userId}::text || ':' || ${setId}::text || ':cefr-pass', 0))::text`;
    },

    async lockOperationIdentity(userId, operationId) {
      await prisma.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${userId}::text || ':' || ${operationId}::text || ':cefr-operation', 0))::text`;
    },

    listActivePasses(userId) {
      return prisma.cEFR_LEARNING_PASS.findMany({
        where: { user_id: userId, status: "ACTIVE" },
        orderBy: [{ created_at: "desc" }, { id: "asc" }],
        select: PASS_SELECT,
      });
    },

    listActiveSetContexts(userId, evaluatedAt) {
      return prisma.lEARNING_SESSION.findMany({
        where: {
          user_id: userId,
          status: "ACTIVE",
          expires_at: { gt: cloneDate(evaluatedAt) },
          scope: "SET",
          mode: { in: ["NORMAL", "SRS"] },
          set_id_snapshot: { not: null },
        },
        orderBy: [{ created_at: "desc" }, { id: "asc" }],
        select: {
          id: true,
          set_id_snapshot: true,
          scope: true,
          mode: true,
          status: true,
          created_at: true,
          expires_at: true,
        },
      });
    },

    findCreationReplay(userId, operationId) {
      return prisma.cEFR_LEARNING_PASS.findUnique({
        where: { user_id_create_operation_id: { user_id: userId, create_operation_id: operationId } },
        select: PASS_SELECT,
      });
    },

    findCompletionReplay(userId, operationId) {
      return prisma.cEFR_LEARNING_PASS.findUnique({
        where: { user_id_completion_event_id: { user_id: userId, completion_event_id: operationId } },
        select: PASS_SELECT,
      });
    },

    createPass(input) {
      return prisma.cEFR_LEARNING_PASS.create({
        data: {
          id: input.id,
          user_id: input.user_id,
          vocabulary_set_id: input.set_id_snapshot,
          set_id_snapshot: input.set_id_snapshot,
          create_operation_id: input.create_operation_id,
          snapshot_size: input.items.length,
          created_at: cloneDate(input.created_at),
          items: { create: input.items.map((item) => ({ vocabulary_id: item.vocabulary_id, position: item.position })) },
        },
        select: PASS_SELECT,
      });
    },

    async lockOwnedPass(passId, userId) {
      const rows = await prisma.$queryRaw`SELECT "id" FROM "CEFR_LEARNING_PASS" WHERE "id" = ${passId}::uuid AND "user_id" = ${userId}::uuid FOR UPDATE`;
      return rows[0] ? findOwnedPass(passId, userId) : null;
    },

    invalidatePass(passId, userId, invalidatedAt) {
      return prisma.cEFR_LEARNING_PASS.updateMany({
        where: { id: passId, user_id: userId, status: "ACTIVE" },
        data: { status: "INVALIDATED", invalidated_at: cloneDate(invalidatedAt) },
      });
    },

    completePass(passId, userId, completionEventId, completedAt) {
      return prisma.cEFR_LEARNING_PASS.updateMany({
        where: { id: passId, user_id: userId, status: "ACTIVE" },
        data: { status: "COMPLETED", completion_event_id: completionEventId, completed_at: cloneDate(completedAt) },
      });
    },

    withTransaction(callback) {
      return prisma.$transaction(
        (transaction) => callback(createLearningPathRepository(transaction), transaction),
        { maxWait: 10_000, timeout: 30_000 },
      );
    },
  });
}

export { LEVELS as CEFR_LEVELS };

function requireClient(prisma) {
  if (!prisma?.cEFR_LEARNING_PASS || !prisma?.cEFR_LEARNING_PATH_STATE || !prisma?.lEARNING_SESSION || !prisma?.vOCABULARY_SET || typeof prisma.$queryRaw !== "function") {
    throw new TypeError("A Prisma client or transaction is required.");
  }
}

function cloneDate(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) throw new TypeError("A valid Date is required.");
  return new Date(value.getTime());
}
