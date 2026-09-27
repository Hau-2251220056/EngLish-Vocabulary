// @ts-nocheck
export function createQuizRepository(prisma) {
  return {
    findAccessibleSetForUser(setId, userId, quizType) {
      const vocabularySelect = {
        id: true,
        word: true,
        updated_at: true,
        learning_progress: {
          where: { user_id: userId },
          select: {
            status: true,
            review_count: true,
            revision: true,
            last_reviewed_at: true,
          },
        },
      };
      vocabularySelect.meanings = {
        orderBy: [{ created_at: "asc" }, { id: "asc" }],
        select: {
          id: true,
          part_of_speech: true,
          meaning_vi: true,
          context: true,
          cefr_level: true,
          updated_at: true,
        },
      };
      return prisma.vOCABULARY_SET.findFirst({
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
          items: {
            orderBy: { position: "asc" },
            select: {
              id: true,
              position: true,
              vocabulary: {
                select: vocabularySelect,
              },
            },
          },
        },
      });
    },

    async lockAccessibleSetForUser(setId, userId) {
      const rows = await prisma.$queryRaw`
        SELECT "id", "name"
        FROM "VOCABULARY_SET"
        WHERE "id" = ${setId}::uuid
          AND ("is_public" = TRUE OR ("is_public" = FALSE AND "owner_id" = ${userId}::uuid))
        FOR SHARE
      `;
      return rows[0] ?? null;
    },

    async lockQuestionItem(setId, vocabularyId) {
      const rows = await prisma.$queryRaw`
        SELECT
          item."id" AS "item_id",
          item."position",
          vocabulary."id" AS "vocabulary_id",
          vocabulary."word",
          vocabulary."updated_at" AS "vocabulary_updated_at"
        FROM "VOCABULARY_SET_ITEM" AS item
        INNER JOIN "VOCABULARY" AS vocabulary
          ON vocabulary."id" = item."vocabulary_id"
        WHERE item."vocabulary_set_id" = ${setId}::uuid
          AND item."vocabulary_id" = ${vocabularyId}::uuid
        FOR SHARE OF item, vocabulary
      `;
      return rows[0] ?? null;
    },

    lockMeanings(vocabularyId) {
      return prisma.$queryRaw`
        SELECT
          "id",
          "part_of_speech",
          "meaning_vi",
          "context",
          "cefr_level",
          "updated_at"
        FROM "VOCABULARY_MEANING"
        WHERE "vocabulary_id" = ${vocabularyId}::uuid
        ORDER BY "created_at" ASC, "id" ASC
        FOR SHARE
      `;
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
        async (transaction) => callback(createQuizRepository(transaction)),
        { maxWait: 10_000, timeout: 30_000 },
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
    next_review_at: true,
    interval_days: true,
    ease_factor: true,
  };
}
