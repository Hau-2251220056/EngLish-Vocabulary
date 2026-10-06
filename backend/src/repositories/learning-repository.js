// @ts-nocheck
export function createLearningRepository(prisma) {
  return {
    findAccessibleSetForUser(setId, userId) {
      return prisma.vOCABULARY_SET.findFirst({
        relationLoadStrategy: "join",
        where: {
          id: setId,
          OR: [
            { is_public: true },
            { is_public: false, owner_id: userId },
          ],
        },
        select: {
          id: true,
          name: true,
          topic: {
            select: {
              id: true,
              name: true,
            },
          },
          items: {
            orderBy: { position: "asc" },
            select: {
              position: true,
              vocabulary: {
                select: {
                  id: true,
                  word: true,
                  phonetic: true,
                  pronunciation_url: true,
                  meanings: {
                    orderBy: [{ created_at: "asc" }, { id: "asc" }],
                    select: {
                      id: true,
                      part_of_speech: true,
                      meaning_vi: true,
                      context: true,
                      cefr_level: true,
                      examples: {
                        orderBy: [{ created_at: "asc" }, { id: "asc" }],
                        select: {
                          id: true,
                          example_en: true,
                          example_vi: true,
                        },
                      },
                    },
                  },
                  learning_progress: {
                    where: { user_id: userId },
                    select: {
                      status: true,
                      review_count: true,
                      revision: true,
                      last_reviewed_at: true,
                      last_event_id: true,
                      interval_days: true,
                      next_review_at: true,
                    },
                  },
                },
              },
            },
          },
        },
      });
    },

    async lockAccessibleSetForUser(setId, userId) {
      const rows = await prisma.$queryRaw`
        SELECT "id"
        FROM "VOCABULARY_SET"
        WHERE "id" = ${setId}::uuid
          AND ("is_public" = TRUE OR ("is_public" = FALSE AND "owner_id" = ${userId}::uuid))
        FOR SHARE
      `;
      return rows[0] ?? null;
    },

    async lockSetItem(setId, vocabularyId) {
      const rows = await prisma.$queryRaw`
        SELECT "id"
        FROM "VOCABULARY_SET_ITEM"
        WHERE "vocabulary_set_id" = ${setId}::uuid
          AND "vocabulary_id" = ${vocabularyId}::uuid
        FOR SHARE
      `;
      return rows[0] ?? null;
    },

    findProgress(userId, vocabularyId) {
      return prisma.lEARNING_PROGRESS.findUnique({
        where: {
          user_id_vocabulary_id: {
            user_id: userId,
            vocabulary_id: vocabularyId,
          },
        },
        select: progressSelect(),
      });
    },

    listProgressForSummary(userId) {
      return prisma.lEARNING_PROGRESS.findMany({
        where: { user_id: userId },
        select: {
          status: true,
          interval_days: true,
          next_review_at: true,
        },
      });
    },

    countProgress(userId, status, evaluatedAt) {
      return prisma.lEARNING_PROGRESS.count({
        where: effectiveProgressWhere(userId, status, evaluatedAt),
      });
    },

    listProgress(userId, { status, skip, take, evaluatedAt }) {
      return prisma.lEARNING_PROGRESS.findMany({
        where: effectiveProgressWhere(userId, status, evaluatedAt),
        orderBy: [
          { last_reviewed_at: { sort: "desc", nulls: "last" } },
          { created_at: "desc" },
          { id: "asc" },
        ],
        skip,
        take,
        select: {
          status: true,
          review_count: true,
          last_reviewed_at: true,
          interval_days: true,
          next_review_at: true,
          vocabulary: {
            select: {
              id: true,
              word: true,
              phonetic: true,
            },
          },
        },
      });
    },

    createProgress(data) {
      return prisma.lEARNING_PROGRESS.create({
        data,
        select: progressSelect(),
      });
    },

    updateProgressAtRevision(id, expectedRevision, data) {
      return prisma.lEARNING_PROGRESS.updateMany({
        where: { id, revision: expectedRevision },
        data,
      });
    },

    withTransaction(callback) {
      return prisma.$transaction(
        async (transaction) => callback(createLearningRepository(transaction)),
        { maxWait: 10_000, timeout: 30_000 },
      );
    },

    withConsistentRead(callback) {
      return prisma.$transaction(
        async (transaction) => callback(createLearningRepository(transaction)),
        {
          isolationLevel: "RepeatableRead",
          maxWait: 10_000,
          timeout: 30_000,
        },
      );
    },
  };
}

function progressSelect() {
  return {
    id: true,
    user_id: true,
    vocabulary_id: true,
    status: true,
    review_count: true,
    revision: true,
    last_reviewed_at: true,
    last_event_id: true,
    interval_days: true,
    next_review_at: true,
  };
}

const LADDER_INTERVALS = [1, 3, 7, 14, 30];

function effectiveProgressWhere(userId, status, evaluatedAt) {
  const base = { user_id: userId };
  if (!status) return base;
  if (status === "LEARNING") return { ...base, status: "LEARNING" };
  if (status === "NEEDS_REVIEW") {
    return {
      ...base,
      OR: [
        { status: "NEEDS_REVIEW" },
        {
          status: "LEARNED",
          interval_days: { in: LADDER_INTERVALS },
          next_review_at: { lte: evaluatedAt },
        },
      ],
    };
  }
  return {
    ...base,
    status: "LEARNED",
    OR: [
      { interval_days: null },
      { interval_days: { notIn: LADDER_INTERVALS } },
      { next_review_at: null },
      { next_review_at: { gt: evaluatedAt } },
    ],
  };
}
