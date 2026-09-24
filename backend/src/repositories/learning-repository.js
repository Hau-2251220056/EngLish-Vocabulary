// @ts-nocheck
export function createLearningRepository(prisma) {
  return {
    findAccessibleSetForUser(setId, userId) {
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
  };
}
